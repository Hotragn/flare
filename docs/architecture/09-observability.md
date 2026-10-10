# Flare: Privacy-safe observability

Version 1.0, Sat 2026-10-10. Owner: Architect. Decision: [ADR-0020](adr/0020-observability.md). Rule: we can tell whether Flare works without learning anything about the people using it (BR-D-6, SRS-PRIV-4, SRS-PRIV-6).

## 1. Signals

| Signal | Source | Contains | Never contains | Kept |
| --- | --- | --- | --- | --- |
| Request log | pino, one line per request | method, route template (`/api/v1/gatherings/:id/me`), status, ms | ids, codes, bodies, headers, IPs, user agents, query strings | Render, 7 days |
| Event log | pino, fixed event names | event name, counts, durations, error codes | content of any kind | Render, 7 days |
| Health | `GET /api/v1/health` | ok, version, hub connected or absent, db ok, down or not configured | | live |
| Counters | `counters`, `global_counters` | the KPI counters in docs/product/07-kpis.md, day buckets; `tier_ran.{job}.{tier}` | anything per person, any time finer than a day | with the group; global forever |
| Deletion audit | `GET /api/v1/audit` | expired rows per table | ids | live, cached 60 s |
| Screen-time bucket | phone sends a bucket index (0 to 5) once per gathering | bucket index | seconds, timestamps | counter |

## 2. Event names

| Event | Fields | When |
| --- | --- | --- |
| `listen` | port | server up |
| `db.migrated` | applied | boot |
| `hub.hello` | model, ready | hub connects |
| `hub.closed`, `hub.replaced`, `hub.refused` | | hub socket changes; wrong secret |
| `hub.job` | kind, ok, error, ms | each AI job |
| `gathering.transition` | kind, from, to | every state change (no id) |
| `sweep.deleted` | gatherings, rows | each sweep with work |
| `push.sent` | event, ok, status | each push (status 404/410 deletes the subscription) |
| `tg.refused` | reason | unlisted chat or bad secret |
| `tg.delete_failed` | count | cleanup retries exhausted |
| `rate.limited` | scope (member, gathering, ip) | 429 |
| `error` | code, stack | unhandled error |

## 3. Redaction

`apps/server/src/log.ts` sets `base: undefined` (no hostname or pid) and redacts `req.headers`, `headers`, `authorization`, `body`, `photo`, `draft`, `invite`, `alt`, `name`, `spot`, `lat`, `lon`, `ip`, `token`, `secret`. `routeTemplate()` replaces UUIDs and any path segment of 20+ token characters with `:id`. Handlers never put request data in `Error` messages, so stacks carry none.

## 4. Field test dashboard (Sunday, 11 AM to 3 PM ET)

The team watches three things on a laptop:
1. Render log stream filtered to `hub.` and `error` events.
2. `curl https://{host}/api/v1/health` every 30 s (hub must stay `connected`).
3. `GET /api/v1/audit` after the last gathering: `pass: true`.

KPI table after the test: `npm run kpi -- --from 2026-10-11T15:00Z --to 2026-10-11T19:00Z` (SRS-FLD-1, engineering).

## 5. Checks

- `npm run audit:logs -- <exported log>` greps for any UUID, short code, coordinate-shaped number pair or known test word; passing = 0 matches (engineering, P0).
- A log-capture test (engineering, P0, T-PRIV-4) runs a full Flare and asserts every log line has only `{level, time, m, r, s, ms, msg}` or a listed event's fields.
