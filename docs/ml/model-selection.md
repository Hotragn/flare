# Model selection

Owner: ML. Date: 2026-10-10. Evidence: lab reports 01, 02, 07, 09 (read-only, in lab/reports) and the eval reports in `evals/reports/`.

## What ships

| Tier | Job | Model | Why |
| --- | --- | --- | --- |
| Hub (the Mac) | Photo to invite + scene, Plan ladder, OSM tag draft | `gemma4:e4b-it-q4_K_M` (Gemma 4 E4B, GGUF Q4_K_M, 7.5B params, 6.58 GB) on Ollama 0.40.2, llama.cpp runner | Lab 02: 20/20 JSON, 20/20 usable after `enforce()`, 3.0 s median, best quality measured (39/40 scenes, 39/40 invites). This eval runner: same 20 answers word for word (temperature 0, seed 42) |
| Phone | Conditions, rest-loop requests, needs checks | No model. Rules: the conditions parser (ODAI, lab 07) and `parseRestRequest()` | Lab 07: rules 40/40 core, 15/20 hard, under 1 ms, 0 MB download. Best phone model (Qwen3-0.6B) scored 26/40 and hung Safari |
| Template | Every job | No model | Floor for BR-AI-1. Always valid: template invite, template ladder (561 totals tested), manual tag picker, rest-loop pickers |

Settings for every hub call (lab 02, architecture 07 B3): `stream: false`, `think: false` (sent explicitly, or thinking eats the answer), no `format` (it doubled latency on GGUF and returns HTTP 501 on the Homebrew MLX build), `temperature: 0`, `seed: 42`, `keep_alive: 30m`. `num_predict`: photo 128, ladder 80, OSM tags 96.

Use the `-it-q4_K_M` tag. The plain `gemma4:e4b` tag resolves to the MLX build on Apple Silicon, which cannot do structured output and is 9.5 GB.

## Measured, not shipped

| Model | Where | Result | Why not |
| --- | --- | --- | --- |
| Gemma 4 E2B ONNX q4f16 (Transformers.js 4.3.1) | Chrome on the Mac (lab 01) | 20/20 JSON, 2.3 s, scenes 29/40, invites 26/40 | Needs one 1.17 GB WebGPU buffer; iOS WebKit caps buffers at 1 GiB and kills tabs near 2 GB. Invents water and sunsets |
| Gemma 4 E2B LiteRT-LM web | Chrome (lab 01) | Text only | No image input |
| Gemma 4 E2B MediaPipe text (2.0 GB) | Chrome (lab 07) | Needed 3.4 GB | Does not fit an iPhone tab |
| Qwen3-0.6B (570 MB, Apache-2.0) | Safari and Chrome (lab 07) | 26/40 core, 10/20 hard alone; +1 hard behind rules | Hung Safari at 2.0 and 5.7 GB; gain too small |
| SmolVLM-500M-Instruct q4f16 (363 MB, Apache-2.0) | Chrome and Safari (lab 01, 09) | Scenes 16/40, 6/20 misleading, 1 identity word | Quality; 6.9 GB Safari tab peak |
| SmolVLM-256M-Instruct (Apache-2.0) | Chrome (lab 01) | No usable text | Quality |
| `gemma4:e4b` MLX build | Ollama (lab 02) | 20/20 prompt-only, 3.9 s; any `format` gives HTTP 501 | Slower, larger, no schema path |

## Licenses and attribution

| Component | License | What we do |
| --- | --- | --- |
| Gemma 4 model weights | Gemma Terms of Use (ai.google.dev/gemma/terms) and the Gemma Prohibited Use Policy | Run locally on the hub Mac. Weights are pulled by Ollama on that Mac and **never redistributed**: not in the repo, not in the app, not on the server. Our use (place descriptions and plan labels) is inside the use policy. Attribution: "Gemma is provided under and subject to the Gemma Terms of Use found at ai.google.dev/gemma/terms" (in this file; handoff 06e asks WEB to add the same line to the "How it works" page) |
| Ollama 0.40.2 | MIT | Installed by Homebrew on the hub Mac; not bundled |
| llama.cpp (inside Ollama) | MIT | Same |
| Qwen3-0.6B, SmolVLM | Apache-2.0 | Lab only; not shipped |
| Eval photos | Per item, from Wikimedia Commons (public domain, CC0, CC BY 2.0/4.0, CC BY-SA 2.0/4.0) | Read in place from lab/data/photos; not copied into the repo or the app. Licenses per item in `evals/datasheets/photos.md` |
| OpenStreetMap data (map pack, tag drafts) | ODbL | Owned by Maps; tag drafts are exports only and nothing is sent to OSM (FR-MAP-4) |

## When to re-select

Re-run `npm run eval -- all` and update this file when any of these change: the Ollama version, the model tag, a prompt version, or the hub Mac. A model change must meet every bar in `quality-bars.md`.
