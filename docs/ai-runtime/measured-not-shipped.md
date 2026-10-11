# Measured, not shipped (CR-E2)

In-browser models the lab ran on 2026-10-10, and why none ships on phones. Apple M4 MacBook (24 GB), Chrome 154.0.8037.99, Safari 26.6.2, Transformers.js 4.3.1. Sources: lab reports 01, 07 and 09 (`lab/reports/`, not in the repo).

| Model | Task | Download | Result | Why not shipped |
| --- | --- | --- | --- | --- |
| Gemma 4 E2B (q4f16) | Photo to six words | 3.38 GB | Mac Chrome: 2.3 s per photo, 20/20 valid JSON, quality 29/40 (descriptions) | Needs one 1,174,405,120-byte GPU buffer; iOS WebKit caps buffers at 1 GiB. Used 11 to 13 GB of browser memory; iPhone tabs die near 2 GB. |
| Gemma 4 E2B on MediaPipe / LiteRT-LM web | Photo | | Text only | Image prompts fail. |
| SmolVLM-500M (q4f16) | Photo | 363 MB | Caption mode 16/40; 6 of 20 wrong enough to mislead; JSON mode unusable | Quality, and a Safari tab grew to 6.9 GB. |
| Qwen3-0.6B | Conditions | 570 MB | Model-only 26/40 core, hybrid with rules 40/40 core and 16/20 hard, 515 ms | No better than the rules alone (now 18/20 hard), 8.0 GB Chrome peak. |
| Qwen3.5-0.8B-Text | Conditions | 470 MB | 22/40 core model-only; hybrid 13/20 hard | No better than the rules. |
| LFM2.5-350M | Conditions | 255 MB | 12/40 core model-only; hybrid 15/20 hard | No better than the rules. |
| Gemma 3 270M | Conditions | 273 MB | 10/40 core model-only; echoed examples with the long prompt | No better than the rules. |
| SmolLM2-360M | Conditions | 272 MB | 0/40 core; empty output in the browser | Too weak. |
| Granite 4.0 H 350M | Conditions | 238 MB | WebGPU output stops after `{"rules":`; WASM lacks a kernel | Doesn't run in the browser yet. |

What ships instead:

- Photo: Gemma 4 E4B on the hub laptop (lab 02: 3.0 s, 39/40) with the typed fallback.
- Conditions: the rules parser, 40/40 core and 18/20 hard, 0.09 to 0.13 ms per phrase in Node, zero download.

The copy deck still has `ai.offer`, `ai.download` and related keys for an optional on-phone conditions model. They are unused on purpose. Revisit only with a new iPhone measurement using the crash-marker page pattern from lab 04.
