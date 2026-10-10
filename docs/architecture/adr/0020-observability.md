# ADR-0020: Structured logs with redaction, counters, no third-party telemetry

Status: Accepted. Date: 2026-10-10. Details in [09-observability.md](../09-observability.md).

## Decision
- **Logs:** pino 10.4.0, JSON to stdout, Render keeps them 7 days (BR-D-6). One line per request: method, route template (ids replaced by `:id`), status, milliseconds. Redaction paths drop `authorization`, `cookie`, tokens, bodies. Events use fixed names (`hub.hello`, `tg.refused`, `sweep.deleted`) with counts, never content.
- **Metrics:** the KPI counters in `counters` and `global_counters` (07-kpis.md), nothing finer than the day.
- **Health:** `/api/v1/health` (hub connected or absent, database ok or down).
- **Audit:** `/api/v1/audit` (ADR-0004).
- **No** Sentry, analytics, APM or third-party scripts (SRS-PRIV-7). Errors are logged with a stack and a fixed event name; the stack never includes request data because handlers don't put it in error messages.

## Consequences
Debugging a user's problem means reproducing it, not reading their data. The field test runs with the team watching the Render log stream.
