# Engine API and usage

Version 1.0, Sat 2026-10-10. Package `@flare/engine` (`packages/engine`). It implements ICD-1 exactly (`packages/shared/src/icd/engine.ts`) and adds a few pure helpers for creation and the BE7 rules. Algorithm and invariants: [01-algorithm.md](01-algorithm.md).

## 1. Exports

| Export | Signature | Purpose |
| --- | --- | --- |
| `engine` | `Engine` (`solve`, `transition`, `view`) | ICD-1 |
| `createFlare` | `(input: FlareInput, now: Iso) => Created` | Row F1: validate, build the Kindling gathering, first effects, `expires_at` |
| `createPlan` | `(input: PlanInput, now: Iso) => Created` | Row P1: BR-P-1, BR-P-4, BR-Q-2 |
| `planTimesOk`, `ladderOk` | `boolean` checks | BR-P-1 and BR-P-4 on their own (for the create form) |
| `MAX_GROUP` | `12` | BR-S-4 |
| `pickEmber` | `(g, answers, final) => Label \| null` | BR-E-1 to BR-E-4 on its own |
| `yesCount` | `(g, answers) => number` | host + member yeses + text yeses (BR-H-4) |
| `nextChangeAt` | `(g) => Iso \| null` | the timer part of `view` |
| `sparkAllowed` | `({issued, used}) => {ok} \| {ok:false, error}` | BR-K-1: `not_arrived`, `spark_exists` |
| `mergeHotSpots`, `recordLit`, `HotSpot` | pure list functions | BR-K-6 merge-by-max, host's update at Gone |

All times are UTC ISO 8601 strings. A string that is not a full ISO time with an offset throws `RangeError` (a programming error, never user input: the API validates first).

## 2. How the backend calls it

One HTTP request or one timer job is one engine call inside one transaction:

```ts
import { engine } from "@flare/engine";
import type { EngineEvent } from "@flare/shared/icd/engine";

async function apply(db: Db, gatheringId: string, event: EngineEvent): Promise<Result> {
  return db.tx(async (tx) => {
    const g = await tx.gatheringForUpdate(gatheringId); // SELECT ... FOR UPDATE
    const answers = await tx.answers(gatheringId);
    const now = new Date().toISOString(); // the server clock decides (BR-TIME-1)
    const r = engine.transition(g, answers, event, now);
    if (!r.ok) return r; // map r.error to the contract code (section 4)
    await tx.saveGathering(r.gathering); // version is already +1 when anything changed
    await tx.replaceAnswers(gatheringId, r.answers); // upsert these, delete rows not present
    tx.afterCommit(() => runEffects(gatheringId, r.effects)); // effects only after commit
    return r;
  });
}
```

Timer jobs call the same function with `{ type: "timer", job }`. A job that fires late, twice, or after the state moved on is safe: the engine checks the due time and state and returns `ok` with no effects.

Creating:

```ts
import { createFlare } from "@flare/engine";

const c = createFlare(
  { id, group_id, host: memberId, group_size, quorum: 2, ember_candidates: ["c1", "c2", "c3"] },
  new Date().toISOString(),
);
if (!c.ok) return apiError(c.error); // quorum_range | group_full | bad_request
await tx.insertGathering(c.gathering, c.expires_at); // expires_at for BR-D-2
tx.afterCommit(() => runEffects(c.gathering.id, c.effects));
```

`createPlan` is the same with `start_at`, `deadline_at` and `steps` (exactly 4), and can also return `plan_times`.

Reading the shared view:

```ts
const { need, next_change_at } = engine.view(g, answers, now); // GET /gatherings/{id}
```

## 3. The effect contract

Effects come back in the order they should run. Each transition has at most one `sse` and it is last; at most one Telegram `edit_count`, dropped when a stronger post (`lit`, `ember`, `smaller`, `final`) is in the same list.

| Effect | Meaning for the backend |
| --- | --- |
| `{schedule, job, at}` | Upsert the job of that kind for this gathering at `at`. It replaces any pending job of the same kind (a fade moves `gone` this way). |
| `{unschedule, job}` | Delete the pending job of that kind if there is one; no-op otherwise. |
| `{push, event, to, label?, step?}` | Web Push (asyncapi `push`). `to: "set"` = members of `chosen_set`; `"all"` = every member with a subscription; `Id[]` = exactly those members (only `still_coming`). The phone builds the words from the copy deck with `label` and `step`. |
| `{telegram, action}` | Telegram bot (contracts/telegram.md): `edit_count` (coalesce 3 s), `lit`, `ember`, `smaller`, `final`. |
| `{spark_ticket, member_id}` | Issue that member's single-use Spark ticket for this gathering (BR-K-1). |
| `{counter, name, bucket?}` | Increment group counter `name` (docs/product/07-kpis.md) by 1, under `bucket` when present. Exceptions: `headcount_sum` and `lit_minutes_sum` add the number in `bucket`; `headcount_max` keeps the max of the number in `bucket`. See interface change request ICR-1 in handoff 06b. |
| `{sse}` | Publish the new view to `gatheringEvents` listeners. |

Counters the engine emits: `flares_created`, `plans_created`, `flares_lit`, `embers`, `embers_lit`, `plans_lit_step` (bucket `1` to `4`), `plan_fades`, `plan_ember_saves` (new: a Plan lit by the BR-P-3 step-4 save), and at a Lit Flare's Gone `headcount_sum`, `headcount_max`, `lit_minutes_sum`.

## 4. Errors

| Engine error | When | Contract code to return |
| --- | --- | --- |
| `wrong_state` | event not allowed in this state; any non-timer event at Gone; host `answer` | `gone` (410) when `g.state === "gone"`, else `wrong_state` |
| `already_lit` | take-back after Lit (F12) | `already_lit` |
| `not_host` | Done, cancel, +1 by someone else | `not_host` |
| `not_in_set` | fade by a member outside `chosen_set` | `not_in_set` |
| `fade_used` | second fade by the same member | `fade_used` |
| `fade_window_closed` | fade after S + 50% of the step's minutes | `fade_window_closed` |
| `text_yes_cap` | fourth anonymous yes (BR-ID-6) | `text_yes_cap` |
| `unknown_member` | take-back, checks or arrival for a member with no answer record | `unknown_member` |

Errors never change anything: on `ok: false` there is no gathering, no answers and no effects to apply.

## 5. Events, one line each

| Event | Allowed in | Effect on data |
| --- | --- | --- |
| `answer` | Kindling, Ember, Lit | upsert the member's answer (status, rules, ember_only; checks kept); before Lit, re-solve |
| `take_back` | Kindling, Ember | status `taken_back`; re-solve |
| `checks` | Kindling, Ember, Lit | merge results into `checks`, `checks_at = now`; before Lit, Ember pick and re-solve |
| `text_yes` | Kindling, Ember, Lit | `text_yes + 1` (max 3); before Lit, re-solve |
| `fade` | Lit Plans | section 3.1 of 01-algorithm.md |
| `arrival` | Lit | section 4 of 01-algorithm.md |
| `done` | Lit, host | Gone, `thanks_for_coming` |
| `cancel` | Kindling, Ember, host | Gone, `not_this_time` |
| `member_left` | any but Gone | drop the answer and the `chosen_set` entry; the host leaving before Lit ends it |
| `timer` | any | `ember`, `ember_pick`, `gone`, `plan_deadline` as in the tables; `delete` changes nothing (the backend cascades) |

## 6. Testing against it

`npm test` runs `packages/engine/test/` (141 tests, 6 property suites at 300 cases each). Coverage: `npm run -w packages/engine coverage` (lines 100%, branches 96.8%). Benchmark: `npm run -w packages/engine bench`. Test helpers in `packages/engine/test/helpers.ts` (`flare()`, `plan()`, `run(g, [[event, now], ...])`) show how to drive a gathering through its life in a few lines.
