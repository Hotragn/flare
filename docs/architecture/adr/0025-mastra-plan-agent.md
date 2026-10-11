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

## Eval (local Ollama, 2026-10-11 11:15 ET, `npm run eval -- ladder-agent`)
- **Items:** 13 asks: the 12 originals plus L13, an activity with rain likely.
- **Setup:** both variants ran the hub's own `ladderFromAsk()` through a stand-in relay with the 8 s budget, back to back per item, with the order swapped every other item.
- **Agent requests:** each carried `start_at` = tomorrow 11:00 and the pack place the ask names as `area`. The current route ignores both.

| Bar | Target | Current | Agent |
| --- | --- | --- | --- |
| Valid ladder shown | 13/13 | 13/13 | 13/13 |
| Hub answer used (≤ 1 template step, ≤ 8 s) | ≥ 10/13 | 12/13 | 12/13 |
| Shown labels with person words | 0 | 0 | 0 |
| Shown labels with invented names | 0 | 0 | 0 |
| p95 latency, 12 original asks | ≤ 6500 ms (agent) | 6189 ms | **6170 ms** |
| p95 latency, all 13 | ≤ 8000 ms | 8028 ms | 8026 ms |
| Asked activity kept on step 1, when the hub answered | all | 1/1 | 1/1 |
| Tool weather matches the plan's window | all | n/a | **7/7** |

- **Medians (12 originals):** 4995 ms current, 5139 ms agent. Mac load ran from 7.5 to 13.3; other agents share this Ollama.
- **Agent overhead** (the run minus the time inside the relay): median 15 ms, p95 561 ms. The 561 ms is the first request, which fetches the forecast with a cold cache.
- **Caches:** weather 5 hits and 2 misses (one miss from a 15-minute bucket change), sunset 12 hits and 1 miss.
- **Weather fit:**
  - An independent forecast read matched the agent's weather for all 7 asks where the tool supplied it.
  - Against a "from now" window the answer would have differed for 7 of 7 asks: rain today, dry tomorrow at 11:00.
  - In the first run, without `start_at`, those same asks had moved to covered or indoor steps.
- **L13 ("Frisbee at Ford Woods Park even if it rains"):** both variants fell to the template. Gemma answered in Title Case ("Covered Frisbee Play"), so the guard read every capitalised word as an invented name and replaced all four labels. The hub then retried the same prompt at temperature 0 and got the same answer, which used up the 8 s.
- **Spot check with rain likely now (no `start_at`):**
  - "Kite flying if windy" gave "Kite flying if windy", "Short walk", "Sit down", "Quick look".
  - "Frisbee on the big lawn" gave "Frisbee if dry" first.
  - Without the rule, the first run showed "Indoor activity".
- Report: `evals/reports/ladder-agent-hub.md`.

## Consequences
- The agent meets every bar the current route meets, plus the two new ones: the weather window and the kept activity. Within the 8 s budget, its latency is the same as today's.
- Limits:
  - The phone does not send `start_at` or `area` yet, so a phone request today still gets "now" in the Fairlane area. That phone change belongs to the Plan screen and was not done here.
  - The activity list is fixed and in English. An activity outside it (for example "board games") gets no protection.
  - Nearby places don't reach the model: the hub prompt allows only places the ask names, and the guard enforces that.
  - The adapter decides the tool calls by rule; Gemma writes only the ladder.
  - **Biggest p95 lever, outside this branch:** the hub's `ladderFromAsk()` retries an identical prompt at temperature 0, so the retry repeats the same rejected answer and adds about 3.5 s. Title Case labels are the common cause. That fix belongs to the hub and guard owners (`apps/hub/src/ollama.ts`, `packages/shared/src/prompts/ladder.ts`).
  - `@mastra/core` adds 140 packages to the lock file (audit above).
- Turn on after the phone sends `start_at` and `area`.
- Proof:
  - `apps/server/test/ladder-agent.test.ts` (19 tests);
  - `apps/server/test/ladder-agent-plan.test.ts` (10 tests: area lookup, window follows `start_at`, caches, nothing new sent to the hub, route schema, constraints);
  - `apps/server/test/mastra-import-graph.test.ts` (3 tests: the audit chain).
