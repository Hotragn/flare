# Handoff 10: Plan ladder as a Mastra agent

From: S2. Date: Sun 2026-10-11, about 11:30 ET. Branch: `mastra-plan` (not merged). Decision: [ADR-0025](../architecture/adr/0025-mastra-plan-agent.md). Audit: [docs/security/audit-notes.md](../security/audit-notes.md).

## What
`POST /api/v1/drafts/ladder` can now draft with a Mastra agent (`@mastra/core` 1.68.0) instead of the plain relay call.
- The answer is unchanged: `{steps: 4 x {step, label, minutes}, tier, ms}`, always through `enforceLadder()`, the template on any failure.
- The request takes two new optional fields:
  - `start_at` (ISO), when the plan starts;
  - `area` (a pack place label or "fairlane", at most 40 characters, digits refused).

  Both feed the tools only.
- **Off by default.**

| Path | Contents |
| --- | --- |
| apps/server/src/agent/tools.ts | `sunsetWindow`, `weatherWindow` (api.weather.gov, 0.1°, the plan's window), `nearbyPlaces` (Fairlane pack, labels only), `resolveArea`, `stepTemplates`, the 15-minute caches |
| apps/server/src/agent/constraints.ts | `askedActivity`, `keepAsked`: the activity the ask names stays on step 1 |
| apps/server/src/agent/sun.ts | NOAA sunset math, copied from apps/web/src/lib/map/sun.ts (keep in step) |
| apps/server/src/agent/model.ts | The model adapter: step 1 asks for the tools, step 2 sends one `ladder-draft` relay job (`planJob()`) |
| apps/server/src/agent/ladder-agent.ts | `runLadderAgent()`: tools, hub or cloud, 8 s, guard, kept activity, outcome |
| apps/server/src/agent/no-telemetry.ts | Turns Mastra's PostHog usage events off before the import |
| apps/server/src/http/schemas.ts, docs/architecture/contracts/openapi.yaml | `start_at`, `area` (optional); `npm run contracts` passes |
| apps/server/src/routes/ai.ts | The flag branch; the agent module loads on the first agent request |
| apps/server/src/tracing.ts | Two allow-listed attributes: `flare.agent`, `flare.weather` |
| apps/server/test/ladder-agent*.test.ts, mastra-import-graph.test.ts | 32 tests |
| evals/harness/tasks/ladder-agent.ts, evals/datasets/ladder-asks.json (L13, `keep`) | `npm run eval -- ladder-agent` |
| docs/security/audit-notes.md | The 5 moderate npm audit findings, kept with proof |

## How to turn it on
1. Set `LADDER_AGENT=1` in the server's environment and restart. The hub needs no update (same job kind and fields).
2. To make it useful, the Plan screen should send `start_at` (the plan's start) and `area` (the place the host picked, by label) with the ladder request. Both are optional, and older phones keep working.
3. Unset the flag to go back.

## Eval numbers (local Ollama, gemma4:e4b-it-q4_K_M, 13 asks, 2026-10-11 11:15 ET)

| Bar | Target | Current | Agent |
| --- | --- | --- | --- |
| Valid ladder shown | 13/13 | 13/13 | 13/13 |
| Hub answer used (≤ 1 template step, ≤ 8 s) | ≥ 10/13 | 12/13 | 12/13 |
| Labels with person words | 0 | 0 | 0 |
| Labels with invented names | 0 | 0 | 0 |
| p95, 12 original asks | ≤ 6500 ms (agent) | 6189 ms | 6170 ms |
| p95, all 13 | ≤ 8000 ms | 8028 ms | 8026 ms |
| Asked activity kept on step 1 (hub answered) | all | 1/1 | 1/1 |
| Tool weather matches the plan's window | all | n/a | 7/7 |

- **Agent overhead:** median 15 ms, p95 561 ms. The 561 ms is the first request, with a cold forecast cache.
- **Mac load:** 7.5 to 13.3 during the run.
- **Weather window:** the forecast for tomorrow 11:00 differed from "now" for 7 of 7 tool-weather asks (rain now, dry then), and the agent used the right window every time.
- **L13 fell to the template in both variants:** Gemma wrote Title Case labels, the guard rejected them, and the hub's identical retry used up the 8 s.
- **Spot check with rain likely now:** "Kite flying if windy" kept "Kite flying if windy" on step 1, and "Frisbee on the big lawn" became "Frisbee if dry".

Proof:
- `npx vitest run apps/server`: 210 passed.
- `npx tsc -p . --noEmit`: clean.
- `npm run contracts`: ok.
- `npx biome check`: clean on changed files.

## Limits
- **The phone doesn't send `start_at` or `area` yet.** Until it does, the agent uses now and the Fairlane centre.
- **The kept-activity list is fixed and in English.** Activities outside it get no protection from the weather.
- **Hub retries cost the p95, not the agent.** The hub's `ladderFromAsk()` retries the same prompt at temperature 0 and gets the same rejected answer, adding about 3.5 s; Title Case labels are the usual cause. This needs the hub and guard owners. It is the biggest p95 lever.
- **Nearby places never reach Gemma:** the hub prompt and the guard allow only places the ask names.
- **Gemma doesn't choose the tools;** the adapter calls them by rule.
- **npm audit:** 5 moderate findings kept. There is no fixed version, and argparse and sprintf-js never load, which a test proves. See docs/security/audit-notes.md.
