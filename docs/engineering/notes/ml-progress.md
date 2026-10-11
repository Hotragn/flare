# ML progress (wp/ml)

## Done
1. Shared guards `packages/shared/src/prompts/guard.ts`; photo prompt v2 spec and zod schemas in `photo.ts` (API unchanged).
2. Ladder prompt v1, schema and `enforceLadder()`, template ladder (`prompts/ladder.ts`), tests.
3. CR-A1 min_step phrases: `evals/datasets/conditions-cr-a1.json`.

## In progress
Eval harness `npm run eval -- <task>`.

## Exact next step
Write evals/harness (photo, ladder, conditions), datasets with datasheets, run photo and ladder against Ollama, then rest-loop and OSM tag prompts, then docs/ml and handoff.
