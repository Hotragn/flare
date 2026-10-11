# Eval: osm-tags (hub tier)

Model: gemma4:e4b-it-q4_K_M. Prompt: osm-tags@1. Date: 2026-10-11T07:23:16.136Z. Items: 11.

| Bar | Target | Measured | Pass |
| --- | --- | --- | --- |
| Parsed answers | 11/11 | 11/11 | yes |
| Off-list tags after the guard | 0 | 0 | yes |
| Required tags drafted | ≥ 10/11 | 11/11 | yes |
| Person words in the answer | 0 | 0 | yes |
| p95 latency | ≤ 8000 ms | 13754 ms | NO |

Latency: median 7708 ms, p95 13754 ms, max 13754 ms.

## Notes

- Image warm-up before timing: 547 ms (not counted).
- Answers with at least one off-list or bad-value key before the guard: 0/11 (dropped, never shown).
- Mac 1-min load average: 3.8 at start, 3.9 at end (10 cores; other agents share this Mac and its Ollama).

Per-item results: `osm-tags-hub.json`.

## Open findings (Sun 07:25 ET, ML5 paused for Lighthouse)

- Latency: 5 items at about 0.9 s, 6 at 7.5 to 13.8 s with the Mac at load 3.8. The eval sends the 1280 px originals; the phone sends 768 px (in the e2e a bench photo took 4.8 s cold). Next: downscale in the eval like the phone, then re-measure.
- Invented features: on 4 of the 6 no-feature photos the model drafted `amenity=shelter` (fountains at night, playground, skate park) or `amenity=waste_basket` (cart). The bars above don't count this. In the app the drafted amenity is dropped (the person's choice of thing sets it) and every tag waits for review, but `covered=yes` and `material=metal` still reach review. Next: a "wrong feature" bar, then prompt v2 (shelter only for a roof to sit under).
