# Eval: photo (hub tier)

Model: gemma4:e4b-it-q4_K_M. Prompt: photo-invite@2. Date: 2026-10-11T01:01:56.628Z. Items: 20.

| Bar | Target | Measured | Pass |
| --- | --- | --- | --- |
| Usable within 6 s budget | ≥ 19/20 | 0/20 | NO |
| Shown text with person words | 0 | 0 | yes |
| Invented names (unreviewed suspects) | 0 | 1 | NO |
| Scene names a key fact | ≥ 18/20 | 19/20 | yes |
| Median latency | ≤ 4000 ms | 11117 ms | NO |

Latency: median 11117 ms, p95 20826 ms, max 23347 ms.

## Notes

- Usable on the first try: 20/20. Raw answers with person words before the guard: 0. Over budget: 20.
- Key fact = the scene mentions at least one item from evals/datasets/photos.json expect_any (a proxy for the lab's hand grade).
- Suspect names are capitalised words outside the sign text in the photo; each one is reviewed by hand in docs/ml/eval-results.md.

Per-item results: `photo-hub.json`.
