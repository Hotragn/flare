# Eval: photo (hub tier)

Model: gemma4:e4b-it-q4_K_M. Prompt: photo-invite@2. Date: 2026-10-11T01:18:37.955Z. Items: 20.

| Bar | Target | Measured | Pass |
| --- | --- | --- | --- |
| Usable within 6 s budget | ≥ 19/20 | 18/20 | NO |
| Shown text with person words | 0 | 0 | yes |
| Invented names (unreviewed suspects) | 0 | 0 | yes |
| Scene names a key fact | ≥ 18/20 | 19/20 | yes |
| Median latency | ≤ 4000 ms | 3868 ms | yes |

Latency: median 3868 ms, p95 12496 ms, max 17448 ms.

## Notes

- Image warm-up before timing: 7102 ms (not counted).
- Usable on the first try: 20/20. Raw answers with person words before the guard: 0. Over budget: 2.
- Key fact = the scene mentions at least one item from evals/datasets/photos.json expect_any (a proxy for the lab's hand grade).
- Suspect names are capitalised words outside the sign text in the photo; each one is reviewed by hand in docs/ml/eval-results.md.
- Mac 1-min load average: 13.6 at start, 29.3 at end (10 cores; other agents share this Mac and its Ollama).

Per-item results: `photo-hub.json`.
