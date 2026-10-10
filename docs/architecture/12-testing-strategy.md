# Flare: Testing strategy

Version 1.0, Sat 2026-10-10. Owner: Architect. QA owns the test plan and the RTM Test and Proof columns; this page sets the layers, tools and the tests every requirement group needs.

## 1. Layers

| Layer | Tool | Runs | Scope | Now |
| --- | --- | --- | --- | --- |
| Unit | Vitest 5.0.3 | `npm test`, CI | Pure logic: solver, transitions, rules parser, needs checks, plain text, codes, enforce(), env spec, secret scan | 44 tests in 9 files |
| Database | Vitest + PGlite 0.5.8 (real Postgres in memory) | CI | Migrations, cascade, expiry columns, forbidden columns, unique codes, sweeper, audit SQL | 6 schema tests |
| HTTP | Vitest + `app.request()` / real port | CI | Every endpoint: success, each error code, auth, idempotency replay, rate limits, headers | health, drafts, static, CSP |
| Relay | Vitest + ws | CI | Hub auth, job round trip, timeout, no fs, no temp files | 5 tests |
| Contract | Redocly, AsyncAPI parser, drift check | `npm run contracts`, CI | Specs valid; routes and hub schemas match | 3 checks, 4 tests |
| End to end | playwright-core 1.64.0 with installed Chrome | `npm run e2e:*` on the hub Mac | Real flows in a 390 x 844 viewport, real Ollama for hub paths | `e2e:hello` |
| Accessibility | axe-core 4.14.0 via Playwright | CI on the built app | Every screen and state, 0 serious or critical (SRS-A11Y-2); focus order; 44 px targets | Prototype: 193 targets, 0 violations |
| Performance | `npm run budget`, Lighthouse CI, autocannon | CI (budget), hub Mac (rest) | B1 to B18 in 10-performance-budgets.md | budget 57.1 / 150 KB |
| Real devices | `/check`, `/lab/fps`, `/lab/haptics`, stopwatch | Sunday on 4 iPhones | Capabilities, timings, VoiceOver J3 | Sunday |

## 2. Tests each area must have

| Area | Must-have tests (ids for the RTM) |
| --- | --- |
| Solver (BR-S) | T-SOL-1 all E1-S4 AC2 and E15-S3 AC2 cases; T-SOL-2 property test with fast-check 4.10.2: same input, same output; adding a no-rule yes never shrinks the best set; T-SOL-3 tie-break by lowest ids |
| Flare machine (BR-F) | T-ST-1 one test per row F1 to F14; T-ST-2 the t0+30:00.000 race (answer at .000 wins, .001 goes to Ember); T-ST-3 restart: jobs rebuilt, fire within 30 s |
| Plan machine (BR-P) | T-PLAN-1 one per row P1 to P11; T-PLAN-2 fade window edges; T-PLAN-3 min_step still_coming flag |
| Conditions | T-COND-1 core_40 ≥ 36 (lab: 40/40); T-COND-2 hard_20 reported; T-COND-3 read-back ≤ 12 words |
| Privacy | T-PRIV-1 two members' views are byte-identical except `/me`; T-PRIV-2 network capture during a typed condition contains no typed words; T-PRIV-3 DB dump after a full flow contains no test words or place names; T-PRIV-4 log capture has only allowed fields; T-PRIV-5 hub writes no files (done) |
| Deletion | T-DEL-1 cascade (done); T-DEL-2 sweeper deletes Gone + 60 s and expired rows; T-DEL-3 audit 0 after a full flow; T-DEL-4 Telegram deleteMessages called with every id |
| Offline | T-OFF-1 airplane-mode Lit screen and compass in Playwright (`context.setOffline(true)`); T-OFF-2 outbox replays once (idempotency) |
| Security | T-SEC-1 every write without a token → 401; T-SEC-2 other member's token → 403; T-SEC-3 rate limits; T-SEC-4 CSP has no `unsafe-inline` for scripts (done); T-SEC-5 webhook without secret → 401 |
| Telegram | T-TG-1 against a fake Bot API server: post, edit, private answer, refusal outside the allow-list, cleanup |
| AI | T-AI-1 enforce() on the 20 lab answers; T-AI-2 template on hub absence (done) and timeout (done); T-AI-3 tier counters |
| Plain text | Done: 8 tests (contracts/plain-text.md) |

## 3. Fixtures and fakes

- `docs/requirements/fixtures/conditions-60.json` for the parser; 4 `min_step` phrases to add (CR-A1).
- `scripts/fixtures/pond-illustration.jpg`: our own illustration (rendered from the prototype's SampleScene), so no third-party photo is in the repo.
- Fake Ollama, fake hub server and fake Telegram Bot API as small `node:http` servers inside tests. No network in CI.
- PGlite for the database; no Docker.

## 4. What runs where

| Where | Command | Includes |
| --- | --- | --- |
| Every push (GitHub Actions, Node 24.21.0, about 45 s) | `npm run ci` steps | secret scan, lint, types, unit, database, HTTP, relay, contracts, build, JS budget |
| Hub Mac before a release candidate | `npm run e2e:hello` and the other `e2e:*` | real Ollama, real Chrome |
| Sunday morning | `/check` on each phone, J1 to J5 journeys | device facts and timings |

## 5. Definition of done for any story

1. Contract updated, if it touches the API.
2. Tests for the rules it implements, named with the rule id, pass in CI.
3. axe 0 serious or critical on its screens; copy lint 0 problems.
4. No new log fields outside 09-observability.md.
5. RTM row filled with code path, test name and proof.
