# Eval: osm-tags (hub tier)

Model: gemma4:e4b-it-q4_K_M. Prompt: osm-tags@1. Date: 2026-10-11T01:20:41.123Z. Items: 5.

| Bar | Target | Measured | Pass |
| --- | --- | --- | --- |
| Parsed answers | 5/5 | 5/5 | yes |
| Off-list tags after the guard | 0 | 0 | yes |
| Required tags drafted | ≥ 4/5 | 5/5 | yes |
| Person words in the answer | 0 | 0 | yes |
| p95 latency | ≤ 8000 ms | 1362 ms | yes |

Latency: median 1072 ms, p95 1362 ms, max 1362 ms.

## Notes

- Image warm-up before timing: 15795 ms (not counted).
- Answers with at least one off-list or bad-value key before the guard: 0/5 (dropped, never shown).
- Mac 1-min load average: 22.0 at start, 30.3 at end (10 cores; other agents share this Mac and its Ollama).

Per-item results: `osm-tags-hub.json`.
