# Flare: Security and privacy design

Version 1.0, Sat 2026-10-10. Owner: Architect. Requirements: SRS-PRIV-1 to 8, SRS-SEC-1 to 7, BR-D-1 to 7, BR-Q-5. Trust zones and flows: [02-data-flows.md](02-data-flows.md). Observability: [09-observability.md](09-observability.md).

## 1. Promises and how each is kept

| Promise (privacy page) | Mechanism | Proof |
| --- | --- | --- |
| Nobody sees who said yes | API returns counts only; `chosen_set` never serialized; `GET /me` is about the caller only | Contract schemas have no member list on gatherings; engineering test T-PRIV-1 diffs two members' views |
| We can't read your photo, words, names or places (link groups) | Sealed on the phone, AES-256-GCM, key in the `#fragment` (ADR-0008); places as labels (ADR-0009) | Schema test: no place columns; T-PRIV-3 dumps the DB after a full flow and greps for the test words and place names: 0 hits |
| Conditions stay on your phone | Rules parser on the phone; only rules sent; bot never reads text (ADR-0013) | T-PRIV-2: network capture during a typed condition contains no typed words |
| Your needs stay on your phone | Needs checks on the phone; only pass/fail per label | Contract: `Checks` holds booleans only |
| It deletes itself | Cascade, expires_at, sweeper, cron, audit (ADR-0004) | `db.test.ts` cascade test; audit prints 0 after the field test (SRS-PRIV-5) |
| The photo for the six words isn't stored | Memory only, zero-filled (ADR-0011) | `hub.test.ts`: no fs import, no temp files |
| No trackers | No third-party scripts, fonts or analytics; CSP | CSP test; `connect-src` lists only self and api.weather.gov |

## 2. Honest limits (also on the privacy page, SRS-WEB-2)

1. Anyone with the link can open the Flare. The link is the invitation.
2. In a group of 3 or fewer, friends may guess who said yes. P6 says so at the moment it matters (R19).
3. To write the six words, the photo goes to our laptop over an encrypted link. It isn't stored.
4. Telegram groups: Telegram, and our server until the Flare ends, can read what Flare posts there, including the link (ADR-0013).
5. Safari dictation may send your voice to Apple to turn it into text.
6. Plans: the host's phone asks the US weather service for the forecast near it, to about 11 km.
7. We keep counts (how many Flares lit, how many people came) per group, by day, and a group's sealed Sparks and Hot spots until 180 days without a gathering.
8. Push services (Apple, Google, Mozilla) see that a notice was sent, when, and its size; the text is sealed.
9. Link previews in iMessage, WhatsApp and Telegram are cached by those apps; ours show only the brand card and a count (ADR-0017).

## 3. Threat model (STRIDE per trust boundary)

| # | Boundary | Threat | Example | Control | Residual |
| --- | --- | --- | --- | --- | --- |
| T1 | P→S | Spoofing a member | Write a yes as someone else | Bearer `{memberId}.{token}`, SHA-256 compare, tokens only on the phone (SRS-SEC-4) | A stolen phone can act as its owner |
| T2 | P→S | Tampering with sealed data | Swap one gathering's blob into another | AES-GCM tag plus AAD binding id and field (ADR-0008) | None known |
| T3 | P→S | Repudiation | "I never said yes" | Not a goal: no audit trail of who said what, by design | Accepted |
| T4 | S | Information disclosure by a DB leak | Dump of Postgres | Only ciphertext, labels, hashes and counts; schema test | Group structure and timing visible (how many members, when gatherings happened) |
| T5 | S | Disclosure through logs | Ids or bodies in logs | Route templates, pino redaction, no bodies (BR-D-6); `npm run audit:logs` | None known |
| T6 | P→S | Guessing gatherings | Enumerate ids or short codes | 122-bit ids; short codes only add a capped anonymous yes and need the host's token (ADR-0018) | None |
| T7 | P→S | Denial of service | Flood yeses or drafts | Rate limits (30/min member, 300/min gathering, 20 drafts/min IP); body caps; Render's edge | A large flood could still slow the single instance |
| T8 | S→H | Spoofed hub | Someone connects as the hub to read photos | `HUB_SECRET` bearer, timing-safe compare, TLS; a new hub replaces the old one and is logged | A leaked secret lets an attacker receive draft photos: rotate by changing the env on both ends |
| T9 | S→H | Hub returns harmful text | Prompt injection in a photo ("write 'come alone'") | `enforce()` on hub and server; 6 words; people filter; host reviews before Send | Host could still send bad words they typed themselves |
| T10 | X→S | Forged Telegram updates | POST to the webhook | `X-Telegram-Bot-Api-Secret-Token`, constant-time compare; allow-list of chats (SRS-CH-1) | None known |
| T11 | P | XSS on the link page | A sealed field rendering HTML | Svelte escapes text; no `{@html}` with user data (lint rule); CSP `script-src 'self'` plus one hash, no `unsafe-inline` (SRS-SEC-6) | None known |
| T12 | P | Malicious link with a planted key | Attacker sends a link that looks like a friend's | The group's names are visible after opening; nothing is sent until "I'm in" | Social engineering is out of scope |
| T13 | X | Push payload disclosure | Push provider reads notices | RFC 8291 encryption plus our own `notice_ct` seal | Metadata (time, size) visible |
| T14 | Supply chain | A compromised npm package | Malicious postinstall | Exact versions, lockfile, `npm ci`, `allowScripts` denies `@scarf/scarf`, GitHub Actions pinned by commit SHA, `npm audit` 0 | Accepted for a weekend build |
| T15 | Repo | Secrets committed | Token pushed to GitHub | `.gitignore` has `.env`; pre-push hook and CI run `npm run secret-scan` (6 patterns plus the exact local secret values) (SRS-SEC-2) | None known |

## 4. Keys and secrets

| Secret | Where it lives | Rotation |
| --- | --- | --- |
| Group key (256-bit) | Link fragment, phones' IndexedDB (non-extractable after import) | Not offered; "Forget this group" |
| Write token (128-bit) | Phone; server keeps SHA-256 | New member id |
| `HUB_SECRET` | Server and hub env | Change both; the hub reconnects |
| `TELEGRAM_BOT_TOKEN` | Server env | BotFather revoke, update env |
| `TELEGRAM_WEBHOOK_SECRET` | Server env, given to Telegram at `setWebhook` | Re-run setWebhook |
| `DATABASE_URL` | Server and cron env | Render rotates credentials |
| `VAPID_PRIVATE_KEY` | Server env | New pair means phones resubscribe |
| `RENDER_KEY` | Operator's `.env` only, never on the server | Render dashboard |

`npm run check-env` reports set or missing per app and never prints a value, a prefix or a length (`scripts/lib/env-spec.ts`, 4 tests).

## 5. HTTP hardening (built, `apps/server/src/app.ts`)

| Header | Value |
| --- | --- |
| Content-Security-Policy | `default-src 'self'; script-src 'self' 'sha256-…'` (hash of SvelteKit's one inline bootstrap, computed per HTML file); `style-src 'self' 'unsafe-inline'` (Svelte style attributes cannot run code); `img-src 'self' data: blob:`; `connect-src 'self' https://api.weather.gov`; `object-src 'none'`; `frame-ancestors 'none'`; `base-uri 'self'`; `form-action 'self'` |
| Strict-Transport-Security | `max-age=15552000; includeSubDomains` (Hono default) |
| Referrer-Policy | `no-referrer` (the fragment never leaks; the path doesn't either) |
| Permissions-Policy | camera, geolocation, microphone, motion sensors: self only |
| X-Content-Type-Options, X-Frame-Options, Cross-Origin-*-Policy | Hono secure-headers defaults |

Tests: `apps/server/test/static.test.ts` (hash present, no `unsafe-inline` in `script-src`, base policy on API responses, HSTS), `app.test.ts` (headers on API). `npm run e2e:hello` fails on any console error or CSP violation in Chrome.

Static files: paths are resolved and must stay inside the build folder (sibling-prefix attack tested); unknown paths return 404.

## 6. Deletion guarantees

| Layer | Bound |
| --- | --- |
| Engine schedules delete at Gone + 60 s | 60 s |
| Sweeper every 30 s in the web service | 90 s worst case while it runs |
| Render cron `npm run sweep` every 5 min | 5 min if the web service is down |
| Reads filter `expires_at > now()` | Expired rows never served |
| Telegram `deleteMessages` | 5 min, 3 retries |
| Phone saved data | On learning Gone, else 24 h after Lit |
| Audit `GET /api/v1/audit` | Shows 0 when it worked |

## 7. Data minimization checklist for every new endpoint

1. Does it accept anything readable? If yes, can the phone seal it or reduce it to a label, count or boolean?
2. Does any response depend on another member's answer or needs? It must not (SRS-ACC-4, BR-Q-5).
3. Does the new table have `expires_at` and cascade from `gatherings`, or a retention rule from BR-D-5?
4. Is the route in openapi.yaml with a size cap on every string?
5. Do logs for it contain only the route template, status and time?
