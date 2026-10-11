# Model cards

One card per AI job. Model details and licenses: `model-selection.md`. Numbers: `eval-results.md` and `evals/reports/`. Bars: `quality-bars.md`.

## 1. Photo to invite + scene (`photo-invite@2`)

- **Code.** `packages/shared/src/photo.ts`: `SYSTEM_PROMPT`, `USER_PROMPT`, `PHOTO_PROMPT`, `enforce()`, `PhotoDraft`. Ported from lab spike 02 (prompt v2).
- **Input.** One 768 px JPEG from the host's phone, through the hub relay. Nothing else: no location, no names.
- **Output.** `{invite ≤ 6 words, alt ≤ 20 words}`. The alt text is the scene line people hear with VoiceOver.
- **Tiers.** Hub (Gemma 4 E4B, 6 s budget, one retry inside it), then template ("Outside right now. Come?" plus a scene from map-pack facts, built by FE/OD4). No phone model (lab 01, 09).
- **Guard.** `enforce()` on the hub and again on the server: JSON only, clip to 6 and 20 words, strip emoji and `#`, reject face, identity, age, race, gender, body and clothing words (`FACE`, `IDENTITY` in `prompts/guard.ts`). A rejected answer goes to the template; it is never edited into something else.
- **Intended use.** A draft the host edits or accepts (SRS-CRE-4). Never sent without the host's tap.
- **Not for.** Describing people, reading faces, counting people, judging a place's safety, naming businesses the photo does not show.
- **Measured.** See eval-results.md §1. Text is word for word the lab's (temperature 0, seed 42).
- **Known limits.** Misreads one sign ("Scentral Park" for "Sentral Bark"). Calls a shopping cart a "red mesh trash receptacle" (p21). Slow when the Mac is busy: the hub must run nothing else heavy.

## 2. Plan ladder (`ladder-draft@2`)

- **Code.** `packages/shared/src/prompts/ladder.ts`: `LADDER_SYSTEM`, `ladderUserPrompt()`, `LADDER_PROMPT`, `enforceLadder()`, `templateLadder()`, `Ladder`.
- **Input.** asyncapi `ladderJob`: `ask` (≤ 80 chars, cleaned of quotes, braces and line breaks), `total_minutes` 40 to 600, optional `{rain_likely, temp_f}`. No places, no names, no location (places come from the phone's map pack).
- **Output.** 4 steps `{step, label ≤ 4 words, minutes}`, step 1 = total, strictly decreasing, each ≥ 5 (BR-P-4).
- **Tiers.** Hub (8 s budget), then template: minutes = total × 1, 0.5, 0.25, 0.125 rounded to 5; labels "The full plan", "A shorter loop", "A quick lap", "A quick hello" (copy keys `ladder.template.step1..4`).
- **Guard.** Per step: a label that is missing, repeated, has person words, or has a capitalised name not in the ask is replaced by that step's template label (FR-PLAN-4). Minutes that break BR-P-4 are replaced as a set. Step 1 is forced to the total. No usable label at all: the whole ladder is the template.
- **Version history.** v1 asked for `{"steps":[{step,label,minutes}]}`: 6/12 within budget, median 7.5 s, p95 8.8 s. v2 asks for two short arrays: 12/12, median 5.5 s, p95 6.5 s, same label quality.
- **Not for.** Choosing places, times or who comes. The host edits every step.

## 3. OSM tag draft (`osm-tags@1`)

- **Code.** `packages/shared/src/prompts/osm-tags.ts`: `OSM_SYSTEM`, `OSM_PROMPT`, `OSM_ALLOW`, `enforceOsmTags()`, `validTag()`, `OsmTags`.
- **Input.** One photo of a street feature. Location comes from the phone and never enters the prompt.
- **Output.** Tags whose keys are only the 13 in E17-S1 AC1, each with an allowed value (`amenity` limited to bench, drinking_water, toilets, shelter, waste_basket, bicycle_parking, fountain; yes/no keys; whole numbers for `seats` and `step_count`; a simple `opening_hours` pattern).
- **Tiers.** Hub (8 s budget), then the manual tag picker built from `OSM_ALLOW` (P1, Fix the map).
- **Guard.** Every other key or bad value is dropped and counted. A person reviews every tag (FR-MAP-3); export only, nothing sent to OSM (FR-MAP-4); the photo is deleted after drafting (FR-MAP-5).

## 4. Rest-loop request (`rest-extractor@1`, no model)

- **Code.** `packages/shared/src/prompts/rest-loop.ts`: `parseRestRequest()`, `RestRequest`, `restReadBack()`.
- **Why no model.** Requests never leave the phone (SRS-PRIV-1, architecture 07 says hub "Never") and no phone model ships (ADR-0007). A small phone model was measured on the closest task, conditions (lab 07), and lost to rules.
- **Output.** `{minutes 10-240 | null, rest_gap_m 50-1000 | null, prefer[], avoid_steps | null, mobility_hint}`; `null` overall sends the person to the pickers. Read-back ≤ 12 words, for example "40 min, bench every 200 m, trees."

## 5. Conditions (rules parser, no model; owned by ODAI)

- **Code.** `apps/web/src/lib/conditions` (ODAI, ICD-7). ML owns the eval only: `npm run eval -- conditions [--parser <module>]`.
- **Measured.** Lab 07 parser: core_40 40/40, hard_20 15/20, CR-A1 0/4 (it has no `min_step` yet). OD1 must reach 4/4.
