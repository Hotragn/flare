# Backend progress (wp/backend)

## Done
- Middleware (auth, rate limit, idempotency, strict body).
- Every BE route in openapi.yaml on the real @flare/engine; SSE; scheduler; delete job; sweep; audit; ladder; 200.html.
- CLIs: sweep, audit, kpi, audit:logs.
- Tests: contract 39, flow 8, ops 9 (77 server tests in total).
- Docs: docs/backend/01 to 04; handoff docs/handoffs/06c-backend.md; bugs BUG-BACKEND-1 to 3.

## In progress
- Nothing.

## Exact next step
- Lead: merge wp/backend; run the CLIs once against the integration database; wire INT's mounts and effects.
