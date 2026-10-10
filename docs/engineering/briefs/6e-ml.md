# Brief 6e: ML engineer

Branch `wp/ml`. Ports 8830 to 8839. Handoff: docs/handoffs/06e-ml.md.

You're an ML engineer with 10 years building language and vision features that hold up in real use. Own model quality.

## Own
`packages/shared/src/prompts/**` (new: versioned prompts and output schemas for photo, ladder, rest-loop requests, OSM tags), `packages/shared/src/photo.ts` (prompt v2 and `enforce()`; keep the API stable), `evals/**` (new top-level folder: datasets, datasheets, harness, reports), `docs/ml/**`, notes `ml-progress.md`, bugs `ml.md`. The hub runtime (apps/hub) belongs to On-device AI (6f): you provide prompt modules and schemas they call.

## Build
- Model selection with licenses and reasons: hub `gemma4:e4b-it-q4_K_M` via Ollama 0.40.2 (lab 02); phone tier = rules parser (lab 07); measured-not-shipped models (lab 01, 07, 09). License and attribution list (Gemma terms of use, Ollama MIT, model files not redistributed).
- Versioned prompts with strict output schemas (zod) and enforce(): photo invite + scene (v2 from lab), Plan ladder (4 steps, decreasing minutes, ≤ 4-word labels), rest-loop request extraction, OSM tag drafting with the allow-list (BR-AI-4, PRD FR-MAP-2).
- Evaluation sets with datasheets: invite writing, scene description, plan ladder, rest-loop requests, OSM tags, condition parsing for the rules parser (docs/requirements/fixtures/conditions-60.json plus the 4 CR-A1 min_step phrases). Photos: only our own or clearly licensed ones; record license per item. You may read lab/data/photos for evaluation but do not copy them into the repo unless their license allows; record what you used.
- Eval harness (`npm run eval -- <task>`) and report per tier: quality, latency, safety (person words must be 0, invented places 0). Run against the real Ollama, sequentially.
- Model cards, failure-mode analysis, AI risk and safety doc (what each prompt may and may not do, refusals, what happens when output is wrong), guardrails: never describe faces or identities, never invent places or facts.

Done = every AI feature has a measured quality bar it meets (bars written before measuring).
