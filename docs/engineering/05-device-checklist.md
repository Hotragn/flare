# Sunday-morning device checklist

For Sun 2026-10-11, 08:30 ET, all four iPhones at once (13, 16 Pro Max, 17 Pro, 17 Pro Max). About 17 minutes per phone (1 to prepare, 16 for the checks), all phones in parallel, after 5 minutes of laptop setup. One person runs the laptop; each phone holder follows the steps. Measures D1 to D9 from [03-spikes.md](03-spikes.md) section 5.

## 0. Laptop setup (one person, 5 min, before the phones)

1. Mac on the same Wi-Fi the phones will use, plugged in, every other app closed. It runs only the hub (`npm run hub:field`) and this kit: Gemma misses the 6 s photo budget when the Mac is busy (load above about 10).
2. Terminal 1, from the repo root:
   ```bash
   caffeinate -dims &
   npm run device-check
   ```
   It prints `https://<mac-ip>:8443/check/`. If macOS asks to let node accept connections, choose Allow, for this test only. (If the founder has approved the Render deploy by now, use `https://<render-host>/check/capability/` and `/check/compass.html` too, for the service-worker card: D3.)
3. Terminal 2, from `lab/` (the lab's own script; it writes to `lab/spikes/03-telegram/results/`):
   ```bash
   node spikes/03-telegram/tg.mjs morning --minutes 20 --taps 5
   ```
   It waits for `/start@FairlaneFlareBot` in "Flare test". **Run this before anyone calls setWebhook**: Telegram allows polling or a webhook, not both.
4. Write the URL from step 2 large on a sheet, or AirDrop it to the four phones.

## 1. Each phone, first (1 min)

- Same Wi-Fi as the Mac. Settings, Cellular: **Wi-Fi Assist off** for the test.
- **Low Power Mode off** (it caps animation at 30 fps).
- Settings, Sounds & Haptics: **System Haptics on**.
- Brightness up. Silent switch **off** to start.
- Write down the phone model on the sheet; iOS version is in Settings, General, About (D1).

## 2. The checks, in order (16 min)

| # | Step | Time | What to do | Record | Pass bar |
| --- | --- | --- | --- | --- | --- |
| 1 | Open the kit | 0.5 min | In Safari, type the URL exactly. On "This Connection Is Not Private": Show Details, visit this website, Visit Website | | Checklist page opens |
| 2 | **Capability page** | 4 min | Tap "Open capability page". Tap every button top to bottom; allow Motion, Location, Camera when asked. For Camera, take any photo. Do **Switch haptic** and **Audio** once, then flip the silent switch **on** and do both again. Tap **Send to laptop** (or Copy results) | Every card's status | Compass, Location, Camera OK; voices listed; Offline fails here with a self-signed certificate (expected, D3) |
| 3 | **Flame fps** | 3 min | Back, "Open flame check". WebGL, state **lit**, "Run 10 s test", phone still. Then state **cycle**, run again. Then **CSS**, lit, run. Copy results | fps, p95 per run (D5) | WebGL lit ≥ 50 fps on every phone. Below that on the 13: the shader gate falls back to CSS (fine, record it) |
| 4 | **Haptics** | 2 min | Back, "Open haptics check". Test 1 (native switch), 2 (switch overlay), 3 (script click), 4 (vibrate). Answer Felt it or Nothing honestly. Copy results | Felt it or Nothing per test (D6) | Test 2 felt. If test 1 is felt but 2 is not: haptics fall back to sound on that iOS (record the version) |
| 5a | **Telegram "Not now"** | 1 min | Done at ~07:45 ET already: post, count edits, notify post, deletes, deep link, and an "I'm in" tap answered privately with the ephemeral message; chat id is in `.env`. Still open: the "Not now" tap missed the lab script's window. When Terminal 2 says waiting, one person taps **Not now** on a fresh post | Terminal 2 output; screenshot of the private reply | `answerCallbackQuery` ok for "Not now", nothing posted to the group, count unchanged |
| 5 | **Telegram** | 3 min | When Terminal 2 says waiting: **one** person sends `/start@FairlaneFlareBot` in "Flare test". Then two people tap **I'm in**, one taps **Not now**, one opens the deep link the bot posts and taps Start. Watch the count edit in place | Terminal 2 output; screenshots of the private toast (D7) | Private toast seen only by the tapper; count edits; the bot's messages delete at the end |
| 6 | **Compass** (outside, open sky) | 3 min | Back, "Open compass check". Tap **Start compass**, allow both. Stand still, **Mark this spot**, walk about 30 m, turn slowly in a full circle, listening. Point the phone at the spot: the tone plays. Send to laptop | Orientation and location results, events per second, compass accuracy, first fix ms, best accuracy m (D8, D9) | Prompt appears from the tap; arrow points back within about 20°; distance 25 to 35 m; speech says the direction |
| 7 | Done | 0.5 min | Hand the phone back | | |

## 3. Right after (laptop, 5 min)

1. Results: `device-results/results.jsonl` (kit pages), Terminal 2 output and `lab/spikes/03-telegram/results/api-log.jsonl` (Telegram), plus the copied fps and haptics text pasted in the chat.
2. Stop the kit (Ctrl-C) and `caffeinate` when the field test no longer needs the Mac awake. (The hub needs it awake all day: keep it running if `npm run hub:field` is up.)
3. Fill the table below and commit it as `docs/engineering/evidence/device-check-2026-10-11.md`. Do not commit `device-results/` (git-ignored).

| Phone | iOS | Compass prompt | Heading OK | Loc. accuracy m | WebGL lit fps | Overlay haptic | Silent-switch audio | Telegram | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| iPhone 13 | | | | | | | | | |
| iPhone 16 Pro Max | | | | | | | | | |
| iPhone 17 Pro | | | | | | | | | |
| iPhone 17 Pro Max | | | | | | | | | |

## 4. If a check fails

| Failure | Decision already made | Who acts |
| --- | --- | --- |
| WebGL < 50 fps on a phone | The gate shows the CSS flame there (ADR-0003); nothing to change | FE: confirm the gate fires on that phone |
| Overlay haptic not felt | Facing and yes use the tone and on-screen change; haptics stay for phones that feel them (SRS-CMP-3) | FE |
| No orientation prompt | Check Settings, Safari, Motion & Orientation Access; if still none, the compass shows distance and spoken words only | FE, note for the post |
| Location poor (> 30 m) | Keep the meeting spot rule (named place), compass as an extra | Field lead |
| Telegram test can't start (no `/start` seen) | Field test runs on links and the plain-text form; the bot post is skipped | Founder |
| Voices missing offline | Speech needs signal on that phone; the Lit screen text still works | Note for the post |
| Kit unreachable on the phones | Check the Mac firewall, guest Wi-Fi isolation, Wi-Fi Assist; or use the Render URL if deployed | Laptop person |
