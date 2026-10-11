# On-device AI progress (wp/on-device-ai)

## Done
1. OD1 rules parser and OD2 read-back: core_40 40/40, hard_20 18/20, 4 min_step phrases.
2. Tier selection, typed fallback (OD4), ladder and Plan logic (FE5).
3. Hub ladder-draft job, per-job budget (BUG-ODAI-1), compact ladder prompt (median 4.9 s).
4. ICD-8 probe (OD3) and device check cards; Mac Chrome run.
5. /ai/ status screen with try-it field; privacy proofs (unit and Chrome network capture).
6. `npm run hub:field` (ML4); docs/ai-runtime (README, privacy, performance, measured-not-shipped).
7. OD5 rest-loop request parser.
8. Handoff docs/handoffs/06f-on-device-ai.md.

## In progress
- 30-minute hub:field soak against a local server on port 8843 (started 21:18 ET).

## Exact next step
Record the soak result in the handoff (replace SOAK_RESULT), run `npm run ci`, push, final report.
