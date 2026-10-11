# Backend progress (wp/backend)

## Done
- Step 0: middleware (auth, rate limit, idempotency, strict body) in apps/server/src/http/.
- Step 1: every BE route in openapi.yaml; engine runner (lock, transition, effects after commit);
  scheduler (jobs table, 1 s tick); sweep; audit; SSE; ladder; 200.html for /app/* and /g/*.
- Tests: flow.test.ts (8 full flows), contract.test.ts (38, one describe per operationId).

## In progress
- Step 2: CLIs (`npm run sweep`, `npm run audit`, `npm run kpi`, `npm run audit:logs`), openapi 410 additions.

## Exact next step
- Write apps/server/src/cli/*.ts and root package.json scripts; then docs/backend/*, handoff 06c.
