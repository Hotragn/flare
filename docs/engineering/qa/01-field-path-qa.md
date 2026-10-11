# QA: the Sunday field-test path

Sun 2026-10-11, 03:40 ET, on main after integration point 1. Everything below was run on the hub Mac against the real server, real engine, real hub (Ollama `gemma4:e4b-it-q4_K_M`) and real PWA modules unless it says otherwise.

## Functional

| Check | Command | Result |
| --- | --- | --- |
| Host sends a Flare, friend says yes, it lights, compass points | `node apps/web/test/e2e/flow.ts 5 real` | 5/5 runs; host open to Sent median 2.7 s (target 15 s); link open to "You're in." median 284 to 308 ms (target 10 s); lit on both phones 5/5; compass right twice, permission asked once inside the tap; 0 page errors (docs/frontend/evidence/flow-real.txt) |
| Phone page to hub and back | `npm run e2e:hello` | 3.3 s, tier hub, no console errors, no CSP violations |
| Offline: shell, saved Lit, outbox exactly once, push notice, update | `npm run e2e:pwa` | All pass (one stale assertion updated: `/` is now the website, BUG-057) |
| Telegram tap through the real engine, safe preview | `wired.test.ts` | Pass |
| Unit, contract, flow and site suites | `npm test` | 590 + 37 + 26 pass |
| Deletion to audit 0 | backend flow tests | 8 flows end with 0 rows in the 7 per-gathering tables |

## Accessibility

`npm run build && node apps/web/test/site/a11y.ts --out docs/website/evidence/a11y.json`: 64 page views (16 pages, 390 and 1280 px, light and dark). Product pages (website, `/app/`, `/g/`, `/ai/`, `/hello/`): **0 serious or critical findings, 0 touch targets under 44 px**. Fixed tonight on the device-check kit: dark-mode contrast on `/check/`, the focusable results box and the 44 px checkbox on `/check/compass.html`. Left: 16 findings on `/check/capability/`, the imported lab page used by the team for 15 minutes (BUG-056).

## Security

| Check | Result |
| --- | --- |
| `npm audit --omit=dev` | 0 vulnerabilities |
| Secret scan (pre-push and CI) | 0 findings over 943 files, 8 local secret values checked |
| Headers on `/`, `/app/`, `/g/{id}/`, `/api/v1/health` | CSP with one script hash and no `unsafe-inline` for scripts, HSTS 180 days, `no-referrer`, permissions policy (camera, location, motion, mic: self), `nosniff`, `X-Frame-Options`, COOP and CORP same-origin |
| CSP in the browser | flow e2e listens for violations on every page: 0; 6 documents carried the header |
| Path traversal `/../../.env`, `/%2e%2e/%2e%2e/.env` | 404 |
| Link preview for `/g/{id}` | `og:title` "A Flare from a friend", brand card, no photo, words, place or host |
| Account tokens | check-env and `deploy:render` refuse `dop_v1_` and `sntryu_` values in narrow slots |
| Sentry | server only, allow-listed attributes; `tracing.test.ts` proves no text, ids, URLs or photo bytes leave (off until a DSN is set) |

## Risks for Sunday

1. Hub latency under load: median 4.0 s at load 5, 4/5 within 6 s; lab 3.0 s idle. The field Mac must run only the hub (device checklist step 0).
2. `/check/capability/` accessibility findings (internal tool).
3. Web Push, compass sensors, haptics and Home Screen install are only provable on the iPhones (03-spikes.md section 5).

## Update Sun ~07:30 ET: rest loop and Fix the map

| Item | Before | Now | Proof |
| --- | --- | --- | --- |
| Bench to Bench `/app/loop/` | Menu link 404 | Built; words parsed on the phone | `npm run e2e:loop`: Village Green 32 min · 1.6 km · 11 benches in 83 ms, PDF 3,565 bytes; 0 API calls carry the words |
| Ford Woods loop | n/a | No loop (benches clustered in OSM); screen says so and offers 400 m | same run |
| Fix the map `/app/fix-map/` | Menu link 404 | Built; review every tag, export note (clipboard) or `.osm` | same run: export locked until 0 pending, bad value refused, 0 requests to OSM or the API |

Known limit: Fix the map starts from the usual tags for the thing, not from a photo, because the hub has no tag-drafting job (ML5).

## Integration point 3 (Sun 2026-10-11, ~06:55 ET, run early)

| Area | Result |
| --- | --- |
| `npm ci` + `npm run ci` | Green: 596 + 37 + 26 tests, contracts, build. One fix first: `Handle` import for SvelteKit 3 (pre-push now runs svelte-check, gate 26 s) |
| e2e:hello | Pass, tier hub, 3,747 ms, upload 13 KB |
| e2e:pwa | ALL PASS |
| e2e:field | 27/27 (real server, real engine, PGlite) |
| e2e:sparks | All pass |
| e2e:loop | All pass (loop, no-loop, Fix the map, photo draft through the hub) |
| flow.ts 5 real | 5/5 lit, host median 3,211 ms, friend median 291 ms, 0 page errors, CSP on 10 documents |
| smoke (local server + hub) | Run 1: all required pass, photo draft rules at 6,008 ms (cold model, expected); run 2: photo draft hub in 3,546 ms |

## Telegram from the phone (Sun ~07:15 ET, ADR-0023)

| Check | Result |
| --- | --- |
| Server tests (card, opt-in gate, edits, deletion) | 178/178 |
| `npm run e2e:telegram` (real server and hub, fake Bot API, real .env never read) | 14/14: link group makes no Telegram call; disclosure shown; photos off by default; Add the bot gives a t.me startgroup link; /start connects; next Flare posts the PNG card with caption and 3 buttons, no JPEG; photos on gives the host's JPEG |
| Live in "Flare test" with the real bot | sendPhoto card ok (1.7 s), editMessageMedia to Lit ok (2.1 s), deleteMessages ok after 60 s |
| Still to do live after deploy | Connect from the app and tap through (runbook 09:55 steps 4 and 5) |
