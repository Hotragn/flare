# Release candidate and deploy runbook (Sun 2026-10-11)

Owner: Engineering lead. Every step that touches the founder's accounts waits for the founder's yes, marked **YES**. Commands run from the repo root on the hub Mac. Nothing below prints a secret.

## 08:00 Integration point 3

```bash
git pull && npm ci && npm run ci
npm run build && node apps/web/test/e2e/flow.ts 5 real
npm run e2e:hello && npm run e2e:pwa
npm run e2e:field && npm run e2e:sparks && npm run e2e:loop && npm run e2e:telegram
```

Pass bar: CI green (GitHub Actions too), real flow 5/5 with 0 page errors, e2e-hello tier hub, PWA ALL PASS, field 27/27, sparks and loop all pass.

## 08:30 Device checklist

[05-device-checklist.md](05-device-checklist.md). It includes the Telegram live test from `lab/`, which must run **before** any `setWebhook`. Record the chat id it prints.

## 09:30 Tag the release candidate

```bash
git tag -a rc-1 -m "Flare RC 1 for the field test" && git push origin rc-1
```

## Deploy to Render (**YES**: deploy, free web service and free Postgres, $0; ADR-0005 amended)

1. Settings check, values never shown:
   ```bash
   npm run check-env -- server hub bot deploy
   npm run deploy:render
   ```
   The dry run lists every env var as set, missing, "from Render" or "not sent: account token". Account-wide tokens (a `dop_v1_` DigitalOcean token, a Sentry auth token) are never sent; that feature stays off on Render.
2. After the founder's yes:
   ```bash
   npm run deploy:render -- --yes
   ```
   It finds or creates `flare-db` (free Postgres, Ohio) and `flare-outside` (free web service, health `/api/v1/health`), sets env, and starts a deploy. No cron: the server sweeps itself every 60 s and at boot. It prints the `https://….onrender.com` URL. First deploy takes about 5 minutes.
   Free tier: the server sleeps after 15 min idle and wakes in 30 to 60 s. The hub's keep-warm ping (every 5 min) keeps it awake for the whole test; start the hub before the phones open the app.

## 09:45 Connect the hub

On the hub Mac, with every other app closed and the Mac plugged in:

```bash
FLARE_SERVER_URL=wss://flare-outside.onrender.com npm run hub:field
```

The health line every 30 s must show the server link up and the model loaded, and `hub: keep-warm 200` every 5 min. Keep the load below about 10, or photos miss the 6 s budget and fall back to typed words.

## 09:50 Smoke test

```bash
npm run smoke -- https://flare-outside.onrender.com
npm run smoke -- https://flare-outside.onrender.com
```

Run it twice: the first photo draft after a hub start pays a one-time model cost. Pass bar: all required checks ok; on the second run `photo draft: hub`.

## 09:55 Telegram (**YES**: setWebhook)

1. Put the chat id from the device check in `.env` as `TELEGRAM_ALLOWED_CHAT_IDS`.
2. `npm run deploy:render -- --yes` again (updates env, redeploys).
3. `npm run telegram:webhook -- --yes`, then `npm run telegram:status` (webhook set, 0 pending).
4. Connect the field group from the app (ADR-0023): the host sends one Flare by link (this makes the group), then Menu, **Post in Telegram**, **Add the bot**, pick "Flare test" in Telegram, tap Start. The screen shows "Connected." Leave **Show photos** off unless the group agrees to photos.
5. The host sends a test Flare: the group gets the branded card with I'm in, Add a condition, Open in Flare. One person taps **I'm in** (private reply, the card redraws with the count), another taps **Not now**. End it; every bot message deletes within about 20 s.

## 10:00 Phones

Each phone opens `https://flare-outside.onrender.com/app/`, adds it to the Home Screen, opens it from the icon and allows notifications when asked. Then the founder sends the real Plan (E15-S5) before 11:00.

## During the test (11:00 to 15:00)

- **Compass:** keep at least 30 m apart for Find them to point. Closer than about twice the GPS accuracy (often 3 to 8 m) it says "{name} is close. Look around." on purpose (device check, Sun 10:15).

- Render log stream filtered to `hub.` and `error`.
- `curl -s https://flare-outside.onrender.com/api/v1/health` every few minutes: `hub` must stay `connected`.
- Sentry (if `SENTRY_DSN` is set): AI spans `invoke_agent flare-photo` and `flare-ladder` with tiers.

## After the test

```bash
curl -s https://flare-outside.onrender.com/api/v1/audit
DATABASE_URL=<flare-db external URL from the Render dashboard> npm run kpi
```

The audit must show `pass: true` for the post. `kpi` reads the day-bucket counters (07-kpis.md); run it in the Render shell or locally with the external URL, never committed.

## Rollback

- Bad deploy: Render dashboard → flare-outside → Deploys → redeploy the previous one. The hub reconnects within 30 s.
- Hub trouble: drafts fall to typed words automatically; restart with the hub command above.
- Telegram trouble: the field test runs on links and the plain-text form; the bot can be removed from the group.
