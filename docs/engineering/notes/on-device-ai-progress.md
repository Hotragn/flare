# On-device AI progress (wp/on-device-ai)

## Done
1. OD1 rules parser and OD2 read-back: core_40 40/40, hard_20 18/20, 4 min_step phrases.
2. Tier selection, typed fallback (OD4), ladder and Plan logic (FE5).
3. Hub ladder-draft job, per-job budget (BUG-ODAI-1). After merging main: hub parses ToHubV11 (ICR-BE-1), answers ladder jobs with ML's prompts/ladder.ts (LADDER_PROMPT, enforceLadder), warms with the photo system prompt plus a synthetic 64 px JPEG (apps/hub/src/warm-image.ts). Phone template ladder uses ML's copy keys ladder.template.step1-4 (my ladder.tpl.* keys removed).
4. ICD-8 probe (OD3), device check cards, Mac Chrome run.
5. /ai/ status screen, privacy proofs (unit + Chrome network capture).
6. `npm run hub:field` (ML4): soak ran 273 min, 0 drops, 1 restart (a deliberate kill, back in 1 s), model loaded throughout.
7. docs/ai-runtime, OD5 rest-loop parser, handoff docs/handoffs/06f-on-device-ai.md, bugs BUG-ODAI-1, -2.
8. `npm run ci` green after the merge: 40 files, 407 tests, web JS 95.4 KB gz.

## Stopped by the lead (usage)

## Exact next step (for the lead)
Edit docs/handoffs/06f-on-device-ai.md: replace "SOAK_RESULT" with the soak line above; mark interface change request 1 as done by ICR-BE-1 (main), and say the hub now uses ML's ladder prompt v2 (my compact prompt is gone). Add to docs/ai-runtime/performance.md: 01:57 ET, load average up to 104, image warm-up 7.7 s, 5 direct photos 3.9 to 7.5 s (5/5 usable), ML ladder prompt median 5.1 s, 5/5 within 8 s.
