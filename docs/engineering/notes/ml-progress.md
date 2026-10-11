# ML progress (wp/ml)

## Done
1. Shared guards `packages/shared/src/prompts/guard.ts`; photo prompt v2 spec and zod schemas in `photo.ts` (API unchanged).
2. Ladder prompt v2 (compact arrays), `enforceLadder()`, template ladder, copy keys `ladder.template.step1..4`.
3. CR-A1 min_step phrases: `evals/datasets/conditions-cr-a1.json`.
4. Rest-loop extractor `prompts/rest-loop.ts` (rules, no model, SRS-PRIV-1); OSM tag prompt and allow-list guard `prompts/osm-tags.ts`.
5. Eval runner `npm run eval -- <task>` (evals/harness), datasets, datasheets, quality bars written before measuring.
6. Runs, all bars pass except conditions CR-A1 on the lab parser (0/4, OD1's job): photo 20/20 within 6 s, ladder 12/12, osm-tags 5/5, rest-loop 16/16 + 4/4.
7. docs/ml (README, model selection, bars, results, cards, failure modes, safety), bugs ml.md, handoff 06e.

## In progress
Nothing.

## Exact next step
Sunday before 10:00 ET (WP ML2): `npm run eval -- all` on the hub Mac with nothing else running; when ODAI's parser lands, `npm run eval -- conditions` must show CR-A1 4/4.
