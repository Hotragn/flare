# ADR-0006: The Mac hub dials out to the server over a WebSocket

Status: Accepted. Date: 2026-10-10. From lab report 08.

## Context
Photo AI runs on the team's Mac (Gemma 4 E4B, 3.0 s per photo on its GPU). Phones in the field are on cellular. The Mac is behind home NAT and must not be exposed to the internet.

## Decision
The hub (`apps/hub`) opens `wss://{server}/hub` with `Authorization: Bearer {HUB_SECRET}` and keeps it open. The server sends jobs down it and waits for results. Protocol `flare-hub.v1`, in [asyncapi.yaml](../contracts/asyncapi.yaml):
- Text frames carry JSON (`hello`, `job`, `result`, `ping`, `pong`), validated by zod on both ends (`packages/shared/src/hub-protocol.ts`).
- A photo is one `job` header then one binary frame (the 768 px JPEG, about 13 to 150 KB). No base64 on the wire.
- Server pings every 20 s; the hub reconnects with backoff 1 s to 30 s; a new hub replaces the old one (close code 4000).
- Budgets: 6 s per photo job (BR-AI-1), 8 s per ladder job (SRS-PLAN-2). Late results are dropped; the phone already has the template.
- The secret is compared with `timingSafeEqual`; a wrong secret gets HTTP 401 and no upgrade.

## Numbers
`npm run e2e:hello` (docs/architecture/evidence/e2e-hello.txt): browser round trip 3.85 s, hub job 3.5 s, upload 13 KB. The relay adds about 0.3 s on localhost; lab report 08 estimates 50 to 150 ms more through Render.

## Consequences
- Nothing on the Mac listens on a port. If the Mac sleeps or loses Wi-Fi, `/api/v1/health` says `hub: absent` and every draft falls to the typed template within the 6 s budget.
- The hub re-warms the model every 20 minutes so Ollama's 30-minute `keep_alive` never unloads it; a cold load (7 to 14 s) would always miss the 6 s budget.
- Keep the Mac awake during the test (`caffeinate -dims`, pre-approved).

## Options weighed
| Option | Why not |
| --- | --- |
| Ollama on Render | 126 to 215 s per photo on CPU; a 16 GB plan costs at least $225/month and is still CPU only (lab 08) |
| Tailscale Funnel to the Mac | Public `ts.net` URL straight to Ollama; kept as backup, needs the founder's yes |
| Cloudflare quick tunnel | URL changes every run; Cloudflare terminates TLS and sees the photo |
| Phone talks to the hub directly | Needs the Mac reachable from cellular, same exposure problem |
