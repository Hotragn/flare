# PWA test report: airplane mode and flaky networks

Date: Sat 2026-10-10, 21:10 ET. Branch wp/pwa. Chrome 154.0.8037.99 (installed, driven by playwright-core 1.64.0), 390 x 844. Raw output: [evidence/e2e-offline.txt](evidence/e2e-offline.txt).

## How it runs

`npm run build && node apps/web/test/pwa/e2e/offline.ts`. One local server on port 8871 serves the real web build (with its real service worker), a test harness page that loads the real phone modules (built with Vite), and a fake API with idempotency, SSE and fault injection (`apps/web/test/pwa/fakes/api.ts`). Airplane mode is `context.setOffline(true)`; throttling is the Chrome DevTools Protocol `Network.emulateNetworkConditions`; pushes are delivered with `ServiceWorker.deliverPushMessage`.

The map pack is MAP's file and is not on this branch; the server answers `/maps/fairlane.json` with a stand-in so the precache path is tested. The Lit screen and compass UI are FE's; this run proves their offline data layer (T-OFF-1 data part).

## Results: 19/19 pass, 3 runs in a row

| # | Check | Requirement | Result |
| --- | --- | --- | --- |
| 1 | Service worker installs and controls after one reload | SRS-OFF-4 | Pass, 99 to 888 ms |
| 2 | One versioned cache | ADR-0010 | Pass |
| 3 | Precache holds `/`, `/hello/`, the map pack | SRS-OFF-4 | Pass, 28 entries |
| 4 | Precache skips splash images and `/check/` | budget | Pass |
| 5 | App shell loads in airplane mode | SRS-OFF-4 | Pass, 25 ms |
| 6 | A prerendered page loads offline | SRS-OFF-4 | Pass |
| 7 | An SPA link route (`/g/{id}/`) gets the cached shell offline | SRS-OFF-4 | Pass, status 200 |
| 8 | Map pack answers offline | ADR-0010 | Pass |
| 9 | Saved Lit data reads back in airplane mode | SRS-OFF-1, T-OFF-1 | Pass |
| 10 | 5 offline taps queue (`send` resolves null) | SRS-OFF-3 | Pass, 5 queued |
| 11 | The `online` event sends all 5 in order, once | SRS-OFF-3 | Pass, 5 effects, 0 left |
| 12 | 20 taps with lost responses and 503s: each applied exactly once, in order | T-OFF-2, SRS-REL-2 | Pass, 20 effects, 20 unique keys, 13 replays served |
| 13 | Throttled (400 ms latency, 400 kbit/s down): a change reaches the page by SSE | SRS-SOL-3 (5 s) | Pass, 417 ms |
| 14 | Throttled: an outbox write is confirmed | SRS-RES-3 | Pass, 500 ms round trip |
| 15 | Push opens `notice_ct` with the key from IndexedDB | SRS-IF-3, ADR-0014 | Pass: "It's lit. Fuego is at Ford Woods Park pond." |
| 16 | Push for a gathering with no key on the phone | ADR-0014 | Pass: "It's lit. Open Flare to see where." |
| 17 | A new version waits (no skipWaiting on install) | update prompt | Pass |
| 18 | The Reload tap activates it | update prompt | Pass, `controllerchange` |
| 19 | Still one cache after the update | ADR-0010 | Pass |

Check 12 fault pattern, repeating: lost response, ok, 503, lost response, ok, ok, lost response, 503, ok, lost response. A lost response means the server applied the write and then cut the socket, so the phone retried the same `Idempotency-Key` and got the stored first response.

## Unit tests: 54 pass

`npx vitest run --config apps/web/test/pwa/vitest.config.ts` (8 files, about 1 s): crypto 8, store 7, outbox 9, live 9, notice 7, cache plan 6, permissions 8. Includes a seeded flaky-network outbox run (20 taps, 30% lost responses, 15% 503s, 20% offline sends: 20 effects, 20 keys), SSE reconnect with `Last-Event-ID`, the version guard, the server-time offset (120 s skew read to within 500 ms) and the offline banner rule (stream down 10 s and the last poll failed).

## Not covered here (needs the iPhones on Sunday)

| Check | Where |
| --- | --- |
| Real iOS Home Screen install, splash screen, standalone mode | Device checklist, push row |
| Real Web Push from the server (VAPID) on iOS 16.4+ | After INT1 lands and the founder approves the deploy |
| Motion permission prompt on a real iPhone | Device checklist, compass row (flow proven in spike E3 and permissions.test.ts) |
| Safari storage eviction after 7 days | Not testable in a day; mitigated (README, quirks) |
