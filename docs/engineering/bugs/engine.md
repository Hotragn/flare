# Engine bugs (wp/engine)

BUGLOG format. The lead merges these into docs/BUGLOG.md.

## BUG-ENGINE-1: Ember picked c1 before anyone reported
- Date: 2026-10-10. Area: engine (CE4).
- Symptom: entering Ember with candidates and no yes records set `ember_choice = c1` at once (test "F4: timer ember at t0+30:00 enters Ember" expected null).
- Cause: `pickEmber` checked "every voter has reported" over an empty list, which is vacuously true; the host was not required to report.
- Fix: the host always votes; before the 60 s default the pick waits until the host's record exists and every voter has a result for every candidate.
- Proof: `npx vitest run packages/engine/test/flare.test.ts` 56/56 after the fix, 5 failing before.

## BUG-ENGINE-2: Lit push after Ember named the original spot
- Date: 2026-10-10. Area: engine (CE2, CE4).
- Symptom: a Flare lit in Ember pushed `label: "spot"` instead of the chosen bench (`c2`).
- Cause: `flareLabel` read the label only while `state === "ember"`; `light()` changes the state before building the push.
- Fix: `flareLabel` returns `ember_choice ?? "spot"`; `ember_choice` is only ever set in Ember and kept at Lit.
- Proof: test "F5: picks the first candidate every yes passed once all have reported" checks the push label `c2`.
