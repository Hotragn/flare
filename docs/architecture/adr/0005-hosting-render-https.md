# ADR-0005: One Render web service plus Render Postgres; HTTPS from day one

Status: Accepted (deploy itself waits for the founder's yes). Date: 2026-10-10. **Amended Sun 2026-10-11 ~10:30 ET: free tier** (below).

## Amendment: Render free tier (founder decision, no paid hosting)

- **Web service and Postgres on the free plan.** No cron job (the free tier has none): the server sweeps in process every 60 s, and once at boot.
- **Sleep.** A free web service sleeps after 15 minutes without inbound HTTP traffic and takes about 30 to 60 s to wake. While the hub runs, it asks for `/api/v1/health` every 5 minutes (`apps/hub/src/main.ts`, `FLARE_KEEP_WARM_MS`), which keeps the server awake, so relaying photos, timers and the deletion sweep all run. The phone shows "Waking up the server. About a minute." on any request slower than 4 s (`lib/net/waking.svelte.ts`).
- **What this costs the privacy promise, said plainly.** "Deleted within 5 minutes of the end" holds while the server is awake: during the field test, and for 15 minutes after anyone last used it. A Flare that ends or expires while the server is asleep (nobody using it, hub off) is deleted the moment it next wakes, by the boot sweep. The privacy page says so (`site.privacy.l.sleep`).
- **Free Postgres** expires after 30 days on Render; fine for a challenge entry, and everything in it is short-lived by design.
- The Starter rationale below stays for the record; the founder chose $0 over no sleep.


## Context
Phones need HTTPS for the camera, geolocation, device orientation, service workers and Web Push (lab report 04). The hub needs a server it can dial out to (ADR-0006). RENDER_KEY is available for the Render API. Ollama cannot run on Render: CPU-only E4B took 126 to 215 s per photo (lab report 08).

## Decision
- **Web service** `flare-outside`: Node 24.21.0, build `npm ci && npm run build`, start `npm start`. Serves the API, the hub WebSocket on `/hub`, the SSE streams and the static web build. Starter plan ($7/month) on test day so it does not sleep; the free plan sleeps after 15 minutes idle, which would drop the hub socket and add a cold start.
- **Postgres**: Render Postgres, same region (Ohio, closest to Dearborn), internal URL.
- **Cron job**: `npm run sweep` every 5 minutes (ADR-0004).
- **TLS**: Render's managed certificate on `*.onrender.com`; `Strict-Transport-Security` from the app.
- **Health check path**: `/api/v1/health`.
- **Secrets**: set in the Render dashboard or by API from `.env`, never in `render.yaml`.
- One instance only: the hub relay and SSE fan-out keep state in memory. Two instances would split the hub from half the phones.

## Consequences
- A deploy restarts the process; the hub reconnects within 1 to 30 s (backoff), phones' SSE reconnect with `Last-Event-ID`, and timers are rebuilt from the `jobs` table (SRS-ST-2).
- Scaling past one instance would need the relay and fan-out in Postgres `LISTEN/NOTIFY`; not needed for 4 phones and groups of 12.

## Options weighed
| Option | Why not |
| --- | --- |
| Fly.io, Railway | No key on hand; Render has a partner category we qualify for honestly (we really deploy there) |
| Self-signed LAN HTTPS from the Mac | Works only on the same Wi-Fi; the field test is outdoors on cellular |
| Tailscale Funnel to the Mac | Kept as backup in lab report 08; needs the founder's yes |
