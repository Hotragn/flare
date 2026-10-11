# ML

Owner: ML (wp/ml). What every AI job does, how well, and how we know.

| File | What |
| --- | --- |
| [model-selection.md](model-selection.md) | Models that ship and the ones measured and dropped; settings; licenses and attribution |
| [quality-bars.md](quality-bars.md) | The bar for every job and tier, written before measuring |
| [eval-results.md](eval-results.md) | Measured numbers and samples |
| [model-cards.md](model-cards.md) | One card per job: input, output, tiers, guard, limits |
| [failure-modes.md](failure-modes.md) | What went wrong, why, what catches it |
| [ai-safety.md](ai-safety.md) | What each prompt may and may not do, refusals, wrong-output handling |

## Code

- `packages/shared/src/photo.ts`: photo prompt v2, `enforce()` (API unchanged), `PHOTO_PROMPT`, `PhotoDraft`.
- `packages/shared/src/prompts/`: `guard.ts` (person-word filter, JSON extraction, clip, shared Ollama options), `ladder.ts`, `osm-tags.ts`, `rest-loop.ts`. All exported from `@flare/shared`.
- The hub runtime (apps/hub, ODAI) calls these: system prompt, user prompt, `numPredict`, `budgetMs` from the `*_PROMPT` spec, then the matching `enforce*()`.

## Run the evals

```sh
npm run eval -- photo            # hub, 20 photos, needs Ollama with gemma4:e4b-it-q4_K_M
npm run eval -- ladder           # hub, 12 asks
npm run eval -- osm-tags         # hub, 5 photos
npm run eval -- conditions       # rules; --parser <module> for ODAI's parser
npm run eval -- rest-loop        # rules
npm run eval -- all --strict     # everything; exit 1 if a bar fails
npm run eval -- photo --tier rules
```

Model calls run one at a time (the Mac's Ollama is shared). Each run writes `evals/reports/<task>-<tier>.{md,json}`. Photos are read from `lab/data/photos` in place (set `FLARE_LAB_DIR` if lab/ is elsewhere); they are never copied into the repo. Datasets: `evals/datasets/`. Datasheets: `evals/datasheets/`.
