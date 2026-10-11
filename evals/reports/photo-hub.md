# Eval: photo (hub tier)

Model: gemma4:e4b-it-q4_K_M. Prompt: photo-invite@2. Date: 2026-10-11T01:21:02.808Z. Items: 20.

| Bar | Target | Measured | Pass |
| --- | --- | --- | --- |
| Usable within 6 s budget | ≥ 19/20 | 20/20 | yes |
| Shown text with person words | 0 | 0 | yes |
| Invented names (unreviewed suspects) | 0 | 0 | yes |
| Scene names a key fact | ≥ 18/20 | 19/20 | yes |
| Median latency | ≤ 4000 ms | 3786 ms | yes |

Latency: median 3786 ms, p95 5038 ms, max 5292 ms.

## Notes

- Image warm-up before timing: 7323 ms (not counted).
- Usable on the first try: 20/20. Raw answers with person words before the guard: 0. Over budget: 0.
- Key fact = the scene mentions at least one item from evals/datasets/photos.json expect_any (a proxy for the lab's hand grade).
- Suspect names are capitalised words outside the sign text in the photo; each one is reviewed by hand in docs/ml/eval-results.md.
- Mac 1-min load average: 30.3 at start, 22.4 at end (10 cores; other agents share this Mac and its Ollama).

Per-item results: `photo-hub.json`.
