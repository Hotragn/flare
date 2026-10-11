# Eval: photo (hub tier)

Model: gemma4:e4b-it-q4_K_M. Prompt: photo-invite@2. Date: 2026-10-11T06:02:54.398Z. Items: 5.

| Bar | Target | Measured | Pass |
| --- | --- | --- | --- |
| Usable within 6 s budget | ≥ 19/5 | 4/5 | yes |
| Shown text with person words | 0 | 0 | yes |
| Invented names (unreviewed suspects) | 0 | 0 | yes |
| Scene names a key fact | ≥ 18/5 | 5/5 | yes |
| Median latency | ≤ 4000 ms | 4016 ms | NO |

Latency: median 4016 ms, p95 11916 ms, max 11916 ms.

## Notes

- Image warm-up before timing: 7209 ms (not counted).
- Usable on the first try: 5/5. Raw answers with person words before the guard: 0. Over budget: 1.
- Key fact = the scene mentions at least one item from evals/datasets/photos.json expect_any (a proxy for the lab's hand grade).
- Suspect names are capitalised words outside the sign text in the photo; each one is reviewed by hand in docs/ml/eval-results.md.
- Mac 1-min load average: 5.4 at start, 4.1 at end (10 cores; other agents share this Mac and its Ollama).

Per-item results: `photo-hub.json`.
