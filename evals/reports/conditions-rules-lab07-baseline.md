# Eval: conditions (rules-lab07-baseline tier)

Model: none (rules): lab 07 reference parser (baseline). Prompt: n/a (no model; ADR-0007). Date: 2026-10-11T01:01:08.104Z. Items: 64.

| Bar | Target | Measured | Pass |
| --- | --- | --- | --- |
| core_40 | ≥ 36/40 | 40/40 | yes |
| hard_20 (reported) | report; lab 15/20 | 15/20 | yes |
| CR-A1 min_step phrases | 4/4 | 0/4 | NO |

## Notes

- Fixture: docs/requirements/fixtures/conditions-60.json plus evals/datasets/conditions-cr-a1.json.
- Context: members Fuego, Amor, Shilp, Ammo; tz America/Detroit; now 2026-10-11 11:00 local; kind plan with 4 named steps.

Per-item results: `conditions-rules-lab07-baseline.json`.
