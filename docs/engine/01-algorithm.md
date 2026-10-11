# Engine algorithm and invariants

Version 1.0, Sat 2026-10-10. Owner: Core engine. Code: `packages/engine/src/`. Interface: ICD-1 (`packages/shared/src/icd/engine.ts`). Rules: docs/requirements/03-business-rules.md. Transition tables: docs/architecture/04-state-machines.md.

The engine is three pure functions. No I/O, no clock reads (`now` is an argument), no randomness, and inputs are never mutated (each call works on a `structuredClone`). Same input, same output (BR-S-5).

## 1. The solver (`solve.ts`)

### 1.1 What a set must satisfy
A candidate set always contains the host (BR-Q-1). Every other member in it must have `status: "yes"` and all of their rules must hold (BR-C-2):

| Rule | Holds when | Source |
| --- | --- | --- |
| `with(X)` | X is in the same set (the host counts) | BR-C-3 |
| `after(T)` | start ≥ T. Flare start = now before Lit, `lit_at` after. Plan start = S | BR-C-5 |
| `back_by(T)` | start + duration ≤ T. Flare: 60 min. Plan: the step's minutes | BR-C-6 |
| `max_walk(M)` | always true in the engine; the phone folds it into `checks` | BR-C-7 |
| `max_step(n)` | step ≥ n. Ignored for Flares | BR-C-8 |
| `min_step(n)` | step ≤ n. Ignored for Flares | ADR-0016 |
| place check | `checks[label] !== false`; a missing result passes | BR-C-7, BR-E-3, BR-E-4 |

The place label is `spot` for a Flare in Kindling, `ember_choice` once Ember has picked, and `plan.steps[k].place` for a Plan at step k.

"Ember only" yeses are candidates only in a Flare's Ember (BR-Q-6) and in a Plan's step-4 save at the deadline (BR-P-3). Anonymous text yeses (BR-ID-6) add to the count but never appear in the set.

### 1.2 Search: the greatest fixed point
For one context (one step, one place, one start):
1. Start with the host plus every yes that fits alone (all rules except `with`, plus the place check).
2. Remove every member whose `with` targets are missing. Repeat until a pass removes nobody (BR-S-3).
3. Return the ids sorted ascending.

**Why this is the best set and not just a good one.** Call a set valid if every member fits alone and every `with` target of every member is inside it. If A and B are valid, A ∪ B is valid: each member's targets sit inside its own set, so inside the union. So among all valid sets there is exactly one largest: the union of all of them. The removal loop never removes a member of that union (by induction, each removed member has a target outside every valid set), and what remains is valid, so it returns exactly that union. The exhaustive search that BR-S-4 allows gives the same answer; property test INV-2 checks this against a brute-force oracle over all 2^n subsets.

### 1.3 Ordering across steps (BR-S-1) and ties (BR-S-6)
For a Plan the fixed point runs once per step (1 to 4). Candidates compare by:
1. more people (set size),
2. higher step (smaller step number),
3. earlier start,
4. lowest member ids, compared element by element (BR-S-6).

A Flare has one context, so only (1) applies. Within one context the largest valid set is unique (1.2), so (4) can never decide between two different sets of equal size there; it is implemented anyway in `compareCandidates` and used by the oracle. A Plan has one start (S), so (3) never decides either.

### 1.4 Need (BR-Q-4)
`need = max(0, quorum − (|set| + text_yes))`, from the best candidate. For a Plan in Kindling that is the best over all steps, which is "the highest step that could still light" (SRS-PLAN-11). `lights` is `need === 0`. At Lit and Gone the set is fixed: `solve` returns `chosen_set`, `need: 0`, and `lights` true if it ever lit.

### 1.5 Complexity
n ≤ 11 candidates besides the host (BR-S-4), r ≤ 4 rules each, s ≤ 4 steps.
- Fits-alone filter: O(n·r) per step.
- Removal loop: at most n passes (each removes at least one member or stops), each O(n·r): O(n²·r) per step.
- Total: O(s·n²·r) = 4 × 121 × 4 ≈ 1,900 rule checks at the very worst.
- The exhaustive search would be O(s·2^n·n·r) = 4 × 2,048 × 44 ≈ 360,000 checks.

Benchmark (budget B14, 12 members × 4 rules × 4 steps; worst case is a `with` chain that unravels one member per pass): `npm run -w packages/engine bench`, 10,000 runs after a 200-run warm-up, Node 24 on the build Mac.

| Run | p50 | p99 | max |
| --- | --- | --- | --- |
| Quiet machine (3 runs) | 0.022 ms | 0.058 to 0.061 ms | 0.24 to 0.30 ms |
| Under load (9 agents running) | 0.046 to 0.063 ms | 0.47 to 0.80 ms | 32 to 45 ms (single GC or scheduler stalls) |

The CI test `bench.test.ts` asserts p99 ≤ 5 ms over 2,000 runs. The single-run maximum under heavy load is a machine stall, not solver work: it did not repeat on a quiet machine.

## 2. Flare machine (`transition.ts`)

| From | Event | Result | Row |
| --- | --- | --- | --- |
| Kindling | answer, take-back, checks, text yes, member left; now ≤ t0 + 30:00.000 | re-solve; Lit if `lights`, else publish the count | F2, F3 |
| Kindling | same, now > t0 + 30:00.000 | record only; the `ember` timer decides | BR-F-2 |
| Kindling | timer `ember`, now ≥ t0 + 30:00 | Ember: quorum 2, job `gone` at t0 + 60:00 | F4 |
| Ember | checks; timer `ember_pick` | choose the place (2.1); then re-solve | F5 |
| Ember | answer-type event, place chosen | re-solve with Ember-only yeses; Lit if `lights` | F6 |
| Ember | timer `gone`, now ≥ t0 + 60:00 | Gone, not this time | F7 |
| Kindling, Ember | host cancel | Gone, not this time | F8 |
| Lit | host Done; timer `gone` at t0 + 4 h | Gone, thanks for coming | F9 |
| Lit | yes, can't make it, text yes, checks | record; set and state unchanged | F10, F11 |
| Lit | take-back | `already_lit` | F12 |
| Gone | any non-timer event | `wrong_state` (the API answers 410 `gone`) | F13 |
| Gone | any timer, incl. `delete` | no change, no effects | F14 |

The race (BR-F-2): an answer at exactly t0 + 30:00.000 lights in Kindling; at .001 it is recorded and counted when Ember starts. A queued `ember` timer that runs after Lit sees `state = lit` and does nothing. Tests: "F2 race" at .000 and .001.

Every timer checks its own due time against `now` and does nothing if early or if the state has moved on. That makes stale or duplicated jobs harmless.

### 2.1 Ember pick (BR-E-1 to BR-E-4)
Voters: every yes (Ember-only included) and the host. The Ember spot is the first label in `ember_candidates` (nearest first) that no voter failed; if none, `spot`.
- With no candidates the choice is `spot` at once when Ember starts.
- Before the 60 s default, the pick happens as soon as the host and every voter have a result for every candidate, and the `ember_pick` job is cancelled.
- At the `ember_pick` timer (Ember start + 60 s), missing results count as pass (BR-E-4).
- Ember waits for the place before it can light, so the Lit notice names the bench people walk to.
- The "Smaller plan: 15 min at {bench}." push and the Telegram `ember` post go out when the place is chosen, carrying the label.

## 3. Plan machine

| From | Event | Result | Row |
| --- | --- | --- | --- |
| none | create | validated by BR-P-1, BR-P-4, BR-Q-2 (`createPlan`) | P1 |
| Kindling | answer-type event before D | lights at step 1 only if every other group member said yes with no rules, all pass the step-1 check, and the count reaches quorum | P2 |
| Kindling | same | publish the count (need at the best step) | P3 |
| Kindling | timer `plan_deadline`, now ≥ D | best step reaches quorum: Lit at that step | P4 |
| Kindling | same | else ≥ 2 fit step 4 with Ember-only yeses: Lit at step 4, Ember save | P5 |
| Kindling | same | else Gone, not this time | P6 |
| Lit, step k < 4 | fade by a set member, once, now ≤ S + 50% of minutes(k) | step k + 1 (3.1) | P7 |
| Lit, step 4 | fade, same guards | fade recorded, no step change | P8 |
| Lit | fade, guard fails | `not_in_set`, `fade_used`, `fade_window_closed`, checked in that order | P9 |
| Lit | Done; timer `gone` at S + minutes(k) + 60 min | Gone, thanks for coming | P10 |
| Kindling | host cancel | Gone, not this time | P11 |

### 3.1 Fades (BR-P-5, BR-P-6, ADR-0016)
1. Mark the member faded; move to step k + 1.
2. Re-solve at the new step with the whole current set forced in, so nobody is removed and new fits are added.
3. For each set member (not the host): `still_coming = true` when their own rules fail at the new step and set. A `still_coming` push goes only to members who just became true.
4. Push `plan_smaller` to everyone with the step and its place label (no count, no names: BR-P-7); move the `gone` job.

## 4. Arrivals and headcount (BR-H-1 to BR-H-5, BR-K-1)
- Headcount starts at 1 (the host) when the gathering lights.
- Self "I'm here" or a host +1 for a member: counted once per member (`arrived_at` set once); each gives a `spark_ticket` effect.
- Host +1 "Someone else": adds 1, no ticket.
- The host's own arrival records a ticket; the headcount stays (the host is already the 1).
- Cap: headcount ≤ yes-count + 3, yes-count = host + member yeses + text yeses. Taps beyond it are ignored, ticket included.
- Only while Lit. A recorded time before `lit_at` is ignored; a time after `now` is clamped to `now` (phone clocks are not trusted, BR-TIME-1).

## 5. Invariants and their tests

| Id | Invariant | Rule | Test |
| --- | --- | --- | --- |
| INV-1 | Same input, same output, whatever the order of `answers` | BR-S-5, BR-S-6 | properties.test.ts "INV-1"; also checked on every step of INV-6 |
| INV-2 | The fixed point equals the exhaustive search (set and step) | BR-S-1, BR-S-4 | properties.test.ts "INV-2" (oracle over all subsets and steps) |
| INV-3 | The host is in every set; every other member is a yes whose rules all hold; ids sorted | BR-Q-1, BR-C-2, BR-S-3 | properties.test.ts "INV-3" |
| INV-4 | Adding a yes with no rules never shrinks the set | CE1 | properties.test.ts "INV-4" |
| INV-5 | need = max(0, quorum − (set + text yeses)); lights ⇔ need = 0 | BR-Q-3, BR-Q-4 | properties.test.ts "INV-5" |
| INV-6 | State only moves forward: Kindling, Ember, Lit, Gone. Gone is absorbing | BR-F-7 | properties.test.ts "INV-6 to INV-10" |
| INV-7 | `version` never decreases; it rises by 1 on every transition that changes data | ICD-1 | same |
| INV-8 | headcount ≤ yes-count + 3; text yeses ≤ 3 | BR-H-4, BR-ID-6 | same |
| INV-9 | While Lit, nobody leaves the set (except a member who leaves the group); a step moves by at most 1 | BR-F-7, BR-P-6 | same |
| INV-10 | Inputs are never mutated | purity | same, and flare.test.ts "purity" |
| INV-11 | Hot spots merge: count is the max per place; merge is commutative on counts and idempotent | BR-K-6 | sparks.test.ts "BR-K-6 property" |
| INV-12 | B14: 12 × 4 × 4 solves within 5 ms at p99 | B14 | bench.test.ts |

Each property runs 300 random cases per `npm test` (fast-check 4.10.2).

## 6. Decisions where the rules were silent
1. The host is always in the set; the host cannot send an `answer` event (`wrong_state`). The host's checks and arrival create a host answer record.
2. Text yeses count toward quorum and the headcount cap but never toward `with`.
3. A Plan counts Ember-only yeses only for the step-4 save (BR-P-3 calls it an Ember save).
4. BR-P-2's early light also needs the count to reach quorum and every member to pass the step-1 place check.
5. A member who leaves the group loses their answer and leaves `chosen_set` (SRS-PRIV-8: we keep no more than we need). The host leaving before Lit ends the gathering, not this time.
6. Gone ends set `done_at = now` for every ending, lit or not.
