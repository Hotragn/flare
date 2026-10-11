# Handoff 06c: Backend to the engineering lead, INT, FE and PWA

Sat 2026-10-10. Branch `wp/backend`. Brief: docs/engineering/briefs/6c-backend.md.

## Start here

- Design: [docs/backend/01-service-design.md](../backend/01-service-design.md)
- Retention and deletion spec: [02-retention-and-deletion.md](../backend/02-retention-and-deletion.md)
- Deletion correctness (20 paths): [03-deletion-correctness.md](../backend/03-deletion-correctness.md)
- Running, settings, commands, tests: [04-running-the-server.md](../backend/04-running-the-server.md)

## What was delivered

- Every BE operation in openapi.yaml (33 of 37 operations; INT owns the 4 Telegram ones and the `/g/{id}` preview). Strict zod bodies, contract error codes, member auth by token hash, idempotency, rate limits (SRS-SEC-5).
- The real `@flare/engine` behind `createApp({ engine })`: creation through `createFlare` / `createPlan`, every event through `runEvent` (row lock, transition, full answers list saved, database effects in the same transaction, SSE, push and Telegram after commit). ICD-1 v1.1 counters (`by`, `op`) and the 1.0 value-in-bucket form both handled.
- SSE live updates (asyncapi `gatheringEvents`): view on connect, per version, keepalive 15 s, final `gone`, `Last-Event-ID`.
- Scheduler on the `jobs` table (1 s tick, survives restarts), delete job at Gone + 60 s, sweeper every 60 s (spike E2 SQL), audit endpoint.
- Migration 0003 (0001 and 0002 kept): `responses.checks_at`, one job per kind per gathering, three indexes.
- Hub relay: ladder jobs (`ladder-draft`, 8 s) next to photo drafts; spike E1 heartbeat and tests kept. Template ladder from new copy keys.
- `/app/*` and `/g/*` serve `200.html` with its CSP hashes.
- CLIs: `npm run sweep`, `npm run audit -- <id|all>`, `npm run kpi`, `npm run audit:logs -- <file>`. BE9 sits with INT in the WBS; I built `kpi` and `audit:logs` because they read my tables. INT: use them as they are.

## Proof

| Check | Result |
| --- | --- |
| `npx vitest run apps/server` | 77 tests pass in about 11 s (contract 39, flow 8, ops 9, scaffold 21) |
| Full flow (brief "Done") | `flow.test.ts`: group, Flare, photo, answers, Lit, live location, arrivals, Done, delete job, Spark with ticket, sweep, `audit().pass` true and 0 rows in all 7 per-gathering tables |
| Contract coverage | last test in `contract.test.ts` fails if any BE operationId lacks a describe block: 0 missing |
| Deletion paths | restart, lost delete job, storage expiry (t0 + 5 h), failing Telegram and push: all end at 0 rows |
| Log privacy | 450 server log lines from the whole server suite through `npm run audit:logs`: 0 UUIDs, 0 short codes |
| `npm run contracts` | redocly lint ok, asyncapi ok, every server route is in openapi.yaml |
| `npm run ci` | green on `wp/backend`: 249 tests in 23 files, contracts ok, build ok, web JS 62.7 KB of 150 KB, 37 diagrams |

## Decisions

1. GET of a Gone gathering (and any write to it) answers 410 with `ended` in the body until the row is deleted, so every phone shows the same last screen (SRS-ST-3). After deletion: 404.
2. `cant_make_it` before Lit answers 409 `wrong_state` (SRS-RES-6); the engine alone would accept it.
3. Checks from a member with no answer answer 422 `unknown_member` (engine rule); added to openapi.
4. A host who forgets the group cancels their live gatherings first ("Not this time." for all), then the cascade runs.
5. Arrivals whose `recorded_at` is before Lit (minus 5 s skew) answer 200 with `counted: false` (BR-H-5).
6. Hot spots: no blob yet means `If-Match: "0"` creates version 1.
7. Spark tickets expire at the gathering's storage expiry + 24 h, a safe upper bound on "24 h after Gone".
8. Without `DATABASE_URL` the data routes answer 503 `not_configured`; health, config and drafts still work.

## Additive openapi changes (endpoints I own, `npm run contracts` green)

- `410` on addTextYes, fade, addArrival, markDone, cancelGathering.
- `422` on putMyChecks.
- `Gone` response description: body carries `ended` while the row exists.

## Interface change requests

- ICR-BE-1 (hub protocol, packages/shared/src/hub-protocol.ts, owner lead/ODAI): asyncapi already lists `ladderJob` and `result.ladder`, but the zod side has neither. The relay reads `ladder` from the raw message for now. Proposed diff:

```ts
export const LadderJob = z.object({
  type: z.literal("job"), id: z.string().uuid(), kind: z.literal("ladder-draft"),
  ask: z.string().max(80), total_minutes: z.number().int().min(40).max(600),
  weather: z.object({ rain_likely: z.boolean(), temp_f: z.number().int() }).optional(),
});
// JobResult: add
  ladder: z.array(z.object({ step: z.number().int().min(1).max(4), label: z.string(), minutes: z.number().int() })).length(4).optional(),
export const ToHub = z.discriminatedUnion("type", [JobHeader, Ping]); // becomes z.union([JobHeader, LadderJob, Ping])
```

  ODAI's hub must answer `ladder-draft` jobs; until then every ladder waits the 8 s budget and falls back to the template.

## For INT

- Mount with `createApp({ ..., mounts: [mountTelegram, mountPreview], effects: createPush(ctx) ... })`. The `ctx` fields are in design section 5. Telegram taps go through `runEvent(ctx, id, event, now)` so SSE, jobs and counters stay right.
- `EffectSink.created(notify)` is called after a Telegram group's gathering is created (the first bot post). `telegram(effect, notify)` is only called when the gathering has `telegram_plain`.
- BR-D-3: delete the bot's posts on `telegram final`; `bot_messages` rows go with the cascade either way.

## Copy keys added

`ladder.tmpl.1` "Long walk", `ladder.tmpl.2` "Short walk", `ladder.tmpl.3` "Sit a while", `ladder.tmpl.4` "Quick hello" (kind label, owner apps/server/src/routes/ai.ts). Copy lint: 579 strings, 0 problems.

## Not done

- The CLIs were not run against the real Postgres in `.env`: that database is shared and `openDb()` migrates it, so it waits for the lead's integration run. They are thin wrappers over functions the tests cover.
- No deploy, nothing public.

## Bugs

docs/engineering/bugs/backend.md: BUG-BACKEND-1 to 3.
