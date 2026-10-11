# AI performance per device class

Budgets: hub photo ≤ 6 s at the server (BR-AI-1), ladder ≤ 8 s (SRS-PLAN-2), read-back ≤ 12 words (SRS-COND-5), capability detect < 20 ms (ICD-8), shader gate ≥ 50 fps over 60 frames (ADR-0003).

## Phone side (rules tier, resize, probes)

| Device class | Browser | Conditions parse (per phrase) | detect() | 12 MP to 768 px JPEG (median of 3) | Output size | Shader gate | Source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Mac, Apple M4 (dev laptop) | Node 26.8.1 | 0.13 ms core_40, 0.09 ms hard_20 | | | | | `parseRaw` timing, 2026-10-10 21:25 ET |
| Mac, Apple M4 | Chrome 154.0.8037.99 (headless) | under 1 ms (/ai/ try field showed 1 ms, rounded) | 4.3 ms | 106 ms (132, 106, 98) | 23 KB | 59.9 fps, p95 16.7 ms: pass | `node apps/web/test/e2e/check-mac.ts`, 21:08 ET |
| Mac, Apple M4 | Safari 26.6.2 | not run tonight | | | | | Needs a hand run (no safaridriver); open /check/capability/ from `npm run device-check -- local` |
| iPhone 13 | Safari | | | | | | Sunday device check |
| iPhone 16 Pro Max | Safari | | | | | | Sunday device check |
| iPhone 17 Pro | Safari | | | | | | Sunday device check |
| iPhone 17 Pro Max | Safari | | | | | | Sunday device check |

How to fill an iPhone row on Sunday: `npm run device-check`, open the capability page on the phone, tap "Run resize test" and "Run shader gate", then "Send to laptop". The numbers land in `device-results/results.jsonl` under `s-icd8` (detect_ms), `s-resize` (median_ms, output_kb) and `s-shader` (median_fps, p95_frame_ms).

## Hub side (Gemma 4 E4B on the Mac)

| Condition | Photo, phone to server to hub and back | Ladder, hub code to Ollama | Source |
| --- | --- | --- | --- |
| Idle Mac, lab 02 | 3.0 s per photo, 39/40 quality | not measured | lab report 02 |
| Tonight, nine agents on the Mac (load average 16.7 to 21.8 on 10 cores) | 5 of 5 fell to the template at 6.0 to 6.1 s; hub jobs took 6.8 to 14.9 s | median 8.2 s (7.6 to 14.9 s), 5/5 usable, 2/5 within 8 s, labels ≤ 3 words | `node apps/hub/field/bench.ts`, 21:15 ET, before the BUG-ODAI-1 fix |
| One photo call, same load | 6.0 s: prompt 1.9 s (182 tokens), 45 tokens in 4.1 s | | Ollama timings, 21:17 ET |
| After the per-job budget (BUG-ODAI-1), load average 21 to 46 | 4 of 5 on the hub: 3.8 to 5.6 s (median 4.1 s); the 5th timed out cleanly at 6.0 s and nothing queued behind it | old prompt: median 8.5 s, 1/5 within 8 s | bench, 21:25 ET |
| Compact ladder prompt (`labels` + `minutes` arrays, num_predict 96), load average 21 to 32 | | median 4.9 s (4.3 to 5.6 s), 5/5 usable, 5/5 within 8 s, labels ≤ 3 words | bench, 21:28 ET |

Reading: the model is fast enough on an idle Mac (lab 02) and too slow under heavy load. On Sunday the hub laptop runs only the hub, the server tunnel and the device-check kit. `npm run hub:field` prints the load average every 30 s; above about 10, expect templates.

## hub:field soak

See the handoff (docs/handoffs/06f-on-device-ai.md) for the 30-minute run: drops, restarts and health lines.
