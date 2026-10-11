# Handoff 06b: Core engine to Backend and the lead

From: Core engine. Date: Sat 2026-10-10. Branch: `wp/engine`. Next: Backend (BE3, BE4, BE7 call this), Integrations (effects), lead (integration merge, engine first).

## What is done
| WP | Deliverable | Where | Proof |
| --- | --- | --- | --- |
| CE1 | `solve()`: greatest fixed point for `with`, BR-S-1 order over 4 steps, BR-S-6 ties, Ember-only, text yeses, `need` | packages/engine/src/solve.ts | solve.test.ts (E1-S4 AC2 cases); INV-2 matches an exhaustive oracle on 300 random cases |
| CE2 | Flare `transition()`: rows F1 to F14, race at t0 + 30:00.000 | src/transition.ts, src/create.ts | flare.test.ts: a test per row, race at .000 and .001 |
| CE3 | Plan `transition()`: rows P1 to P11, BR-P-1 and BR-P-4 validation, fades, `still_coming` | same | plan.test.ts: a test per row, fade window edge at S + 45:00.000 and +1 ms |
| CE4 | Ember pick, 60 s default pass, Ember-only counting | same | flare.test.ts F4 to F6, incl. "no bench passes, spot" |
| CE5 | Arrivals, headcount cap, dedupe, outbox window, `spark_ticket` | same | arrivals.test.ts (11 cases) |
| CE6 | `view()`: need and next change time | src/view.ts | view.test.ts, one per state |
| BE7 rules | `sparkAllowed` (BR-K-1), `mergeHotSpots` and `recordLit` (BR-K-6) | src/sparks.ts | sparks.test.ts incl. a merge property |
| Docs | Algorithm, invariants INV-1 to INV-12, complexity, benchmark | docs/engine/01-algorithm.md | |
| Docs | API, effect contract, error mapping, paste-ready backend code | docs/engine/02-api.md | |

Numbers:
- `npm run ci`: green on `wp/engine` (193 tests in the repo, 141 of them in packages/engine; secret scan, lint, typecheck, contracts, build, budget, diagrams all pass).
- Coverage (`npm run -w packages/engine coverage`, v8): lines 100%, statements 98.9%, branches 96.8%, functions 100%. Target 95% met. The uncovered branches are defensive throws for impossible input (a Plan without a step).
- Benchmark B14 (`npm run -w packages/engine bench`, 12 members × 4 rules × 4 steps, 10,000 runs): p50 0.022 ms, p99 0.06 ms, max 0.30 ms on a quiet machine; budget 5 ms. Under load from 9 parallel agents p99 stayed ≤ 0.8 ms; single stalls up to 45 ms were machine pauses that did not repeat. CI asserts p99 ≤ 5 ms.
- Complexity: O(steps × n² × rules), at most about 1,900 rule checks, against about 360,000 for the exhaustive search the rules allow.

## What the backend must know
1. `import { engine, createFlare, createPlan } from "@flare/engine"`. Section 2 of docs/engine/02-api.md is the transaction pattern; effects run after commit, in order.
2. `schedule` replaces a pending job of the same kind; `unschedule` of a missing job is a no-op.
3. The engine already adds 1 to `version` when it changes anything. Save `r.answers` as the full list (rows missing from it were removed by `member_left`).
4. `wrong_state` at Gone should go out as 410 `gone`.
5. Timers are idempotent: late, duplicate or stale jobs return `ok` with no effects.
6. Decisions where the rules were silent are listed in docs/engine/01-algorithm.md section 6 (host is always in and cannot `answer`; Plan Ember-only yeses count only for the step-4 save; early Plan light also needs quorum; Ember lights only after the place is chosen, and its push carries the label).

## Interface change requests
ICR-1 (additive, ICD-1 `Effect`): sum and max counters need a value. Today the engine sends it as a decimal string in `bucket` for `headcount_sum`, `headcount_max` and `lit_minutes_sum` (documented in 02-api.md section 3), which works but overloads `bucket`. Proposed diff in packages/shared/src/icd/engine.ts:

```diff
-  | { type: "counter"; name: string; bucket?: string }
+  | { type: "counter"; name: string; bucket?: string; by?: number; op?: "add" | "max" }
```

If accepted, the engine changes three lines in `end()` to `{ name: "headcount_sum", by: hc }`, `{ name: "headcount_max", by: hc, op: "max" }`, `{ name: "lit_minutes_sum", by: minutes }`.

New counter name (no interface change): `plan_ember_saves`, a Plan lit by the BR-P-3 step-4 save. The KPI doc (docs/product/07-kpis.md) may want a row for it.

## Copy keys added
None. The engine emits push events and labels only; words come from the copy deck on the phone and in the bot.

## Bugs
docs/engineering/bugs/engine.md: BUG-ENGINE-1 (Ember picked c1 before anyone reported), BUG-ENGINE-2 (Lit push after Ember named the original spot). Both fixed with tests.

## Not done
Nothing in the brief is left open.
