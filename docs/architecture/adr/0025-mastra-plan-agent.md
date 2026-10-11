# ADR-0025: The Plan ladder as a Mastra agent, behind a flag

Status: Proposed (S2, Sun 2026-10-11). Off by default (`LADDER_AGENT=1` turns it on). Keeps ADR-0007 (8 s hub budget), ADR-0021 (allow-listed spans) and ADR-0022 (DigitalOcean only when the hub is absent).

## Context
`POST /api/v1/drafts/ladder` sends the ask line, the minutes and the phone's coarse weather to the hub, runs `enforceLadder()` and falls back to `templateLadder()`. We wanted the draft to be an agent with real tools (sunset, a weather window, places from the map pack, the step templates) without changing what the phone sees, what the Mac exposes, or what leaves the server.

## Decision
- **Library:** `@mastra/core` **1.68.0**, pinned exact. Published 2026-09-22, alone that day and a week before the next release (1.70.0 and 1.71.0 came out the same day on 09-24, so those were skipped). Loaded with a dynamic `import()` on the first agent request only, so the flag off costs nothing at boot. We use `Agent` and `createTool` only, never the `Mastra` class, and set `MASTRA_TELEMETRY_DISABLED=1` before the import (`apps/server/src/agent/no-telemetry.ts`): Mastra otherwise sends usage events to PostHog.
- **Tools** (`apps/server/src/agent/tools.ts`), local and pure except the weather:
  - `sunset`: the NOAA math copied from `apps/web/src/lib/map/sun.ts` into `apps/server/src/agent/sun.ts` (no web import in the server), at the Fairlane pack centre, local time in America/Detroit, and whether a plan starting now ends after dark.
  - `weather_window`: api.weather.gov at the pack centre rounded to 0.1°, reduced to `{rain_likely, temp_f}` for now to now + minutes, the same rules as `apps/web/src/lib/map/weather.ts`. 2.5 s cap, `null` on any failure. Skipped when the phone already sent weather.
  - `nearby_places`: the Fairlane pack (`apps/web/static/maps/fairlane.json`, read once) reduced to 36 named parks, water, woods and shelters. Returns the labels the ask names, the five closest labels to the pack centre, and counts. Never coordinates.
  - `step_templates`: `templateLadder(total)`.
- **Model:** a small AI SDK v2 model adapter (`apps/server/src/agent/model.ts`) whose only backend is the existing relay job `ladder-draft`. Gemma 4 e4b on the hub cannot call tools through that job (the prompt is fixed on the Mac), so the adapter plans by rule: step 1 asks for every tool at once; step 2 turns the results into one relay job:
  - the ask with the pack's spelling of any place it names, plus " before dark" when the plan would end after sunset and the ask still fits in 80 characters;
  - the phone's weather, or else the weather tool's;
  - the same minutes.
  Nothing new is exposed on the Mac: same job kind, same fields, same hub-side guard.
- **Cloud tier:** when the hub is absent, the adapter calls `ctx.cloud.ladder()` (DigitalOcean, ADR-0022) with the rewritten ask and the minutes, as today. Never while the hub is up, even when it is slow. No other API is called (a test stubs `fetch` and checks every URL is api.weather.gov).
- **Same contract and guard:** the route still answers `{steps: 4 x {step, label, minutes}, tier, ms}`. The agent's text goes through `enforceLadder()` against the **phone's** ask, not the rewrite, so a place the agent added cannot pass the invented-name check. Any failure (load error, timeout, invalid answer) shows `templateLadder()` with tier `rules`.
- **Budget:** the hub path keeps 8 s for the whole run; the relay gets what is left after the tools, and an abort stops the run at 8.25 s. The cloud path keeps its own 35 s (ADR-0022), as today.
- **Tracing:** each tool runs in an `execute_tool <name>` span; the relay call keeps its `chat` span; the guard keeps `enforce_ladder`. Two new allow-listed attributes: `flare.agent` (boolean) and `flare.weather` (`phone` | `tool` | `none`). No values with user text.

## Eval (local Ollama, 2026-10-11, `npm run eval -- ladder-agent`)
Both variants ran the hub's own `ladderFromAsk()` on the same 12 asks through a stand-in relay with the 8 s budget, back to back per item.

| Bar | Target | Current | Agent |
| --- | --- | --- | --- |
| Valid ladder shown | 12/12 | 12/12 | 12/12 |
| Hub answer used (≤ 1 template step, ≤ 8 s) | ≥ 9/12 | 12/12 | 12/12 |
| Shown labels with person words | 0 | 0 | 0 |
| Shown labels with invented names | 0 | 0 | 0 |
| p95 latency | ≤ 8000 ms | 6614 ms | 7401 ms |

Median 5247 ms current, 5729 ms agent. The weather tool took about 200 ms; the rest of the gap is noise and Ollama's prompt cache. 5 of 12 ladders had the same labels. The weather tool filled weather for 7 asks and said rain was likely for all 7, so those ladders moved to covered or indoor steps ("Covered Fairlane walk"). Report: `evals/reports/ladder-agent-hub.md`.

## Consequences
- The agent passes the same bars as today; it is not yet better on them. What it adds is context the phone did not send (weather when the phone had none, sunset, pack spelling).
- Limits:
  - The server never learns the phone's position or the plan's start time, so weather and sunset are for the Fairlane area **now**, not for where and when the plan happens. A plan for tomorrow can get today's rain.
  - Rain can override what the ask wanted ("Kite flying if windy" became "Indoor activity").
  - Nearby places do not reach the model: the hub prompt allows only places the ask names, and the guard enforces it.
  - The adapter decides the tool calls by rule; Gemma writes only the ladder.
  - `@mastra/core` adds 140 packages to the lock file, and `npm audit` reports 5 moderate issues through `gray-matter` (front-matter parsing), which this path does not call.
- Turn on only after the eval shows a gain we want (for example, weather tied to the plan's start time).
- Proof: `apps/server/test/ladder-agent.test.ts` (19 tests: tools, adapter, fallbacks, cloud only when absent, budget stop, route contract with the flag on, no other API).
