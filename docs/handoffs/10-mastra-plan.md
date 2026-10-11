# Handoff 10: Plan ladder as a Mastra agent

From: S2. Date: Sun 2026-10-11, about 12:10 ET. Branch: `mastra-plan` (not merged). Decision: [ADR-0025](../architecture/adr/0025-mastra-plan-agent.md). Audit: [docs/security/audit-notes.md](../security/audit-notes.md).

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
| packages/shared/src/prompts/ladder.ts, packages/shared/test/ladder-case.test.ts | Title Case answers to sentence case before the invented-name check (8 tests) |
| apps/hub/src/ollama.ts, apps/hub/src/client.ts, apps/hub/test/ladder-retry.test.ts | No identical retry; `LADDER_RETRY` none (default) or corrective with a deadline (4 tests) |

## How to turn it on
1. Set `LADDER_AGENT=1` in the server's environment and restart. The agent itself needs no hub update (same job kind and fields); the guard and retry change reaches the Mac's hub after a merge and a hub restart.
2. To make it useful, the Plan screen should send `start_at` (the plan's start) and `area` (the place the host picked, by label) with the ladder request. Both are optional, and older phones keep working.
3. Unset the flag to go back.

## Guard and hub changes (shared code, so they also change the flag-off route)
- **`enforceLadder()`:** when 3 or more labels are Title Case, labels go to sentence case before the invented-name check. "Covered Frisbee Play" becomes "Covered frisbee play"; names the ask capitalises and all-caps words stay as written.
- **The check still works where it should:**
  - in a sentence-case answer, "Walk to Paris" still gets the template label;
  - in a Title Case answer, "Walk To Dearborn Mall" (a capitalised word before a place noun, not in the ask) still gets the template label.
- **`ladderFromAsk()`:** no identical retry. `LADDER_RETRY = "none"` is the default: the template takes over at once. `"corrective"` (one retry with the first answer and a correction, only if it fits before the deadline) stays available.
- **Why "none":**
  - neither eval run had a first answer fail the guard (0 of 13, and 0 of 18 in a probe with 5 harder asks), so the retry never ran;
  - tested directly on two Title Case answers, the correction cost about 3.5 s, changed one label of four in one answer and nothing in the other.
- **To roll out:** the running hub on the Mac picks this up only after a merge and a hub restart.

## Eval numbers (local Ollama, gemma4:e4b-it-q4_K_M, 13 asks, 2026-10-11 12:00 ET, hub retry none)

| Bar | Target | Current | Agent |
| --- | --- | --- | --- |
| Valid ladder shown | 13/13 | 13/13 | 13/13 |
| Hub answer used (≤ 1 template step, ≤ 8 s) | ≥ 10/13 | 13/13 | 13/13 |
| Labels with person words | 0 | 0 | 0 |
| Labels with invented names | 0 | 0 | 0 |
| p95, all 13 | ≤ 8000 ms | 5527 ms | 5127 ms |
| p95, 12 original asks | ≤ 6500 ms (agent) | 5172 ms | 5127 ms |
| Asked activity kept on step 1 (hub answered) | all | 2/2 | 2/2 |
| Tool weather matches the plan's window | all | n/a | 7/7 |

- **Medians:** 4432 ms current, 4312 ms agent.
- **Agent overhead:** median 12 ms, p95 293 ms.
- **Mac load:** 3.9 to 4.5.
- **L13 is valid on both paths:** "Covered frisbee play", "Short frisbee toss", "Quick frisbee throw", "Sit and talk".
- **Same run with `EVAL_LADDER_RETRY=corrective`:** same bars; p95 5332 ms current, 5638 ms agent (`evals/reports/ladder-agent-hub-retry-corrective.md`).
- **Before the guard fix (11:15):** p95 on all 13 was 8028 ms current and 8026 ms agent, and L13 fell to the template on both.

Proof:
- `npx vitest run apps/server apps/hub packages/shared`: all pass.
- `npx tsc -p . --noEmit`: clean.
- `npm run contracts`: ok.
- `npx biome check`: clean on changed files.

## Limits
- **The phone doesn't send `start_at` or `area` yet.** Until it does, the agent uses now and the Fairlane centre.
- **The kept-activity list is fixed and in English.** Activities outside it get no protection from the weather.
- **A Title Case answer can still pass an invented name with no place noun after it** ("Coffee At Starbucks"). A sentence-case answer keeps the full check.
- **With the retry off,** a first answer that fails the guard goes straight to the template; that was 0 of 13 asks today.
- **Nearby places never reach Gemma,** and Gemma doesn't choose the tools; the adapter calls them by rule.
- **npm audit:** 5 moderate findings kept. There is no fixed version, and argparse and sprintf-js never load (see docs/security/audit-notes.md).
