# Failure modes

What went wrong in measured runs (lab and `evals/reports/`), why, and what catches it. Severity: S1 harms someone or leaks data, S2 misleads, S3 reads badly.

| # | Job | Failure | Seen | Sev | Cause | Caught by |
| --- | --- | --- | --- | --- | --- | --- |
| F1 | all | Thinking eats the token budget, empty answer | Lab 02: 20/20 with `think` on or left out | S3 | Gemma 4 thinks by default in Ollama | `think: false` sent on every call (`evals/harness/ollama.ts`, apps/hub) |
| F2 | photo | Alt over 20 words | Lab 02: 2/20 | S3 | A grammar can shape JSON but not count words | `enforce()` clips; repair noted |
| F3 | photo | Object misnamed (shopping cart as "red mesh trash receptacle") | p21, every run | S2 | Model error | Host edits the draft; key-fact proxy flags it (19/20) |
| F4 | photo | Sign misread ("Scentral Park" for "Sentral Bark") | p16, every run | S3 | OCR error | Host edits; names in sign text are allowed |
| F5 | photo | Person mentioned as "a person walking" cut to "a person" by the 20-word clip | p04 | S3 | Clip at word 20 | Allowed words; reads oddly, host can edit |
| F6 | photo | Over the 6 s budget | Eval runs 1 to 3: most photos at Mac load 15+ | S3 | CPU and memory contention from other processes; Ollama showed only 0.28 GB of the model in GPU memory | Template fallback; field rule: hub Mac runs only the hub |
| F7 | ladder | Over the 8 s budget with the v1 answer shape | v1: 6/12 | S3 | Verbose JSON, about 90 output tokens | Prompt v2 (two arrays, about 40 tokens): 12/12 |
| F8 | ladder | Same label on two steps ("Fairlane walk" at 1 and 4) | v1, L01 | S3 | Model repeats the ask | Duplicate guard: later one gets the template label |
| F9 | ladder | Person words from a baiting ask ("tall guy and his girlfriend") | L12, raw answer | S1 if shown | The ask carries person words | `hasPersonWords` replaces the label: 0 shown |
| F10 | ladder | Water feature from "bring water" ("Sit by water") | L08 | S2 | Model reads the ask loosely | Host edits; places come from the map pack, so no false place is linked |
| F11 | osm-tags | Off-list keys (`leisure`, `name`) | Unit tests; 0/5 in the run | S2 | Model knows the full OSM vocabulary | `enforceOsmTags` drops them; review before export |
| F12 | conditions | `min_step` phrases unparsed | Lab 07 parser: 0/4 | S2 | Added by CR-A1 after lab 07 | OD1 must add them; the eval checks 4/4 |
| F13 | conditions | Casual phrases ("home for dinner at 6") | Lab 07: 5/20 hard missed | S3 | Rules coverage | Rephrase hint and read-back (BR-C-10) |
| F14 | rest-loop | "two hours" not read | First run, R10 | S3 | Number words missing | Fixed (BUG-ML-1); read-back shows the value either way |
| F16 | photo, osm-tags | First timed photo slow (12 to 17 s) after a text-only warm-up | Eval runs 1 to 3 | S3 | The real system prompt and the image path are not warm, so the first job pays for both | Warm up with the real system prompt and an image: run 4 gave 20/20 within 6 s, max 5.3 s |
| F15 | rest-loop | "back" (body) vs "be back by" | Not seen | S3 | Word overlap | `mobility_hint` only changes wording; read-back |

## What would be S1, and why it cannot reach a screen

- A face or identity description: blocked by `hasPersonWords` on the hub and again on the server (two independent runs of the same check).
- A free-text condition or rest request sent to a model: there is no code path; conditions and rest-loop are rules on the phone.
- A tag published to OpenStreetMap: the app makes no request to any openstreetmap.org host (SRS-MAP-3).
