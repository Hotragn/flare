# Running the server

Version 1.0, Sat 2026-10-10. Owner: Backend.

## Start

```
export FLARE_ENV_FILE="/Users/hotragn/Documents/Claude Code/HacktoberFest/flare/.env"
npm run check-env server   # set or missing, never values
npm start                  # node apps/server/src/main.ts
```

Settings read by `apps/server/src/env.ts`:

| Name | Default | Use |
| --- | --- | --- |
| `PORT` | 8787 | HTTP and `/hub` |
| `DATABASE_URL` | none | Postgres. Without it, data routes answer 503 `not_configured`; health and drafts work |
| `HUB_SECRET` | none | `/hub` bearer secret; without it no hub can connect |
| `WEB_BUILD_DIR` | `apps/web/build` | static site; `200.html` for `/app/*` and `/g/*` |
| `HUB_JOB_TIMEOUT_MS` | 6000 | photo draft budget (BR-AI-1) |
| `HUB_LADDER_TIMEOUT_MS` | 8000 | ladder budget (ADR-0007) |
| `HUB_PING_MS` | 5000 | hub heartbeat (spike E1) |
| `VAPID_PUBLIC_KEY` | null | returned by `/api/v1/config` |
| `TELEGRAM_BOT_USERNAME` | null | returned by `/api/v1/config` |
| `PUBLIC_BASE_URL` | `http://localhost:8787` | links |
| `LOG_LEVEL` | info | pino level |

Migrations run at boot, once each, in a transaction (`schema_migrations`). The scheduler (1 s jobs, 60 s sweep) starts when both the database and the engine are present.

## Commands

| Command | Output | Exit |
| --- | --- | --- |
| `npm run sweep` | rows deleted per table, ms | 0 |
| `npm run audit` | every store: total and expired rows | 0 pass, 1 fail |
| `npm run audit -- <gatheringId>` | rows that still name that id, 7 tables | 0 pass, 1 fail |
| `npm run kpi` | KPI 1 to 3, Plan outcomes, Sparks, `tier_ran` (07-kpis.md) | 0 |
| `npm run audit:logs -- <file>` | UUIDs and short codes found, line numbers only | 0 when both are 0 |

All four read `DATABASE_URL` (except `audit:logs`) and print counts only.

## Tests

`npx vitest run apps/server` runs on PGlite (Postgres in WASM) with the real `@flare/engine` and a hand-driven clock:

| File | Tests | What |
| --- | --- | --- |
| `contract.test.ts` | 39 | one `describe` per BE operationId, success and each error code; a last test fails if an operation has no block |
| `flow.test.ts` | 8 | full Flare, Ember, Plan, restart, lost job, storage expiry, failing effects |
| `ops.test.ts` | 9 | idempotency, log privacy, KPI report, SPA shell, no database |
| `app.test.ts`, `relay.test.ts`, `db.test.ts`, `static.test.ts` | scaffold and spike E1 tests, kept |
