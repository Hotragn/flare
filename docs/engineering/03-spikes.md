# Flare: Spikes on the riskiest unknowns

Version 1.0, Sat 2026-10-10. Owner: Engineering lead. Lab spikes (L01 to L09) were run by the lab session and are cited from `lab/reports/` (read-only, git-ignored); none was re-run. Engineering spikes E1 to E3 were run here, with code in `scripts/spikes/` and raw output in [spikes/evidence/](spikes/evidence/).

## 1. Risk register and where each answer comes from

| # | Unknown | Risk if wrong | Answer | Source |
| --- | --- | --- | --- | --- |
| R1 | Can photo AI run in iPhone Safari? | Whole tier plan | No. Gemma 4 E2B needs one 1,174,405,120-byte GPU buffer; iOS WebKit caps buffers at 1 GiB; tabs die near 2 GB | L01 (lab/reports/01) |
| R2 | Is the hub model good and fast? | Six words late or bad | `gemma4:e4b-it-q4_K_M`, `think:false`, prompt v2: 3.0 s, 20/20 usable after `enforce()`, quality 39/40; `think` unset gave 0/20 | L02 |
| R3 | Telegram private replies and edits | Bot design | `answerCallbackQuery` is private and guaranteed; ephemeral messages are a bonus; edit one message per Flare; 20 messages/min per group; delete within 48 h. **Live group test still waits for a human `/start`** | L03 |
| R4 | Which phone features work? | Feature plan | Page built and checked on desktop; phones on Sunday (checklist step 1) | L04 |
| R5 | Is OSM data reachable and enough? | Spot names, Ember, access line | 6.7 KB pack, 128 features; only overpass-api.de answered; default User-Agent gets 406. Gaps found here: no `picnic_table`, no named natural features, no streets, centre 733 m east of TEST_AREA (MP1 fixes) | L05 + desk check |
| R6 | Flame technique and cost | Jank on iPhone 13 | WebGL2 shader 1.9 KB, 2.3% main thread, 60 fps on M4 at 4x throttle; iPhone unmeasured (checklist step 2) | L06 |
| R7 | Conditions on the phone | Parser quality | Rules: 40/40 core, 15/20 hard, < 1 ms; Qwen3-0.6B added 1/20 and hung Safari | L07 |
| R8 | Reaching the hub from the field | No AI in the field | Outbound WebSocket relay; Ollama on CPU took 126 to 215 s per photo | L08 |
| R9 | Offline photo description | Wrong words | SmolVLM 2/20 right, 6/20 misleading; use typed words with chips | L09 |
| R10 | Relay under loss, resets and silent drops | Silent loss of AI words in the field | **E1 below: found and fixed a dead-link bug** | E1 |
| R11 | Does the sweep meet "deleted within 5 minutes"? | Broken privacy promise | **E2 below: worst case 90 s, 0 orphans** | E2 |
| R12 | iOS compass permission flow | Compass never prompts | **E3 below: flow correct under an iOS-like shim; real prompt on the phones** | E3 |
| R13 | CSP vs our libraries | Broken page in Safari | BUG-029: zod's eval probe triggered a CSP report; fixed with `jitless`; 7/7 clean e2e runs | e2e-hello |

## 2. E1: hub relay over a real WebSocket under faults

**Question.** Does the relay keep working with mobile-grade latency, packet loss, connection resets and silent (half-open) drops, and does health tell the truth?

**Method.** `node scripts/spikes/relay-faults.ts --seconds 60`. Real server and real hub as child processes; a TCP proxy between them injects faults on the hub leg; Ollama faked at a fixed 300 ms so the numbers measure the relay. One draft per second for 60 s per case; health polled every 0.5 s. Loss is modelled as TCP sees it: each chunk, with probability p, is held 0.2 to 1 s (a retransmission), blocking what follows. A silent drop stops all bytes, closes included, on the open connection; new connections work.

**Results** (60 drafts per case; "hub" = AI words came back; the rest got the template):

| Case | Before: hub, p95 | After: hub, p95 | Notes |
| --- | --- | --- | --- |
| Baseline | 60/60, 315 ms | 60/60, 317 ms | |
| Latency 150 ms + 50 ms jitter each way | 60/60, 703 ms | 60/60, 703 ms | |
| Loss 5% | 60/60, 1,080 ms | 60/60, 1,132 ms | No false drops with the 5 s heartbeat |
| Loss 15% | 60/60, 1,340 ms | 60/60, 1,340 ms | Max stall 1.8 s, far under the 12.5 s drop time |
| Reset every 10 s | 50/60, 6,006 ms | **55/60, 315 ms** | Pending jobs now fail fast; redial 0.3 s after each reset (was 1.1 s) |
| Silent drop at 10 s | 10/60, health wrong for 54.5 s, **never recovered** | **43/60, health right after 8.5 s, recovered in 16.1 s** | BUG-030 |

Before = commit 0da4da5 relay code with the corrected proxy (relay-before-v1.json). After = heartbeat v2 (relay-after-v2.json, relay-after-v2-halfopen.json). An earlier "after" run showed 9.2 s recovery because the proxy passed the server's close through to the hub; a true half-open link doesn't, so 16.1 s is the honest number.

**What changed in code.** Server pings every 5 s, drops a hub silent for 12.5 s, probes 3 s after any job timeout, and answers pending jobs the moment their socket closes. The hub drops a server silent for 15 s and redials after 250 ms. Tests: `apps/server/test/relay.test.ts`, `apps/hub/test/reconnect.test.ts`.

**Residual.** During the first 8.5 s of a silent drop, drafts wait up to 6 s and then get the template; the host can always type. Real cellular loss on the Mac's home connection is not measured; the field test watches `hub.silent` events in the log.

**Tool bug found.** The first proxy reordered bytes under jitter (BUG-032), which looked like relay losses. Fixed before the numbers above.

## 3. E2: Postgres deletion timing with the sweep

**Question.** Does the planned sweep delete everything about a Gone gathering within BR-D-1's 5 minutes, at what cost, and with no orphans?

**Method.** `node scripts/spikes/deletion-timing.ts --gatherings 1000 --photo-kb 150` on PGlite 0.5.8 (Postgres 17 as WASM, single connection; native Postgres is faster, so these are upper bounds). Seed: 1,000 gatherings with 12 answers, a 150 KB photo, 3 jobs, 2 bot messages, a live location and a bind token each (20,000 rows plus 150 MB of photos).

**Results** (deletion-timing.txt):

| Measure | Result |
| --- | --- |
| Sweep 1 Gone gathering with all its rows | 2.8 ms |
| Sweep 10 / 100 / 250 | 5.5 / 35.7 / 70 ms (0.28 ms per gathering at 250) |
| Plan cost without and with the partial index `gatherings_gone` | 242 → 12.6 (the timing gain could not be isolated in this run, since table size changed between steps) |
| Audit query over 7 tables | 1.8 ms |
| Expiry backstop: 20 gatherings the engine never ended, `expires_at` past | All 20 deleted in one sweep, 4 ms |
| Timed loop scaled 10x (grace 6 s, interval 3 s): 40 gatherings going Gone at random times | Deleted after 6.0 to 9.0 s, median 7.5 s; bound 9 s holds |
| Production equivalent (grace 60 s, interval 30 s) | **Worst case 90 s** after Gone, inside 300 s |
| Orphans in the 6 child tables after all sweeps | **0** |

**Decision.** Ship the sweep SQL from the spike, batches of 200, every 30 s plus the 5-minute Render cron; migration 0002 adds the partial index. If the web service is down, the cron bounds deletion at 5 minutes; if both are down, rows are past `expires_at` and never served (reads filter on it).

## 4. E3: iOS compass permission flow

**Question.** Does our flow ask for Motion and Orientation the way Safari requires, degrade correctly when denied, and point the right way?

**Method.** `node scripts/spikes/compass-flow.ts`: the real compass check page (`apps/web/static/check/compass.html`) in Chrome at 390 × 844 with a shim that behaves like WebKit. `DeviceOrientationEvent.requestPermission()` exists, rejects with `NotAllowedError` without transient user activation, and resolves `granted` or `denied`. Synthetic `deviceorientation` events carry `webkitCompassHeading`. Geolocation is set by Playwright: the target is marked, then the phone "walks" 30 m south.

**Results: 21/21 checks pass** (compass-flow.txt):
- Permission is requested inside the tap (activation true), and location is asked after it.
- Granted: heading 0°, 90°, 270° and 180° say "straight ahead", "to your left", "to your right" and "behind you", at 30 m.
- The facing tone fires once when pointing at the target, and the heading source is `webkitCompassHeading`.
- Denied: distance only, "Hold your phone flat to get a direction.", and a pointer to Settings.
- Control: a call outside a tap is refused (`NotAllowedError`).
- Location denied: the page says to check Location Services.
- The copied results carry no coordinates, and the page has no errors.

**Why not Safari's responsive design mode.** It is desktop Safari in a phone-sized window. It has no `requestPermission` prompt and no orientation sensor, so it can't test this flow. Driving Safari by script needs `safaridriver --enable`, which needs an admin password we don't use. Playwright's WebKit build would need a browser download outside what is approved. The real prompt is therefore step 5 of the Sunday checklist.

**What can't be known here.** Whether iOS keeps activation across our one `await` (we call it first, so it shouldn't matter); real heading accuracy; whether the prompt shows in the Home Screen app as well as in Safari.

## 5. Only measurable on our iPhones Sunday morning

| # | Measure | Why only there | Checklist step | Pass bar |
| --- | --- | --- | --- | --- |
| D1 | iOS and Safari version on each phone | Unknown until then (SRS §2.3) | 1 | Recorded |
| D2 | WebGPU limits, storage quota | Informational; no phone model ships | 1 | Recorded |
| D3 | Service worker with a trusted certificate, offline reload | Needs the Render URL (founder's yes); self-signed fails by design | 1 (after deploy) | Reloads in Airplane Mode |
| D4 | Speech voices offline, audio with the silent switch | Device setting | 1 | Speaks in Airplane Mode |
| D5 | Flame shader fps and p95 on the iPhone 13 | A15 vs M4 | 2 | ≥ 50 fps, else the CSS flame by gate |
| D6 | Switch-overlay haptic on iOS 26.5+ | Can't be detected in code | 3 | "Felt it" on overlay |
| D7 | Telegram live group test (tap, private reply, edit, delete) | Needs a person in "Flare test" | 4 | All 7 steps logged |
| D8 | Compass prompt, heading accuracy, speech | Real sensors | 5 | Arrow within 20° at 30 m (SRS-CMP-4 asks ≤ 20°) |
| D9 | GPS first fix and accuracy outdoors | Real sky | 1 and 5 | ≤ 10 m at 100 m (SRS-CMP-4) |
| D10 | Web Push on the Home Screen app | iOS 16.4+ and install state | After RC | Lit notice ≤ 10 s |
| D11 | Link page time to interactive on cellular | Real network | Field test | ≤ 2.0 s (B1) |
| D12 | Camera live after open | Real camera | Field test | ≤ 1.5 s (B7) |
| D13 | Link page inside Telegram's in-app browser, iMessage, WhatsApp | Real apps | Field test | Opens, key read (SRS-COMP-3) |
| D14 | Dictation runs on Apple servers or on the phone | Device setting | 1 (note) | Recorded; copy `perm.mic.body` matches |
| D15 | Restrooms inside Fairlane Town Center are mapped | Ground truth (L05) | Field test | Note for the access line |
