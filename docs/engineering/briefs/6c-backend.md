# Brief 6c: Backend engineer

Branch `wp/backend`. Ports 8810 to 8819. Handoff: docs/handoffs/06c-backend.md.

You're a backend engineer with 10 years building realtime services that must be exactly right about data deletion. Build the server: API, live updates, the hub relay, storage, scheduling and deletion.

## Own
`apps/server/**` except `apps/server/src/telegram/**`, `apps/server/src/push/**`, `apps/server/src/preview/**` (INT's). `docs/backend/**`, notes `backend-progress.md`, bugs `backend.md`. The hub relay server side (`src/hub/relay.ts`) stays yours; keep spike E1's heartbeat behaviour and tests.

## Build (WPs BE1 to BE6, BE8, plus storage for BE7)
- Every endpoint and live update in docs/architecture/contracts/openapi.yaml and asyncapi.yaml (gatheringEvents) except Telegram webhook, telegram-link/bind/photo handlers and the `/g/{id}` preview (INT provides mount functions; you define and document the `deps` they receive: db, engine, events bus, config).
- Engine through dependency injection (`createApp({ engine, ... })`). Write a fake engine from ICD-1 for your tests; the real `@flare/engine` arrives at integration. Effects run after commit.
- Postgres via migrations (keep 0001 and 0002; add numbered ones), retention and deletion spec, scheduler surviving restarts, the sweep (spike E2 SQL) and `npm run sweep`, audit endpoint, `npm run audit` CLI that proves nothing is left behind for a gathering id or all.
- Validation (zod from the contract, strict), rate limits (SRS-SEC-5), idempotency, contract error codes, privacy-safe logging (09-observability.md), SSE fan-out, `/config`, serving `200.html` for `/app/*` and `/g/*` (see url-map.md), drafts and the ladder route on the relay.
- `npm run kpi` (07-kpis.md) and `npm run audit:logs` (BE9 was moved to INT in the WBS; you build them anyway because they read your tables, and tell INT in your handoff).

## Deliver, all finished
Service design doc; contract tests for every operation (success and every error code); integration tests; data retention and deletion spec; deletion correctness doc (every path a record can take and why each ends in deletion, including server crash, hub drop, Telegram failure, cron); server docs. A full-flow test: create group, Flare, answers, Lit, arrivals, Done, Spark, sweep, audit shows 0.

Done = the server passes all tests and a full flow runs from creation to deletion.
