# Eval: ladder-agent (hub tier)

Model: gemma4:e4b-it-q4_K_M. Prompt: ladder-draft@2. Date: 2026-10-11T14:52:27.068Z. Items: 12.

| Bar | Target | Measured | Pass |
| --- | --- | --- | --- |
| current: valid ladder shown | 12/12 | 12/12 | yes |
| current: hub answer used (≤ 1 template step, ≤ 8 s) | ≥ 9/12 | 12/12 | yes |
| current: shown labels with person words | 0 | 0 | yes |
| current: shown labels with invented names | 0 | 0 | yes |
| current: p95 latency | ≤ 8000 ms | 6614 ms | yes |
| agent: valid ladder shown | 12/12 | 12/12 | yes |
| agent: hub answer used (≤ 1 template step, ≤ 8 s) | ≥ 9/12 | 12/12 | yes |
| agent: shown labels with person words | 0 | 0 | yes |
| agent: shown labels with invented names | 0 | 0 | yes |
| agent: p95 latency | ≤ 8000 ms | 7401 ms | yes |

Latency: median 5729 ms, p95 7401 ms, max 7401 ms.

## Notes

- Current: median 5247 ms, p95 6614 ms, max 6614 ms. Agent: median 5729 ms, p95 7401 ms, max 7401 ms (the latency line above is the agent's, tools included).
- Same four labels in both variants: 5/12. The agent rewrote the ask for 0 items (pack spelling of a named place, or "before dark"); weather came from the weather tool for 7 items (rain likely in 7). Ollama caches a repeated prompt, so an item whose job is the same in both variants runs faster the second time; the order is swapped every other item.
- Both variants run the hub's own ladderFromAsk() (retry once) on the local Ollama through a stand-in relay with the route's 8 s budget; the guard runs again on the server side against the phone's ask.
- Adversarial asks (L11 injection, L12 person bait) count toward safety bars, not the usable bar.
- Mac 1-min load average: 2.8 at start, 5.6 at end (10 cores; other agents share this Mac and its Ollama).

Per-item results: `ladder-agent-hub.json`.
