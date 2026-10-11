# Backend bugs

Format: ID, date, area, symptom, cause, fix, proof. The lead merges these into docs/BUGLOG.md.

---

## BUG-BACKEND-1: Transactions on a pool run on random connections

- **Date:** 2026-10-10
- **Area:** Backend (apps/server/src/db/db.ts)
- **Symptom:** The scaffold's `migrate()` sent `begin`, the statements and `commit` through `pool.query`. On node-postgres each call can take a different pooled connection, so `begin` and `commit` may not wrap the statements at all.
- **Cause:** `pg.Pool.query` checks out a client per call.
- **Fix:** `Db.tx(fn)` checks out one client (`pool.connect()`), runs `begin`, `fn(q)`, `commit` or `rollback`, and releases it. PGlite uses its own `transaction()`. `migrate()` and every engine write use `tx`.
- **Proof:** `npx vitest run apps/server`: 77 tests, including the BR-F-2 race test and the restart test, on PGlite; the pg path is the same shape.

## BUG-BACKEND-2: Audit query failed on unused parameters

- **Date:** 2026-10-10
- **Area:** Backend (apps/server/src/core/sweep.ts)
- **Symptom:** `audit()` threw "could not determine data type of parameter $1" for stores whose query used only `$3` or `$4`.
- **Cause:** Postgres must infer a type for every bound parameter; an unused one has none.
- **Fix:** Every store query is wrapped with a row of four typed cut-offs (`$1::timestamptz` to `$4::timestamptz`) and always gets all four.
- **Proof:** `flow.test.ts` "storage expiry deletes a gathering whose jobs never ran" passes (audit false, sweep, audit true).

## BUG-BACKEND-3: Log audit flagged the word PATCH as a short code

- **Date:** 2026-10-10
- **Area:** Backend (apps/server/src/core/report.ts, `npm run audit:logs`)
- **Symptom:** A clean 450-line server log failed with 35 "short codes".
- **Cause:** `PATCH` has 5 letters, all in the short-code alphabet (BR-CH-3), and every PATCH request line holds it.
- **Fix:** A stoplist of our own log words (`PATCH`) is skipped; the test's clean line now uses PATCH.
- **Proof:** the 450 log lines from `npx vitest run apps/server`: `{"uuids":0,"short_codes":0}`, PASS.
