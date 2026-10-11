# ADR-0025: The Plan ladder as a Mastra agent, behind a flag

Status: Proposed (S2, Sun 2026-10-11; follow-ups the same day). Off by default (`LADDER_AGENT=1` turns it on). Keeps ADR-0007 (8 s hub budget), ADR-0021 (allow-listed spans) and ADR-0022 (DigitalOcean only when the hub is absent).

## Context
`POST /api/v1/drafts/ladder` sends the ask line, the minutes and the phone's coarse weather to the hub. It runs `enforceLadder()` on the answer and falls back to `templateLadder()`. We wanted the draft to come from an agent with real tools: sunset, a weather window, places from the map pack, and the step templates. The phone's answer, what the Mac exposes and what leaves the server had to stay as they are.

## Decision
- **Library:** `@mastra/core` **1.68.0**, pinned exact.
  - Published 2026-09-22, the only release that day, and a week before the next one. 1.70.0 and 1.71.0 came out the same day (09-24), so we skipped both.
  - Loaded with a dynamic `import()` on the first agent request, so with the flag off nothing loads.
  - We use `Agent` and `createTool` only, never the `Mastra` class.
  - Mastra sends usage events to PostHog by default, so we set `MASTRA_TELEMETRY_DISABLED=1` before the import (`apps/server/src/agent/no-telemetry.ts`).
- **Request:** two new optional fields in `LadderRequest` (zod and openapi.yaml):
  - `start_at` (ISO date-time): when the plan starts.
  - `area` (1 to 40 characters, digits refused): a map-pack place label such as "Ford Woods Park", or the pack name "fairlane". Refusing digits means it can never carry coordinates.

  The tools read both; neither goes to the hub or to DigitalOcean. Without `start_at` the tools use now, as before.
- **Tools** (`apps/server/src/agent/tools.ts`). All are local and pure except the weather tool:
  - `sunset`: the NOAA math, copied from `apps/web/src/lib/map/sun.ts` into `apps/server/src/agent/sun.ts` (the server imports no web code). It works on the area's 0.1° cell and the plan's day, gives local time in America/Detroit, and says whether the plan ends after dark.
  - `weather_window`: the api.weather.gov hourly forecast for the area's 0.1° cell, reduced to `{rain_likely, temp_f}` for `[start_at, start_at + minutes)`. Same rules as `apps/web/src/lib/map/weather.ts`. It has a 2.5 s cap, returns `null` on any failure, and is skipped when the phone already sent weather.
  - `nearby_places`: the Fairlane pack (`apps/web/static/maps/fairlane.json`), read once and reduced to 36 named parks, water, woods and shelters. It returns the labels the ask names, the five closest labels, and counts. Never coordinates.
  - `step_templates`: `templateLadder(total)`.
- **Area lookup:** `resolveArea()` maps the area label to a 0.1° cell. A label the pack doesn't know falls back to the pack centre. The cell is used inside tools and cache keys only.
- **Caches:** they make the tools cheap after the first request.
  - The forecast is cached per (cell, 15 minutes of the clock), and any window is reduced from it.
  - Sunset is cached per (cell, 15 minutes of the start).
  - Each cache holds at most 64 entries. Failures are not cached.
- **Model:** a small AI SDK v2 model adapter (`apps/server/src/agent/model.ts`). Its only backend is the existing relay job `ladder-draft`. Gemma 4 e4b on the hub can't call tools through that job (the prompt is fixed on the Mac), so the adapter plans by rule. Step 1 asks for every tool at once. Step 2 turns the results into one relay job:
  - the ask, using the pack's spelling of any place it names, plus " before dark" when the plan would end after sunset and the ask still fits in 80 characters;
  - the phone's weather, or else the weather tool's;
  - the same minutes.

  Nothing new is exposed on the Mac: same job kind, same fields, same guard on the hub.
- **User constraints beat weather** (`apps/server/src/agent/constraints.ts`):
  - When the ask names an activity from a fixed list (kite, frisbee, bike, hike, picnic, swim, run, fishing and others), step 1 keeps that activity. A condition in the ask ("if windy") stays with it when it fits in 4 words.
  - If the model's step 1 doesn't name the activity, it is set back: "Indoor activity" becomes "Kite flying if windy".
  - Weather may move steps 2 to 4. When rain is likely and the ask set no condition, step 1 may get a short note ("Frisbee if dry").
  - The changed ladder passes `enforceLadder()` again. Walks and sits are not on the list, so rain can still make a walk covered.
- **Cloud tier:** when the hub is absent, the adapter calls `ctx.cloud.ladder()` (DigitalOcean, ADR-0022) with the rewritten ask and the minutes, as today. It is never called while the hub is up, even when the hub is slow. No other API is called; a test stubs `fetch` and checks that every URL is api.weather.gov.
- **Same contract and guard:** the route still answers `{steps: 4 x {step, label, minutes}, tier, ms}`. The agent's text goes through `enforceLadder()` against the **phone's** ask, not the rewritten one, so a place the agent added can't get past the invented-name check. Any failure (load error, timeout, invalid answer) shows `templateLadder()` with tier `rules`.
- **Budget:** the hub path keeps 8 s for the whole run. The relay gets what is left after the tools, and an abort stops the run at 8.25 s. The cloud path keeps its own 35 s (ADR-0022), as today.
- **Tracing:** each tool runs in an `execute_tool <name>` span, the relay call keeps its `chat` span, and the guard keeps `enforce_ladder`. There is also a `keep_asked` span. Two new allow-listed attributes: `flare.agent` (true/false) and `flare.weather` (`phone` | `tool` | `none`). No value carries user text.
- **npm audit:** there are 5 moderate findings, all one chain: gray-matter → js-yaml 3 → argparse 1 → sprintf-js. No fixed version exists. The vulnerable code never loads on our path, which a test proves. Details: `docs/security/audit-notes.md`.
- **Guard: Title Case answers are a style, not names** (`packages/shared/src/prompts/ladder.ts`):
  - When 3 or more of the 4 labels are in Title Case (two or more capitalised words after the first, not counting small words like "by" or "the"), every label goes to sentence case before the invented-name check: "Covered Frisbee Play" becomes "Covered frisbee play".
  - Names the ask capitalises after its own first word ("Ford Woods Park") stay as written, and so do all-caps words ("WDDA"), so both are still checked.
  - The check stays real in three ways:
    - in a sentence-case answer, one capitalised word the ask doesn't contain still counts ("Walk to Paris" gets the template label);
    - one capitalised word on its own never makes a label Title Case;
    - inside a Title Case answer, a capitalised word in front of a place noun (Mall, Park, Lake, Street, Cafe and others) still counts unless the ask contains it ("Walk To Dearborn Mall" gets the template label, "Short Park Walk" passes).
  - Before this change, L13 ("Frisbee at Ford Woods Park even if it rains") fell to the template on both paths: Gemma wrote every label in Title Case, and the guard read each capitalised word as an invented place.
- **Hub: no identical retry** (`apps/hub/src/ollama.ts`, `ladderFromAsk()`):
  - At temperature 0 the same prompt gives the same answer, so the old retry only added about 3.5 s.
  - There are now two modes. `"corrective"` retries once with the first answer and a correction ("sentence case, only places named in the ask"), and only if one more call of the same length fits before the deadline the hub client passes. `"none"` lets the template take over at once.
  - **The default is `"none"`.** Neither eval run below had a first answer fail the guard, so the retry never ran. A probe of 18 asks (the 13 plus 5 harder ones) also had no first-answer failures.
  - Tested directly on the two Title Case answers, the correction cost 3.4 to 3.6 s. On the L13 answer it changed one label of four, and the other three stayed Title Case; on the second answer it changed nothing. So the cost is real and the gain small; the template is the better fallback.
  - `EVAL_LADDER_RETRY=corrective` measures the other mode.

## Eval (local Ollama, 2026-10-11 12:00 ET, `npm run eval -- ladder-agent`)
- **Items:** all 13 asks.
- **Setup:** order-balanced, with the hub's own `ladderFromAsk()` behind a stand-in relay and the 8 s budget. Default hub retry `none`.
- **Agent requests:** each carried `start_at` = tomorrow 11:00 and the pack place the ask names as `area`.

| Bar | Target | Current | Agent |
| --- | --- | --- | --- |
| Valid ladder shown | 13/13 | 13/13 | 13/13 |
| Hub answer used (≤ 1 template step, ≤ 8 s) | ≥ 10/13 | **13/13** | **13/13** |
| Shown labels with person words | 0 | 0 | 0 |
| Shown labels with invented names | 0 | 0 | 0 |
| p95 latency, all 13 | ≤ 8000 ms | **5527 ms** | **5127 ms** |
| p95 latency, 12 original asks | ≤ 6500 ms (agent) | 5172 ms | 5127 ms |
| Asked activity kept on step 1, when the hub answered | all | 2/2 | 2/2 |
| Tool weather matches the plan's window | all | n/a | 7/7 |

- **Medians:** 4432 ms current, 4312 ms agent. Mac load was 3.9 to 4.5.
- **Agent overhead:** median 12 ms, p95 293 ms. No relay call hit the budget.
- **L13 is valid on both paths:** "Covered frisbee play", "Short frisbee toss", "Quick frisbee throw", "Sit and talk". Step 1 keeps the frisbee the ask insists on.
- **The same run with `EVAL_LADDER_RETRY=corrective`:** every bar the same; p95 5332 ms current, 5638 ms agent. Report: `evals/reports/ladder-agent-hub-retry-corrective.md`.
- **Earlier runs, same day:**
  - 11:15: before the guard fix. p95 on all 13 was 8028 ms current and 8026 ms agent, and L13 was the template on both.
  - 10:50: before `start_at`. That forecast had rain now, and step 1 of "Kite flying if windy" became "Indoor activity".
- **Spot check with rain likely now:** "Kite flying if windy" kept "Kite flying if windy", and "Frisbee on the big lawn" became "Frisbee if dry".
- Report: `evals/reports/ladder-agent-hub.md`.

## Consequences
- The agent meets every bar, as does the current route. With the guard fix, both stay well inside 8 s on all 13 asks.
- **The guard and hub changes reach production only after a merge and a hub restart.** They are in shared code, so they change the current (flag-off) route too: Title Case answers that were thrown away before are now used.
- Limits:
  - The phone doesn't send `start_at` or `area` yet, so phones still get "now" in the Fairlane area. That phone change belongs to the Plan screen and was not done here.
  - The kept-activity list is fixed and in English. An activity outside it (for example "board games") gets no protection.
  - A Title Case answer can still pass an invented name that has no place noun after it ("Walk To Dearborn", or "Coffee At Starbucks" since "Starbucks" isn't a place noun). That trade was made so L13-style answers get through. A sentence-case answer keeps the full check.
  - The adapter decides the tool calls by rule; Gemma writes only the ladder. Nearby places don't reach the model.
  - With the retry off, a first answer that fails the guard goes straight to the template. Today that happened for 0 of 13 asks.
  - `@mastra/core` adds 140 packages to the lock file (audit above).
- Turn on after the phone sends `start_at` and `area`.
- Proof:
  - `apps/server/test/ladder-agent.test.ts` (19 tests);
  - `apps/server/test/ladder-agent-plan.test.ts` (10 tests);
  - `apps/server/test/mastra-import-graph.test.ts` (3 tests);
  - `packages/shared/test/ladder-case.test.ts` (8 tests: Title Case, sentence case, L13 answer accepted, invented names still caught);
  - `apps/hub/test/ladder-retry.test.ts` (4 tests).
