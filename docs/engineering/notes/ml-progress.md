# ML progress (wp/ml)

## Done
1. Shared guards `packages/shared/src/prompts/guard.ts`; photo prompt v2 spec and zod schemas in `photo.ts` (API unchanged).
2. Ladder prompt v2 (compact arrays), `enforceLadder()`, template ladder, copy keys `ladder.template.step1..4`.
3. CR-A1 min_step phrases: `evals/datasets/conditions-cr-a1.json`.
4. Rest-loop extractor `prompts/rest-loop.ts` (rules, no model, SRS-PRIV-1); OSM tag prompt + allow-list guard `prompts/osm-tags.ts`.
5. Harness `npm run eval -- <task>` (evals/harness), datasets, datasheets (evals/datasheets), quality bars (docs/ml/quality-bars.md, written before measuring).
6. Runs: ladder hub 12/12, p95 6.5 s; osm-tags 5/5 quality; conditions lab baseline 40/40, 15/20, CR-A1 0/4; rest-loop 16/16 + 4/4. Photo hub quality same as lab but 11 s median under Mac load 15 to 67.
7. docs/ml/model-selection.md.

## In progress
docs/ml: model cards, failure modes, AI safety, eval results, README.

## Exact next step
Write the remaining docs/ml files, re-run photo and osm-tags when the Mac load is under 8, write docs/handoffs/06e-ml.md, run `npm run ci`, push.
