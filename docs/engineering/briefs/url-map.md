# URL map and app layout (binding for FE, PWA, WEB, INT, ODAI)

| Path | What | Owner |
| --- | --- | --- |
| `/` `/how/` `/privacy/` `/accessibility/` `/run/` | Website (prerendered) | WEB |
| `/app/` and below | Host app: create Flare or Plan, groups, settings, Hot spots, Forget | FE |
| `/g/{gatheringId}/` | Link page (invitee), SPA route; key in `#k=` | FE |
| `/ai/` | "AI on this phone" status screen | ODAI |
| `/check/` | Device check (static files in apps/web/static/check/, kit `npm run device-check`) | ODAI (capability), MAP (compass) |
| `/hello/` | End-to-end hello world (keep working) | lead |
| `/maps/fairlane.json` | Map pack (static) | MAP |
| `/api/v1/*`, `/hub`, `/api/v1/telegram/webhook` | Server | BE, INT |
| `/g/{id}` HTML with safe Open Graph tags | Server route that serves the SPA shell with OG tags injected | INT (preview module), BE mounts |

SvelteKit: adapter-static with `fallback: "200.html"` for the SPA routes (`/app/*`, `/g/*`); website and `/check/` prerendered. The server serves `200.html` for `/app/*` and `/g/*` (BE) and INT's preview module injects OG tags into it for `/g/{id}`.

Server composition: `createApp(deps)` in apps/server/src/app.ts is BE's. INT exports `mountTelegram(app, deps)`, `mountPreview(app, deps)` and a push sender `createPush(deps)`; ODAI owns apps/hub/ and the relay's hub-side protocol handling; BE calls INT's mount functions behind feature checks (env present). Until INT's branch lands, BE's own tests don't need them; the lead wires them at integration.
