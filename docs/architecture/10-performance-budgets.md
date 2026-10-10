# Flare: Performance budgets (iPhone 13)

Version 1.0, Sat 2026-10-10. Owner: Architect. Target device: iPhone 13 (A15, 4 GB RAM, 60 Hz). Requirements: SRS-PERF-1 to 4, SRS-CRE-1, SRS-CRE-9, SRS-RES-3, SRS-RES-7, SRS-SOL-3, SRS-LIT-1.

## 1. Budgets

| # | What | Budget | How measured | Now |
| --- | --- | --- | --- | --- |
| B1 | Link page time to interactive | ≤ 2.0 s, simulated 4G (Lighthouse mobile, 4x CPU) and a real iPhone 13 on cellular | Lighthouse CI on `/g/{id}`; Sunday stopwatch | Engineering |
| B2 | JavaScript, gzipped, any page | ≤ 150 KB (excluding model files; we ship none) | `npm run budget` in CI | 57.1 KB for the whole build |
| B3 | CSS, gzipped | ≤ 30 KB | build report | Engineering |
| B4 | Fonts | ≤ 2 files, ≤ 90 KB total, WOFF2, subset to Latin, `font-display: swap` | build report | Engineering |
| B5 | Invite photo download (sealed 1600 px) | ≤ 350 KB | upload check on the phone | Engineering |
| B6 | Draft upload (768 px, q0.7) | ≤ 150 KB | e2e-hello | 13 KB for the illustration fixture; real photos measured Sunday (lab 08: 1024 px median 431 KB, so 768 px was chosen) |
| B7 | Camera live after app open (warm) | ≤ 1.5 s | Performance mark `camera-live` | Sunday |
| B8 | Shutter to six words (hub) | ≤ 6 s; typical 3.8 s | e2e-hello browser round trip | 3.82 s |
| B9 | "You're in." after tap | ≤ 500 ms (optimistic, local) | Performance mark | Engineering |
| B10 | API p95 for yes, take-back, arrival | ≤ 300 ms with 20 concurrent clients | `npm run load` (autocannon, engineering) | Engineering |
| B11 | Count update to every open viewer | ≤ 5 s | SSE fan-out test with 12 clients | Engineering |
| B12 | Lit notice delivered | ≤ 10 s | push timestamp vs lit_at, Sunday | Sunday |
| B13 | Flame animation | 60 fps, main thread ≤ 4 ms per frame; falls back to CSS below 50 fps over 60 frames | `/lab/fps` on the phone | M4: 60 fps, 2.3% main thread |
| B14 | Solver | ≤ 5 ms for 12 members, 4 rules each, 4 steps | Vitest bench | Engineering |
| B15 | Map pack | ≤ 10 KB raw | file size check | 6.7 KB |
| B16 | Memory on the link page | ≤ 150 MB | Safari Web Inspector, Sunday | Sunday |
| B17 | Host open to Send | median ≤ 15 s over 5 trials | stopwatch | Sunday |
| B18 | Friend open to "I'm in" | median ≤ 10 s over 5 trials | stopwatch | Sunday |

## 2. Rules that keep us inside

1. No dependency over 10 KB gzipped on the link page without an ADR.
2. Prerender every route (adapter-static); the server sends files, not rendered HTML.
3. Lazy-load the host camera route, compass and Plan editor; the link page loads only what I0 to I4 need.
4. Images: `createImageBitmap` + `OffscreenCanvas` off the main thread where available; never decode the full camera frame twice.
5. Animate only `transform` and `opacity` (motion.md); the shader caps DPR at 2 and pauses when hidden.
6. One SSE connection per page; no polling faster than 30 s.
7. Service worker precache list stays under 500 KB.

## 3. iPhone checks page

`/check` (SRS-CAP-1) on each phone reports the device's numbers for B7, B9, B13 and B16 with "Copy report", so the Sunday morning run produces a table in minutes. The lab's `/lab/fps` and `/lab/haptics` pages in the prototype cover the flame and haptics until `/check` ships.
