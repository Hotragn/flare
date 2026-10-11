# Handoff 06e: ML

From: ML engineer (branch `wp/ml`). To: engineering lead, On-device AI (ODAI), Backend (BE), Website (WEB), Analyst. Date: Sat 2026-10-10.

## What was built

| Deliverable | Where | Proof |
| --- | --- | --- |
| Model selection, settings, licenses, attribution | docs/ml/model-selection.md | Lab 01, 02, 07, 09 numbers; Gemma terms, Ollama MIT, weights not redistributed |
| Photo prompt v2 as a versioned spec; `enforce()` (API unchanged) now uses the shared guard; zod `PhotoAnswer`, `PhotoDraft` | packages/shared/src/photo.ts | Old photo tests pass unchanged |
| Shared guard: person-word filter (adds clothing and family words; keeps "people", "kids' playground", "tall trees", "a couple of benches"), JSON extraction, word clip, `HUB_MODEL`, `OLLAMA_OPTIONS` | packages/shared/src/prompts/guard.ts | prompts.test.ts, 11 guard cases |
| Plan ladder prompt v2, `ladderUserPrompt()`, `enforceLadder()` (per-step template fill, duplicate and invented-name checks), `templateLadder()`, zod `Ladder` | packages/shared/src/prompts/ladder.ts | ladder.test.ts 14 tests; template valid for all 561 totals |
| OSM tag prompt v1, `OSM_ALLOW` (13 keys of E17-S1 with allowed values), `enforceOsmTags()`, `validTag()` | packages/shared/src/prompts/osm-tags.ts | prompts.test.ts; eval 5/5 |
| Rest-loop request extractor (rules, no model, SRS-PRIV-1), zod `RestRequest`, `restReadBack()` ≤ 12 words | packages/shared/src/prompts/rest-loop.ts | eval 16/16 plain, 4/4 hard |
| CR-A1 eval phrases (4 `min_step`) | evals/datasets/conditions-cr-a1.json | Run against the lab 07 parser: 0/4, as expected |
| Eval sets and datasheets (photos with per-item license, ladder asks, rest-loop requests, OSM tags) | evals/datasets/, evals/datasheets/ | Photos read in place from lab/, not copied |
| Eval runner `npm run eval -- <task> [--tier] [--limit] [--parser] [--strict]` with per-tier reports | evals/harness/, evals/reports/ | evals/test/harness.test.ts |
| Quality bars (written before measuring), results, model cards, failure modes, AI safety | docs/ml/ | See below |

## Numbers (real Ollama, sequential, shared Mac at load 13 to 67)

| Task | Result |
| --- | --- |
| photo hub | 20/20 usable within 6 s, median 3786 ms, max 5292 ms, 0 person words, 0 invented names, key fact 19/20 |
| ladder hub (v2) | 12/12 hub answers used, p95 6519 ms, 0 person words, 0 invented names (v1 was 6/12, p95 8757 ms) |
| osm-tags hub | 5/5 parsed, 5/5 required tags, 0 off-list keys, p95 1362 ms |
| rest-loop rules | AC1 passes, 16/16 plain, 4/4 hard, read-backs ≤ 12 words |
| conditions (lab 07 parser) | core_40 40/40, hard_20 15/20, CR-A1 0/4 |
| photo, ladder, osm-tags rules | template and picker floors pass |

Commands: `npm run eval -- photo`, `-- ladder`, `-- osm-tags`, `-- rest-loop`, `-- conditions`. Tests: `npm test` (all green). `npm run ci` green on this branch.

## For ODAI (hub runtime, apps/hub)

1. **Warm up with the real photo system prompt and an image**, not `"Reply with {}"` text-only. With a text-only warm-up the first photos took 12 to 17 s; with the real prompt and an image, 20/20 ran within 6 s (docs/ml/eval-results.md §1, failure mode F16). `apps/hub/src/ollama.ts` warms text-only today.
2. Import the specs instead of literals: `PHOTO_PROMPT` (system, user, `numPredict` 128, `budgetMs` 6000), `LADDER_PROMPT` + `ladderUserPrompt(input)` + `enforceLadder(text, input)`, `OSM_PROMPT` + `enforceOsmTags(text)`; `HUB_MODEL`, `OLLAMA_OPTIONS` from `@flare/shared`.
3. Ladder: if `enforceLadder` returns null or the budget runs out, answer `ok:false` (`unusable_answer`/`timeout`) and the server uses `templateLadder(total_minutes)`; the server runs `enforceLadder` again, like `enforce()` for photos.
4. OD1 must make the 4 CR-A1 phrases pass: `npm run eval -- conditions` picks up `apps/web/src/lib/conditions/index.ts` automatically (exports `parse` or `conditions.parse`, ICD-7).
5. OD5 can wrap `parseRestRequest()` and `restReadBack()` directly, or pass its own module with `npm run eval -- rest-loop --parser <path>`.

## Interface change requests

1. **hub-protocol.ts: add the ladder job that asyncapi already has** (owner: architect/ODAI). Exact diff:

```diff
-export const JobHeader = z.object({
+export const PhotoJobHeader = z.object({
   type: z.literal("job"),
   id: z.string().uuid(),
   kind: z.literal("photo-draft"),
   bytes: z.number().int().positive().max(2_000_000),
   mime: z.literal("image/jpeg"),
 });
+export const LadderJob = z.object({
+  type: z.literal("job"),
+  id: z.string().uuid(),
+  kind: z.literal("ladder-draft"),
+  ask: z.string().max(80),
+  total_minutes: z.number().int().min(40).max(600),
+  weather: z.object({ rain_likely: z.boolean().optional(), temp_f: z.number().int().optional() }).optional(),
+});
+export const JobHeader = z.discriminatedUnion("kind", [PhotoJobHeader, LadderJob]);
 ...
   draft: z.object({ invite: z.string().min(1), alt: z.string().min(1) }).optional(),
+  ladder: z.array(z.object({ step: z.number().int().min(1).max(4), label: z.string(), minutes: z.number().int() })).length(4).optional(),
```
   `ToHub` then needs `z.union([JobHeader, Ping])` because both job kinds share `type: "job"`.

2. **New hub job `osm-tags` (P1, Fix the map)** in asyncapi.yaml and hub-protocol.ts: a job header like `photo-draft` with `kind: "osm-tags"`, followed by one binary JPEG frame; result adds `tags: { type: object, additionalProperties: { type: string } }`. The server runs `enforceOsmTags()` again before use. Only if the founder wants hub tag drafts for the field test; the manual picker covers it otherwise.
3. **Analyst: add the 4 CR-A1 phrases** to docs/requirements/fixtures/conditions-60.json (CR-A1 already asks for it). Until then they live in evals/datasets/conditions-cr-a1.json.

## Files outside my paths (small, needed for the eval runner)

- `package.json`: script `"eval": "node evals/harness/run.ts"`.
- `tsconfig.json`: include `evals/**/*.ts`.
- `vitest.config.ts`: include `evals/test/**/*.test.ts`.
- `biome.json`: ignore `evals/reports` (generated eval output).

## Copy keys added (design/prototype/src/lib/copy/deck.json, copy-lint 0 problems)

`ladder.template.step1` "The full plan", `ladder.template.step2` "A shorter loop", `ladder.template.step3` "A quick lap", `ladder.template.step4` "A quick hello". A test checks they equal `TEMPLATE_LABELS`.

## For WEB

Add the Gemma attribution line to the "How it works" page: "Gemma is provided under and subject to the Gemma Terms of Use found at ai.google.dev/gemma/terms."

## Not done, and why

- **No phone-tier model.** By design (ADR-0007, lab 01, 07, 09); documented in model-selection.md.
- **No hub prompt for rest-loop requests.** Requests may not leave the phone (SRS-PRIV-1, architecture 07 "Never"), so the job is a rules extractor with a schema.
- **Field photos not in the eval.** None exist yet; add Fairlane photos after the field test only with the people's consent, and keep them out of the repo.
- **Final RC re-run (WP ML2).** Run `npm run eval -- all` on the hub Mac with nothing else running, Sunday before 10:00 ET. The conditions bar will stay red until OD1 lands `min_step`.

## Bugs

docs/engineering/bugs/ml.md: BUG-ML-1 (rest-loop number words), BUG-ML-2 (quote in suspect-name check), BUG-ML-3 (ladder v1 over budget).
