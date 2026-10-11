# Handoff 10: Plan ladder as a Mastra agent

From: S2. Date: Sun 2026-10-11, about 11:00 ET. Branch: `mastra-plan` (not merged). Decision: [ADR-0025](../architecture/adr/0025-mastra-plan-agent.md).

## What
`POST /api/v1/drafts/ladder` can now draft with a Mastra agent (`@mastra/core` 1.68.0) instead of the plain relay call. The route's answer is unchanged: `{steps: 4 x {step, label, minutes}, tier, ms}`, always through `enforceLadder()`, template on any failure. **Off by default.**

| Path | Contents |
| --- | --- |
| apps/server/src/agent/tools.ts | `sunsetWindow`, `weatherWindow` (api.weather.gov, 0.1°), `nearbyPlaces` (Fairlane pack, labels only, read once), `stepTemplates` |
| apps/server/src/agent/sun.ts | NOAA sunset math, copied from apps/web/src/lib/map/sun.ts (keep in step) |
| apps/server/src/agent/model.ts | The model adapter: step 1 asks for the tools, step 2 sends one `ladder-draft` relay job; `planJob()` builds that job |
| apps/server/src/agent/ladder-agent.ts | `runLadderAgent()`: tools, hub or cloud, 8 s, guard, outcome |
| apps/server/src/agent/no-telemetry.ts | Turns Mastra's PostHog usage events off before the import |
| apps/server/src/routes/ai.ts | The flag branch; the agent module loads on the first agent request |
| apps/server/src/tracing.ts | Two allow-listed attributes: `flare.agent`, `flare.weather` |
| apps/server/test/ladder-agent.test.ts | 19 tests |
| evals/harness/tasks/ladder-agent.ts | `npm run eval -- ladder-agent`: agent and today's route on the same asks |
| evals/reports/ladder-agent-hub.md, .json | The run below |

## How to turn it on
Set `LADDER_AGENT=1` in the server's environment and restart. Nothing else changes: the hub needs no update (same job kind and fields), the phone needs no update. Unset it to go back.

## Eval numbers (local Ollama, gemma4:e4b-it-q4_K_M, 12 asks, 2026-10-11)

| Bar | Target | Current | Agent |
| --- | --- | --- | --- |
| Valid ladder shown | 12/12 | 12/12 | 12/12 |
| Hub answer used (≤ 1 template step, ≤ 8 s) | ≥ 9/12 | 12/12 | 12/12 |
| Labels with person words | 0 | 0 | 0 |
| Labels with invented names | 0 | 0 | 0 |
| p95 latency | ≤ 8000 ms | 6614 ms | 7401 ms |

Medians 5247 ms (current) and 5729 ms (agent). Mac load 2.8 to 5.6 during the run, Ollama shared with other agents. The weather tool takes about 200 ms; Ollama's prompt cache makes the second run of an identical job faster, so the order is swapped every other item. 7 asks got weather from the tool, all "rain likely", and moved to covered or indoor steps.

Proof: `npx vitest run apps/server` 197 passed (19 new); `npx tsc -p . --noEmit` clean; `npx biome check` clean on changed files.

## Limits
- Weather and sunset are for the Fairlane area **now**. The request carries no position and no start time, so a plan for later or elsewhere gets the wrong window. Fix before turning it on: send the start time in the request (optional field) or keep weather on the phone.
- Rain can override the ask ("Kite flying if windy" became "Indoor activity").
- Nearby places never reach Gemma: the hub prompt and the guard allow only places the ask names.
- Gemma does not choose tools; the adapter calls all of them by rule.
- 140 more packages in the lock file; `npm audit` shows 5 moderate issues through `gray-matter`, not on this path.
- The p95 is 0.6 s under the 8 s budget on this run; a busy Mac could push agent answers to the template more often than today.
