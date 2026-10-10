# Flare: Work breakdown structure

Version 1.0, Sat 2026-10-10, 19:00 ET. Owner: Engineering lead. Inputs: handoffs 01 to 07, [backlog](../product/05-backlog.md), [SRS](../requirements/01-srs.md), [architecture](../architecture/README.md). Interfaces: [02-interface-control.md](02-interface-control.md). Order and process: [04-dependencies-and-process.md](04-dependencies-and-process.md).

**Clock.** Release candidate (RC) Sun 2026-10-11 10:00 ET. Field test 11:00 to 15:00 ET. DEV deadline Mon 06:59 UTC (Sun 23:59 PDT). That leaves 15 hours to RC with nine specialists in parallel: 88 P0 hours in 50 packages, at most 14 hours for any one specialist (section 12).

**Rules for every work package (WP).** Build against the frozen interfaces only, never against another WP's internals. Use your own fakes for anything you consume (the types in `packages/shared/src/icd/` make a fake that compiles a correct fake). Each WP ships with its tests, its RTM rows filled and a short note in `docs/engineering/notes/{WP}.md`. The general definition of done is in 04-dependencies-and-process.md section 4; the "Done when" column below adds each WP's own bar.

Hours are focused build hours for one specialist. P0 = in the RC; P1 = before the DEV deadline.

## 1. Core engine (CE): `packages/engine`

Pure TypeScript, no I/O. Implements ICD-1 (`Engine` in `packages/shared/src/icd/engine.ts`).

| WP | Deliverable | Stories | SRS | Pri | h | Done when |
| --- | --- | --- | --- | --- | --- | --- |
| CE1 | `solve()`: exhaustive best set (≤ 12), fixed-point `with`, BR-S-1 ordering, BR-S-6 ties, Ember-only rules, Plan step search, `need` | E1-S4, E15-S2 AC2, E15-S3 | SRS-SOL-1, -2, -4, SRS-COND-9, SRS-PLAN-5, -11 | P0 | 3 | E1-S4 AC2 and E15-S3 AC2 cases pass; fast-check: same input same output, adding a no-rule yes never shrinks the set; 12 members × 4 rules × 4 steps ≤ 5 ms (B14) |
| CE2 | Flare `transition()`: rows F1 to F14, the t0+30:00.000 race rule, effects | E1-S2, E1-S3, E2-S5 | SRS-ST-1 to -4, SRS-TIME-1, SRS-RES-6 | P0 | 3 | One test per row; race test at .000 and .001 |
| CE3 | Plan `transition()`: rows P1 to P11, BR-P-1 validation, fades, `still_coming` (ADR-0016) | E15-S1 AC3, E15-S3, E15-S4 | SRS-PLAN-1, -5, -7, -9 | P0 | 3 | One test per row; fade window edges |
| CE4 | Ember pick (first label passed by all, 60 s default pass), checks folding, Ember-only counting | E6-S3 | SRS-EMB-1 to -3, SRS-ACC-3 | P0 | 1.5 | BR-E-1 to BR-E-4 cases incl. "no bench passes → spot" |
| CE5 | Arrivals and headcount: BR-H-1 to BR-H-5, spark ticket effect | E2-S5, E10-S1 | SRS-LIT-3, -4, SRS-SPK-1 | P0 | 1 | Cap, dedupe, outbox window cases |
| CE6 | `view()`: need and next change time; engine README with the effect contract | E1-S4 AC3 | SRS-SOL-3 | P0 | 0.5 | Snapshot tests per state |

## 2. Backend (BE): `apps/server`

Implements ICD-2 (openapi.yaml) and ICD-4 (SSE), calls ICD-1, owns the schema.

| WP | Deliverable | Stories | SRS | Pri | h | Done when |
| --- | --- | --- | --- | --- | --- | --- |
| BE1 | Middleware: member auth (SHA-256 token, timing-safe), idempotency table, rate limits, zod per schema, `apiError` codes, 64 KB JSON cap | E1-S3 AC1 | SRS-IF-1, SRS-SEC-4, -5, SRS-REL-2 | P0 | 2 | T-SEC-1 to -3; replay returns `Idempotent-Replay: true` |
| BE2 | Groups and members: create, join (12 max), get, rename, forget (ADR-0015) | E1-S1, E10-S3 | SRS-ID-1 to -7 | P0 | 2 | Forget tests: own Sparks by token, last member removes group |
| BE3 | Gatherings and answers: create, photo put/get, view, me (get/put/delete), checks, text-yes, fade, arrivals, done, cancel, live location. One transaction with `SELECT … FOR UPDATE`, engine call, effects after commit | E1-S1, E1-S3, E2-S4, E2-S5, E3-S2, E15-S1 to -4 | SRS-CRE-6, -7, SRS-RES-3, -4, -6, SRS-CH-6, SRS-CMP-6, SRS-PRIV-8 | P0 | 4 | Every operation's success and error codes tested; T-PRIV-1 |
| BE4 | Scheduler: `jobs` table, 1 s tick, rebuild at boot, effects runner | E1-S2 AC4 | SRS-ST-2, SRS-REL-1 | P0 | 1.5 | Restart test: jobs fire within 30 s of schedule |
| BE5 | SSE fan-out per gathering, keepalive 15 s, `Last-Event-ID` | E1-S4 AC3 | SRS-SOL-3 | P0 | 1.5 | 12 clients see a change ≤ 5 s (B11) |
| BE6 | Sweeper every 30 s, `npm run sweep` for the cron, audit endpoint with the 60 s cache; use spike E2's SQL and migration 0002 | E1-S5, E1-S6 | SRS-PRIV-2, -3, -5 | P0 | 1.5 | T-DEL-1 to -3; audit `pass: true` after a full flow |
| BE7 | Sparks (ticket, delete token), Hot spots (If-Match), group retention sweeps (30 and 180 days) | E10-S1 to -3 | SRS-SPK-1, -2, SRS-HOT-1, -2, SRS-PRIV-3 | P0 | 1.5 | Ticket single use; 412 on stale version |
| BE8 | `/g/{id}` safe preview HTML (ADR-0017), `/config`, ladder draft route on the relay | E2-S4 AC3, E15-S1 | SRS-CH-7, SRS-PLAN-2 | P0 | 1 | Preview HTML has no photo, words or place |
| BE9 | `npm run kpi` (07-kpis.md table), `npm run audit:logs` | E13-S2 | SRS-FLD-1, SRS-PRIV-4, -6 | P0 | 1 | T-PRIV-4 log capture |
| BE10 | One-step deploy script `npm run deploy:render` (Render API with RENDER_KEY: web, Postgres, cron, env from .env), dry run only until the founder says yes | ops | SRS-MNT-3 | P0 | 1 | `--dry-run` prints the plan with values masked |

## 3. Integrations (INT): `apps/server/src/telegram`, `apps/server/src/live/push.ts`

| WP | Deliverable | Stories | SRS | Pri | h | Done when |
| --- | --- | --- | --- | --- | --- | --- |
| INT1 | Web Push sender: web-push 3.6.7, VAPID, payload per asyncapi `push`, TTL 600, delete subscription on 404/410 | E3-S3 | SRS-IF-3, SRS-LIT-1 | P0 | 1.5 | Fake push endpoint test: payload decrypts (RFC 8291) to the contract shape |
| INT2 | Telegram webhook: secret header, allow-list and `leaveChat`, `/start {token}` link, `y:`/`c:` callbacks, bind tokens, free-text drop, posts, coalesced edits (3 s), Lit and Ember messages, cleanup with `deleteMessages` | E4-S1 to -3 | SRS-IF-2, SRS-CH-1 to -4 | P0 | 4 | T-TG-1 against a fake Bot API server; no message text ever logged |
| INT3 | `npm run telegram:webhook` (setWebhook, waits for the founder's yes) and `telegram:status` | ops | SRS-CH-1 | P0 | 0.5 | Dry run prints the call, token masked |

## 4. ML (hub): `apps/hub`, `packages/shared/src/photo.ts`

| WP | Deliverable | Stories | SRS | Pri | h | Done when |
| --- | --- | --- | --- | --- | --- | --- |
| ML1 | `ladder-draft` job (asyncapi) on hub and relay, 8 s budget, validation (4 steps, decreasing, ≤ 4-word labels) | E15-S1 | SRS-PLAN-2, SRS-AI-7 | P0 | 2 | 10 asks: valid ladder or template |
| ML2 | Eval harness: 20 photos through the real hub, report validity, person words (must be 0), latency; re-run before RC | E8-S2 AC2 | SRS-AI-2, -3 | P0 | 1.5 | Report in notes/ML2.md; 0 person descriptions |
| ML3 | Tier counters `tier_ran.{job}.{tier}` and "Made on our laptop" flag in responses | E8-S4 | SRS-AI-4 | P0 | 0.5 | Counter test |
| ML4 | `npm run hub:field`: caffeinate, warm, health line every 30 s, restarts the hub if it exits | ops | SRS-AI-1 | P0 | 0.5 | Runs 30 min without a drop |
| ML5 | Fix the map tag drafts with the allow-list | E17-S1 | SRS-MAP-1 | P1 | 2 | Allow-list test |

## 5. On-device AI (ODAI): `apps/web/src/lib/conditions`, `apps/web/src/lib/capabilities`

| WP | Deliverable | Stories | SRS | Pri | h | Done when |
| --- | --- | --- | --- | --- | --- | --- |
| OD1 | Rules parser (ICD-7): import lab 07's parser, add its two general rules and `min_step` (CR-A1), resolve names on the phone | E5-S1, E15-S2 AC1 | SRS-COND-1, -2, -6 to -8, SRS-PLAN-10 | P0 | 3 | core_40 ≥ 36 (lab: 40), hard_20 reported, 4 min_step phrases pass |
| OD2 | Read-back ≤ 12 words with the copy deck; save only on Yes | E5-S3 | SRS-COND-5 | P0 | 1 | Every readback in fixtures ≤ 12 words |
| OD3 | Capability probe (ICD-8), shader gate, `/check` route serving the imported capability page | E8-S1 | SRS-CAP-1, SRS-AI-5, SRS-COMP-2 | P0 | 1.5 | No user-agent parsing (lint grep) |
| OD4 | Typed fallback: six-word field with map-pack chips, "Made from a template" | E8-S2, E8-S4 | SRS-AI-1, -4 | P0 | 1 | Offline draft works in airplane mode |
| OD5 | Rest-loop request parser | E16-S1 | SRS-REST-1 | P1 | 2 | Read-back cases |

## 6. Maps (MAP): `apps/web/src/lib/map`, `scripts/build-map-pack.ts`

| WP | Deliverable | Stories | SRS | Pri | h | Done when |
| --- | --- | --- | --- | --- | --- | --- |
| MP1 | Pack v2 builder: the analyst's pinned query plus `leisure=picnic_table` (missing from lab 05's pack), named `natural=water`/`wood`, and named streets as points every 25 m; User-Agent; `osm_base` ≤ 7 days; ODbL attribution; centred on TEST_AREA (lab 05's pack centre is about 700 m east of it) | E9-S3, E2-S2 | SRS-IF-4, SRS-OFF-5 | P0 | 2 | Pack ≤ 10 KB brotli; counts match evidence/README.md for the pinned tags |
| MP2 | Map functions (ICD-6): `nameSpot`, `emberCandidates`, `walkMinutes`, `accessLine`, `placeWords` | E2-S2, E6-S2, E6-S3 | SRS-CRE-3, SRS-ACC-2, SRS-EMB-1 | P0 | 2 | Fixture tests at 5 Fairlane points |
| MP3 | Needs checks BR-A-2 | E6-S3 | SRS-ACC-3, -4, -6, SRS-PLAN-6 | P0 | 1.5 | Each BR-A-2 clause tested |
| MP4 | Nature line: NOAA sunset, named natural feature ≤ 200 m, season; "Ends after sunset" | E3-S4, E15-S1 AC4 | SRS-NAT-1, SRS-PLAN-3 | P0 | 1 | Sunset within 1 min of NOAA for Dearborn on Oct 11 |
| MP5 | Plan weather: api.weather.gov at 0.1°, reduce to `{rain_likely, temp_f}`, fail soft | E15-S1 | SRS-PLAN-2 (FR-AI-9) | P0 | 1 | Works with NWS down |
| MP6 | Rest loop builder and large-print PDF card, spoken turns | E16-S2, -3 | SRS-REST-2 to -6 | P1 | 4 | Loop and card tests |
| MP7 | Fix the map review and `.osm`/Note export, no osm.org requests | E17-S2, -3 | SRS-MAP-2 to -4 | P1 | 2 | Network capture shows no osm.org host |

## 7. Frontend app (FE): `apps/web/src/routes`, components from `design/prototype`

| WP | Deliverable | Stories | SRS | Pri | h | Done when |
| --- | --- | --- | --- | --- | --- | --- |
| FE1 | App shell: move tokens, components, copy deck and motion from the prototype into `apps/web`; routes; error mapping from contract codes to copy | E11-S1 | SRS-COPY-1, -2 | P0 | 2 | copy-lint 0; svelte-check 0 |
| FE2 | Host flow H1 to H6: camera first, 768 px draft upload, words typing in, quorum, host line, Send, share sheet with link and SMS form, host controls (+1, cancel, Done, text yes) | E2-S1 to -5 | SRS-CRE-1, -2, -4, -5, -7 to -9, SRS-IF-6, SRS-CH-5 | P0 | 4 | Host open to Send ≤ 15 s on desktop in 5 tries |
| FE3 | Invitee flow I0 to I12: open, key check, I'm in (optimistic), condition, read-back, Ember-only offer, take back, Can't make it, Lit, I'm here, Spark, end | E3-S1, -2, -4, E6-S3, E10-S1 | SRS-RES-1 to -8, SRS-LIT-2, SRS-ACC-3, -5 | P0 | 4 | Open to I'm in ≤ 10 s in 5 tries; no "No" button anywhere |
| FE4 | Lit screen and compass UI: the patterns proven in spike E3 (permission inside the tap, webkitCompassHeading, speech rules, tone on facing), offline banner | E7-S1, -2, E3-S4 | SRS-CMP-1 to -5, -7, SRS-OFF-2 | P0 | 3 | Compass flow test (scripts/spikes/compass-flow.ts pattern) on the real screen |
| FE5 | Plan flows P1 to P7: ask, times, ladder edit, answer with steps, fade, smaller plan | E15-S1, -2, -4 | SRS-PLAN-1 to -4, -7, -8, -10 | P0 | 3 | Deadline validation errors shown |
| FE6 | Sparks history line, Hot spots list (only when chosen), Forget this group, needs profile, settings | E6-S1, E10-S2, -3 | SRS-ACC-1, SRS-SPK-2, SRS-HOT-1, -3, SRS-ID-6 | P0 | 2 | Hot spots never prompted |
| FE7 | Accessibility pass: axe on every screen and state in CI, focus order, 44 px, Dynamic Type, VoiceOver script for J3 | E6-S4, -5 | SRS-A11Y-1 to -6, SRS-ACC-5 | P0 | 2 | 0 serious or critical |
| FE8 | Motion and sound: WebGL flame behind the gate, CSS fallback, sounds with the remembered mute | E11-S2 | SRS-A11Y-5 | P0 | 1 | Reduce Motion turns all of it off |

## 8. PWA and offline (PWA): `apps/web/src/lib/{crypto,store,outbox,live}`, `src/service-worker.ts`

| WP | Deliverable | Stories | SRS | Pri | h | Done when |
| --- | --- | --- | --- | --- | --- | --- |
| PW1 | Crypto (ICD-5): group key in fragment, seal/open with the AAD table, place hash | E1-S1, E3-S1 AC3 | SRS-ID-1, -2, -4, SRS-CRE-6, SRS-SEC-3 | P0 | 1.5 | Wrong AAD fails; wrong key shows "This link is missing its key." |
| PW2 | IndexedDB store (idb 8.0.4) | E9-S1 | SRS-ID-3, SRS-OFF-1 | P0 | 1 | Forget clears everything for that group |
| PW3 | Outbox (ADR-0010) | E9-S2 | SRS-OFF-3, SRS-REL-2 | P0 | 1.5 | T-OFF-2: replays once |
| PW4 | Live: SSE plus 30 s poll, server-time offset, version guard | E1-S4 AC3 | SRS-SOL-3, SRS-TIME-1 | P0 | 1 | Reconnect with Last-Event-ID |
| PW5 | Service worker: precache shell and map pack, push handler that opens `notice_ct`, fallback text, notification click | E3-S3, E9-S1 | SRS-OFF-4, SRS-IF-3 | P0 | 2 | Offline reload works in Chrome; push test with a fake payload |
| PW6 | Install and push subscribe flow (Home Screen step on iOS), Telegram bind link handling (`?bind=`) | E3-S3, E4-S2 | SRS-IF-3, SRS-COMP-3 | P0 | 1.5 | Subscribe only after a tap |
| PW7 | Saved Lit data and airplane-mode test | E3-S4, E9-S1 | SRS-OFF-1, -2 | P0 | 1 | T-OFF-1 |

## 9. Website (WEB): `apps/web/src/routes/(site)`

| WP | Deliverable | Stories | SRS | Pri | h | Done when |
| --- | --- | --- | --- | --- | --- | --- |
| WB1 | Home, How it works, Privacy, Accessibility, Run it yourself (from prototype `/site` and README) | E12-S1 | SRS-WEB-1, SRS-MNT-3 | P0 | 2 | All five pages, copy from the deck |
| WB2 | Privacy page: variant B, the 9 limits, live `GET /api/v1/audit` table | E12-S1 | SRS-WEB-2 | P0 | 1 | Audit renders; fails soft |
| WB3 | Lighthouse CI on the five pages | E12-S2 | SRS-PERF-4, SRS-COMP-4 | P0 | 1 | ≥ 90 performance, 100 accessibility |

## 10. Engineering lead and QA (not a specialist WP, listed so nothing is orphaned)

| Item | Owner | Stories | SRS |
| --- | --- | --- | --- |
| Integration at 05:00 and 08:00, RC tag at 09:30 | Engineering lead | all | |
| Field test kit, consent checklist | Engineering lead with QA | E13-S1, -3 | SRS-FLD-2, -3 |
| Real Plan Sunday morning | Founder | E15-S5 | SRS-FLD-3 |
| Device check (05-device-checklist.md) | Team, Sunday 08:30 | E8-S1 | SRS-COMP-1 |
| DEV post, video, session embed | Founder and writer | E14-S1 to -3 | SRS-FLD-4, -5, SRS-SEC-7 |

## 11. Requirements this plan does not build, with the reason

| Requirement | Why | Record |
| --- | --- | --- |
| SRS-COND-3, E5-S2 hub-tier condition parser | Conditions never leave the phone (founder brief; lab 07: the hub would add little over 40/40 core) | CR-E1 in handoff 08 |
| SRS-COND-4, SRS-AI-6, SRS-OFF-6, E8-S3 phone-tier models (P1) | No model fits an iPhone tab: Gemma E2B needs a 1.12 GiB buffer against a 1 GiB cap (lab 01); SmolVLM 2/20 right (lab 09); Qwen3-0.6B hung Safari (lab 07) | ADR-0007; CR-E2 in handoff 08 |

## 12. Owners and load

Work is grouped by area above; five P0 packages are owned by a specialist from a neighbouring area so nobody carries more than the 15 hours to RC.

| Moved WP | From | To | Why it fits |
| --- | --- | --- | --- |
| BE7 Sparks and Hot spots | Backend | Core engine | Small, rule-heavy (BR-K), no new infrastructure |
| BE9 KPI and log audit, BE10 deploy script | Backend | Integrations | Operator tooling next to the webhook and push scripts |
| FE5 Plan flows | Frontend | On-device AI | Plan answers are mostly the conditions parser and read-back |
| FE6 Sparks, Hot spots, Forget, needs screens; FE7 accessibility pass | Frontend | Website | Same components and copy; the website owner already runs axe and Lighthouse |

| Specialist | P0 packages | P0 hours |
| --- | --- | --- |
| Core engine | CE1 to CE6, BE7 | 13.5 |
| Backend | BE1 to BE6, BE8 | 13.5 |
| Integrations | INT1 to INT3, BE9, BE10 | 8 |
| ML | ML1 to ML4 | 4.5 |
| On-device AI | OD1 to OD4, FE5 | 9.5 |
| Maps | MP1 to MP5 | 7.5 |
| Frontend app | FE1 to FE4, FE8 | 14 |
| PWA and offline | PW1 to PW7 | 9.5 |
| Website | WB1 to WB3, FE6, FE7 | 8 |
| **Total** | 50 P0 packages | **88** |

Specialists who finish early pick up P1 packages in their own area (ML5, OD5, MP6, MP7), then help with integration. The longest chains are in 04-dependencies-and-process.md.
