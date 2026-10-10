# ADR-0016: After a fade nobody is removed; add `min_step`; a private "Still coming?"

Status: Accepted. Date: 2026-10-10. Settles OQ-2 (handoff 02) with the founder's preference.

## Decision
1. **Keep everyone.** BR-P-6 stands: a fade lowers the step by one, re-solves, adds members who now fit, removes nobody.
2. **Add `min_step(n)`:** holds when the chosen step number ≤ n (step 1 is biggest). "Only the long one" parses to `min_step(1)`; "at least the park loop" to `min_step(2)`. The solver uses it at the deadline like any rule (BR-S-1).
3. **Private note.** After a fade, any member of the set whose own rules fail at the new step gets `still_coming: true` on `GET /me` and a push "Plan changed to {step}. Still coming?" (`push.stillComing`). No action is needed; "Can't make it" is there if they want it. Nobody else learns anything.
4. Read-back fragment: "step {k} or bigger" (`readback.rule.minStep`), already in the copy deck.

## Consequences
- Change request CR-A1 to the analyst: add `min_step` to BR-C-1 and SRS-COND-1, and 4 phrases to `docs/requirements/fixtures/conditions-60.json` ("only the long one", "the full walk or nothing", "at least the park loop", "step 2 or bigger"). The rules parser gets them in the same pull request.
- The OpenAPI `Rule` schema already has `min_step`.
