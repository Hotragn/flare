# Server design (BE1 to BE6, BE8)

Version 1.0, Sat 2026-10-10. Owner: Backend. Code: `apps/server/`. Contract: `docs/architecture/contracts/openapi.yaml` and `asyncapi.yaml` (channel `gatheringEvents`, `hub`).

## 1. Shape

One Node 24 process (ADR-0004: one instance). It holds:

| Part | File | Job |
| --- | --- | --- |
| App | `src/app.ts` | `createApp(deps, ctx)`: headers, CSP, request log, error mapping, routes, INT mounts, static files |
| Context | `src/core/deps.ts` | `Ctx`: `db`, `engine`, `events`, `clock`, `config`, `effects`, `relay`. INT's mount functions get this |
| Guards | `src/http/middleware.ts`, `src/http/write.ts` | member auth, rate limits, idempotency, strict zod bodies |
| Schemas | `src/http/schemas.ts` | one strict zod schema per contract body |
| Engine runner | `src/core/gatherings.ts` | row mapping, `runEvent` (lock, transition, store, effects after commit), shared view |
| Live updates | `src/core/events.ts`, route `/events` | in-process bus, SSE fan-out, 15 s keepalive |
| Scheduler | `src/core/scheduler.ts` | `jobs` table, 1 s tick, delete job, 60 s sweep |
| Sweep and audit | `src/core/sweep.ts` | spike E2 sweep, store audit (BR-D-7), per-gathering audit |
| Reports | `src/core/report.ts`, `src/cli/*` | `npm run sweep`, `audit`, `kpi`, `audit:logs` |
| Routes | `src/routes/{system,groups,gatherings,places,ai}.ts` | every BE operation in openapi.yaml |
| Hub relay | `src/hub/relay.ts` | photo and ladder jobs over the hub socket (spike E1 heartbeat kept) |

## 2. One write, start to end

1. The handler takes `now` from the clock first. This is the receive time the race rule uses (BR-F-2).
2. Auth: `Authorization: Bearer {memberId}.{writeToken}`. The server hashes the token with SHA-256 and compares in constant time with `members.write_token_hash` (SRS-SEC-4). Wrong or missing: 401.
3. `Idempotency-Key` is required (400 without). Rate limits run next: 30 writes per minute per member, 300 per gathering, 60 per IP for anonymous writes (SRS-SEC-5). Over: 429 with `Retry-After`.
4. Idempotency: key `{memberId or anon}:{key}`. A stored 2xx response is returned as is and nothing runs. Errors are not stored, so a retry after a 409 can succeed later (`ops.test.ts`).
5. Body: strict zod. Unknown keys, bad base64url, bad labels: 400 `bad_request`. The body is never echoed.
6. `runEvent` in one transaction: `SELECT ... FOR UPDATE` on the gathering, read answers, `engine.transition`, save the gathering and the full answers list (rows not in the list are deleted), then the database effects in the same transaction: `schedule` upserts the one job of that kind, `unschedule` deletes it, `counter` adds or keeps the max, `spark_ticket` stores a hash.
7. At Gone, in the same transaction: delete live location, photo, Telegram binds and every job except `delete`; upsert `delete` at now + 60 s.
8. After commit: publish the view on the bus (SSE), then push and Telegram through `ctx.effects`. A failing sender is logged by effect type only and never undoes the change.

Errors from the engine map to the contract (docs/engine/02-api.md section 4). Any event on a Gone row answers 410 `gone` with `ended` in the body, before the engine runs.

## 3. Creation

`POST /groups/{id}/gatherings` calls the engine's `createFlare` or `createPlan` (rows F1, P1) with the group's member count. Errors: `quorum_range` and `plan_times` 422, `group_full` 409, ladder or labels `bad_request` 400. The server adds the short code (5 characters, unique among live gatherings, 20 tries), stores the sealed blobs as bytes, runs the returned effects (first job, `flares_created` or `plans_created`) and sets `groups.last_gathering_at`. The host is always in the set and has no answer row until their checks or arrival make one (docs/engine/01-algorithm.md 6.1). Telegram post text is accepted only for groups with channel `telegram` (ADR-0013).

## 4. Reads

- `GET /gatherings/{id}`: anyone with the id. Counts and ciphertext only, no member ids (BR-Q-5). `ETag: "{version}"`, `cache-control: no-store`, `server_time` from the server clock (BR-TIME-1). `need` and `next_change_at` come from `engine.view`.
- `GET /gatherings/{id}/me`: only about the caller. `in_set` is null before Lit.
- `GET /gatherings/{id}/events`: on connect one `gathering` event unless `Last-Event-ID` is already current; one per version after that; `: keepalive` every 15 s; a final `gone` event, then close. Listeners are removed on abort (`events.listeners(id)` is 0 after, tested).

## 5. Deps for INT

`createApp(deps)` accepts `mounts: ((app, ctx) => void)[]`, run after BE routes and before static files. INT's `mountTelegram` and `mountPreview` take `ctx: Ctx` and use:

| Field | Type | Use |
| --- | --- | --- |
| `ctx.db` | `Db` (`query`, `tx`) | the tables in 0001 to 0003 |
| `ctx.engine` | `Engine` (ICD-1) | Telegram "I'm in" taps: call `runEvent(ctx, gatheringId, event, now)` from `src/core/gatherings.ts` |
| `ctx.events` | `EventBus` | already fed by `runEvent` |
| `ctx.config` | `{ version, publicBaseUrl, vapidPublicKey, telegramBotUsername }` | |
| `ctx.clock` | `{ now(): Date }` | use it, not `Date.now()`, so tests drive time |
| `ctx.effects` | `EffectSink` | INT provides `created`, `push(effect, memberIds, notify)`, `telegram(effect, notify)` |

`Notify` (in `deps.ts`) carries ids, kind, state, ended, `noticeCt`, `startAt`, `need`, `headcount` and the readable Telegram text for Telegram groups only. The push sender looks up subscriptions by member id; on 404 or 410 from the push service it deletes that row.

## 6. Hub relay

Photo drafts keep spike E1's behaviour (6 s budget, heartbeat, fail pending on close). The ladder uses the same socket with job kind `ladder-draft` and an 8 s budget (ADR-0007). The hub answer is used only if it is exactly 4 steps, numbered 1 to 4, minutes strictly decreasing and at least 5, labels at most 4 words and 40 characters, no emoji. Otherwise the template: minutes total x 1, 0.5, 0.25, 0.125 rounded to 5 (60 gives 60, 30, 15, 10), labels from copy keys `ladder.tmpl.1` to `4`. Both count `tier_ran.{photo|ladder}[tier]` in `global_counters`.

## 7. Logging

One line per request: method, route template (ids replaced by `:id`), status, ms (`src/log.ts`). Events log a name and counts only. Errors log the class name, never the message, because driver messages can quote parameters. `npm run audit:logs -- file` checks an exported log for UUIDs and short codes (pass = 0).
