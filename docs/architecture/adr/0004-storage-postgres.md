# ADR-0004: PostgreSQL, not MongoDB Atlas

Status: Accepted. Date: 2026-10-10. Answers founder question Q6 and risk R16.

## Context
The data is small (at most 12 members per group, one live gathering at a time, about 20 rows per gathering) but the deletion promise is strict: everything about a gathering gone within 5 minutes of Gone (BR-D-1), with a storage-level expiry as a backstop (BR-D-2), and an audit that prints 0 (BR-D-7). Both Postgres and MongoDB Atlas credentials were available. The founder asked for a decision on the merits, weighing deletion guarantees, the "fully open" story and the MongoDB Atlas partner prize ($100, one of 10 partner categories).

## Decision
PostgreSQL (Render Postgres in production, PGlite 0.5.8 in tests, `pg` 8.23.1 driver). The MongoDB settings stay in `.env.example` marked unused.

How deletion works:
1. **Cascade.** Every per-gathering table references `gatherings(id) ON DELETE CASCADE`. One `DELETE FROM gatherings WHERE id = $1` removes the photo, answers, jobs, bot message refs, live location and bind tokens in one transaction. Test: `apps/server/test/db.test.ts`, "deleting a gathering removes every per-gathering row".
2. **Expiry column.** Every per-gathering row has `expires_at` (t0 + 5 h for a Flare, S + 24 h for a Plan). Test: "every per-gathering table has an expiry column".
3. **Sweeper.** The server deletes gatherings that are Gone or past `expires_at` every 30 s and once at boot. Reads also filter `expires_at > now()`, so an expired row is never served even in the seconds before the sweep.
4. **Independent backstop.** A Render Cron Job runs `npm run sweep` every 5 minutes as its own process, so a crashed web service cannot stop deletion. It needs the founder's yes with the deploy.
5. **Audit.** `GET /api/v1/audit` counts expired rows per table with plain SQL.

## Options weighed

| Criterion | PostgreSQL | MongoDB Atlas |
| --- | --- | --- |
| Deletion by the database itself | No built-in TTL; sweeper in the app plus a cron backstop | TTL index: the server's TTL monitor runs every 60 s and deletes expired documents, even if our app is down. A real strength |
| Deleting everything about a gathering at once | One transactional `DELETE` with `ON DELETE CASCADE` across 7 tables | No foreign keys; embed answers in the gathering document, keep the photo (up to 1.5 MB) in its own collection, delete both |
| "Fully open" story | PostgreSQL License, OSI approved | Server Side Public License; MongoDB's own FAQ says it "has not been approved by the OSI" (https://www.mongodb.com/legal/licensing/server-side-public-license/faq) |
| Partner prize | None | Eligible for the $100 category. Research: 33 Week 1 entries (4%) mention Atlas; Weekend winners won it with something only Atlas does well (GridFS byte ranges, hybrid vector search). A TTL index is good, but a sweeper does the same job here |
| Short codes unique among live gatherings | Partial unique index `WHERE state <> 'gone'` | Partial unique index with `partialFilterExpression`; equal |
| Tests | PGlite: real Postgres in memory, 0 downloads beyond npm, 13 server tests in 0.7 s | mongodb-memory-server downloads a server binary per platform |
| Running near the app | Render Postgres in the same region and private network as the web service | Separate provider; Render needs a static outbound IP plan or a 0.0.0.0/0 allow-list |
| Self-hosting ("Run it yourself") | `docker run postgres` or any host | MongoDB Community under SSPL, or Atlas account |
| Code already written | Schema, migrations, tests passing | Rewrite |

Atlas wins on one criterion that matters (deletion that runs without our code). Postgres wins on the open license, transactional cascade, tests and operations. The cron backstop closes most of Atlas's lead, so we take Postgres and skip the Atlas category rather than claim it for a database we would use only for the prize.

## Consequences
- The DEV post claims no MongoDB category.
- The sweeper and the cron job are P0 code with tests (deletion within 5 minutes, SRS-PRIV-2).
- Render's free Postgres expires after 30 days; the test needs the paid Basic plan or the free one created within the window. The founder approves either.
