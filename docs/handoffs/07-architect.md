# Handoff 07: Architect to Engineering lead

From: Architect. Date: Sat 2026-10-10. Next: Engineering lead (build the P0 release candidate by Sun 10 AM ET).

## What was delivered

| Path | Contents |
| --- | --- |
| [docs/architecture/](../architecture/README.md) | 12 documents: system architecture with C4 context, container, component and deployment diagrams; physical DFDs at levels 0, 1 and 2 (photo, conditions, needs, location, deletion) with trust zones; 9 sequence diagrams; Flare, Plan, answer and hub state machines with transition tables; API overview; ERD and data dictionary; offline, sync and AI placement; security and privacy (STRIDE, 15 threats); privacy-safe observability; 18 performance budgets for the iPhone 13; coding standards; testing strategy |
| [docs/architecture/adr/](../architecture/adr/README.md) | 20 ADRs, including stack, UI, motion, storage, hosting, relay, AI placement, sealing, places, offline, Telegram, push, Forget, fades, previews, ids, license, observability |
| [docs/architecture/contracts/](../architecture/contracts/) | openapi.yaml (OpenAPI 3.1.1, 37 operations on 28 paths, 25 error codes), asyncapi.yaml (AsyncAPI 3.0.0: hub relay, gathering SSE, push payload), telegram.md, plain-text.md |
| Repo scaffold | npm workspaces: `packages/shared`, `apps/server`, `apps/hub`, `apps/web`. TypeScript 6.0.3 run directly by Node 24.21.0. Biome, Vitest, PGlite |
| `apps/server` | Hono server: health, photo drafts, static web build with hash-based CSP, hub relay WebSocket, Postgres schema (17 tables plus schema_migrations) with migrations |
| `apps/hub` | Mac hub: dials out to `/hub`, drafts six words with Ollama in memory, re-warms the model every 20 min |
| `apps/web` | SvelteKit 3 app with `/hello/` (the end-to-end page) and icons |
| `packages/shared` | Photo prompt and `enforce()`, short codes, plain-text forms (Flare, Plan, Lit, reply), hub protocol, API types |
| `scripts/` | `check-env`, `check-contracts`, `e2e-hello`, `secret-scan` (also the pre-push hook), `budget`, `check-diagrams` |
| `.github/workflows/ci.yml` | Secret scan, lint, types, tests, contracts, build, JS budget, diagrams; actions pinned by SHA |
| LICENSE, README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY | AGPL-3.0-or-later (SPDX text), run-it-yourself steps, rules for contributors, private reporting |
| Private repo | https://github.com/Hotragn/flare (pre-approved), pushed |
| docs/BUGLOG.md | BUG-020 to BUG-029 |

## Proof

| Check | Result |
| --- | --- |
| `npm run ci` (local, Node 26.8.1) | secret scan 0 findings; Biome clean; tsc and svelte-check 0 errors; 44 tests pass; contracts ok; build ok; 57.1 KB gzipped JS of 150; 36 diagrams render |
| Tests on Node 24.21.0 | 44/44 (`npx -y node@24.21.0 node_modules/vitest/vitest.mjs run`) |
| GitHub Actions | Green. First run 42 s (https://github.com/Hotragn/flare/actions/runs/38088313532); latest, with the diagram check, 63 s (https://github.com/Hotragn/flare/actions/runs/38089740828) |
| Hello world end to end | `npm run e2e:hello`: Chrome at 390 x 844 picks a photo, the server relays it to the hub, Ollama answers, the page shows "Meet by the water's edge", tier hub, 3.6 s on the hub, 3.8 s in the browser, no console errors or CSP violations ([evidence](../architecture/evidence/e2e-hello.txt)). Passed 10 runs in a row |
| `npm run check-env` | Every setting reported as set, missing or invalid; no value printed (4 tests) |
| `npm audit` | 0 vulnerabilities |
| Traceability | `trace.py` passes after the BR amendments |
| Copy | copy-lint 575 strings, 0 problems; prototype svelte-check 0 errors |

## The 7 open questions from handoff 06, decided

| # | Question | Decision | ADR |
| --- | --- | --- | --- |
| 1 | OQ-1: coordinates on the server? | No. Variant B. The phone seals places; the server sees labels `spot`, `c1` to `c12`, `step:1` to `step:4`. Not OSM ids either: they resolve to coordinates (BUG-023). Copy variant switched to B | 0009 |
| 2 | OQ-2: fades and broken conditions, `min_step` | Keep everyone in; add `min_step(n)`; a private "Plan changed to {step}. Still coming?" via `still_coming` on `/me` and push | 0016 |
| 3 | Conditions by Telegram DM | The bot never reads free text. "Add a condition" opens the link page through a personal bind link; other DMs get the link back and are dropped (founder's lean) | 0013 |
| 4 | Readable text for bot posts and pushes | Readable only for groups that chose Telegram: the host's phone sends six words, place and host name, kept until Gone, disclosed. Pushes stay sealed (`notice_ct`, opened by the service worker) | 0013, 0014 |
| 5 | Photo to the laptop | Through the server's relay, in memory only, zero-filled, no `fs` in the hub, proven by test. Copy now says "It isn't stored." | 0011 |
| 6 | Link preview variant | `safe`: brand card and count. No photo or blur: preview caches outlive our deletion. BR-CH-4 amended | 0017 |
| 7 | Forget this group vs BR-D-5 | SRS-ID-6: your own data and your own Sparks (by delete tokens) go; the last member takes the group. BR-D-5 amended | 0015 |

Also decided: Postgres over MongoDB Atlas, weighed on deletion, license and the partner prize (ADR-0004; no Atlas category claimed). Engineering items 8 to 10 of handoff 06: "..." accepted (ADR-0012); 5-character codes (ADR-0018); bot posts are edited to the final line, then deleted inside the 5-minute window (telegram.md section 6). Founder decisions on the shader, sound with a remembered mute, and DEV comments for accessibility feedback are recorded (ADR-0003).

## New things engineering must know

1. **Spark tickets.** Sparks are written after Done, but the arrival that allows one is deleted within 5 minutes. `POST /arrivals` returns a one-time `spark_ticket`; `POST /groups/{g}/sparks` needs it. Table `spark_tickets` belongs to the group and holds no member id.
2. **Plan weather.** FR-AI-9 needs weather. The host's phone asks api.weather.gov directly with coordinates rounded to 0.1° (about 11 km); only `{rain_likely, temp_f}` goes to the hub. CSP allows exactly that host. Disclosed (`site.privacy.l.weather`).
3. **Hub budget is 6 s** (BR-AI-1), 8 s for ladders. The hub keeps the model warm.
4. **Template ladder:** total × 1, 0.5, 0.25, 0.125 rounded to 5; at least 40 minutes.
5. **CSP is hash-based.** Don't add inline scripts; if SvelteKit adds one, the server hashes it automatically.
6. **Errors** use `apiError(c, status, code, message)` with the contract's codes.
7. **IDs are made on the phone** (UUID v4) so it can seal with the id as AAD before the first request.
8. The engine is **pure**: `transition(state, event, now)`. The transition tables in 04-state-machines.md are the test cases.

## What to build, in order (P0 for the 10 AM release candidate)

| # | Work | Contract and rules | Tests to write (12-testing-strategy.md) |
| --- | --- | --- | --- |
| 1 | Member auth, idempotency, rate limits, zod per contract schema | openapi.yaml conventions | T-SEC-1 to 3 |
| 2 | Groups and members | createGroup, joinGroup, getGroup | |
| 3 | Engine: solver and Flare machine, scheduler with boot rebuild | BR-S, BR-F, F1 to F14 | T-SOL-1 to 3, T-ST-1 to 3 |
| 4 | Gatherings: create, photo, view, answers, checks, text yes, done, cancel, arrivals | S1 to S3, S6, S8 | |
| 5 | SSE fan-out and 30 s poll | asyncapi gatheringEvents | B11 |
| 6 | Sweeper, `npm run sweep`, audit endpoint | ADR-0004 | T-DEL-1 to 3 |
| 7 | Web app: crypto, IndexedDB store, outbox, live, map pack, rules parser (from lab 07), needs checks, screens from the prototype | 07-offline-sync-and-ai.md | T-COND-1 to 3, T-OFF-1 to 2, T-PRIV-1 to 3 |
| 8 | Ember pick and Plan machine with fades | F4 to F6, P1 to P11, ADR-0016 | T-PLAN-1 to 3 |
| 9 | Web Push sender and service worker notice | ADR-0014 | |
| 10 | Telegram bot | telegram.md | T-TG-1, T-SEC-5 |
| 11 | Compass, saved Lit data, live location | SRS-CMP, SRS-OFF | |
| 12 | `/check` capability page (import lab spike 04) and `/g/{id}` preview route | SRS-CAP-1, ADR-0017 | |
| 13 | KPI export and log audit scripts | 09-observability.md | T-PRIV-4 |

## Change requests

- **CR-A1 (analyst):** add `min_step(n)` to BR-C-1 and SRS-COND-1, and 4 phrases to conditions-60.json ("only the long one", "the full walk or nothing", "at least the park loop", "step 2 or bigger"). The contract already has it (ADR-0016).
- Applied as small fixes (BUG-026): BR-CH-2, BR-CH-4, BR-D-5, the dictionary id type. BUG-021: the prototype's Plan sample.

## Waiting for the founder's yes

1. Deploy to Render: web service `flare-outside` (Starter, $7/month on test day), Render Postgres (free expires in 30 days, or Basic), cron job `npm run sweep` every 5 minutes. Plan in 01-system-architecture.md section 6.
2. `setWebhook` for @FairlaneFlareBot, after the deploy. Someone sends `/start@FairlaneFlareBot` in "Flare test" so we learn the chat id (lab 03).
3. Making the repo public as `Hotragn/flare-outside` (the private one is `Hotragn/flare`).

## Things to know

- `.env` now also has `HUB_SECRET` and a VAPID key pair (made locally, never printed). There is no `DATABASE_URL` yet: tests use PGlite, and the server runs without storage until one is set.
- `npm run e2e:hello` needs Ollama running with `gemma4:e4b-it-q4_K_M` and Google Chrome. It is not in CI (no GPU there).
- Mermaid pulls KaTeX; `package.json` overrides it to 0.19.0 for a low-severity advisory. Install scripts: `@scarf/scarf` and `fsevents` are denied.
- BUG-029 is open: one unexplained CSP report in 11 e2e runs; the e2e now prints full details if it comes back.
- The iPhone 13 shader frame rate and Web Push on the four phones are unmeasured until Sunday morning. The quickest path is lab spike 04's page served over HTTPS, then `/check` once item 12 lands.
