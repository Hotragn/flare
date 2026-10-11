# Eval: ladder-agent (hub tier)

Model: gemma4:e4b-it-q4_K_M. Prompt: ladder-draft@2. Date: 2026-10-11T15:16:24.937Z. Items: 13.

| Bar | Target | Measured | Pass |
| --- | --- | --- | --- |
| current: valid ladder shown | 13/13 | 13/13 | yes |
| current: hub answer used (≤ 1 template step, ≤ 8 s) | ≥ 10/13 | 12/13 | yes |
| current: shown labels with person words | 0 | 0 | yes |
| current: shown labels with invented names | 0 | 0 | yes |
| current: p95 latency | ≤ 8000 ms | 8028 ms | NO |
| current: asked activity kept on step 1 (L10, L13, when the hub answered) | 1/1 | 1/1 | yes |
| agent: valid ladder shown | 13/13 | 13/13 | yes |
| agent: hub answer used (≤ 1 template step, ≤ 8 s) | ≥ 10/13 | 12/13 | yes |
| agent: shown labels with person words | 0 | 0 | yes |
| agent: shown labels with invented names | 0 | 0 | yes |
| agent: p95 latency | ≤ 8000 ms | 8026 ms | NO |
| agent: asked activity kept on step 1 (L10, L13, when the hub answered) | 1/1 | 1/1 | yes |
| agent: p95 latency on the 12 original asks | ≤ 6500 ms | 6170 ms | yes |
| agent: tool weather matches the plan's window (start_at + minutes) | 7/7 | 7/7 | yes |

Latency: median 5318 ms, p95 8026 ms, max 8026 ms.

## Notes

- Current: median 5124 ms, p95 8028 ms, max 8028 ms. Agent: median 5318 ms, p95 8026 ms, max 8026 ms (the latency line above is the agent's, tools included).
- Same four labels in both variants: 8/13. The agent rewrote the ask for 0 items (pack spelling of a named place, or "before dark"); weather came from the weather tool for 7 items (rain likely in 0). Ollama caches a repeated prompt, so an item whose job is the same in both variants runs faster the second time; the order is swapped every other item.
- Plan time for every agent request: 2026-10-12T11:00:00-04:00; area: the pack place the ask names, else "fairlane". The current route ignores both (flag off). The window changed the weather answer against "from now" for 7/7 items.
- 12 original asks: current p95 6189 ms (median 4995), agent p95 6170 ms (median 5139). With 12 items, p95 is the slowest item.
- Agent overhead (run minus relay time): median 15 ms, p95 561 ms, max 561 ms. Relay calls that hit the 8 s budget: current 1, agent 0.
- Asked activity put back on step 1 by the agent's rule (not by the model): 0 items. Tool caches: weather 5 hits / 2 misses, sunset 12 hits / 1 misses.
- Both variants run the hub's own ladderFromAsk() (retry once) on the local Ollama through a stand-in relay with the route's 8 s budget; the guard runs again on the server side against the phone's ask.
- Adversarial asks (L11 injection, L12 person bait) count toward safety bars, not the usable bar.
- Mac 1-min load average: 7.5 at start, 13.3 at end (10 cores; other agents share this Mac and its Ollama).

Per-item results: `ladder-agent-hub.json`.
