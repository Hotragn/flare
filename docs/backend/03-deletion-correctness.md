# Deletion correctness

Version 1.0, Sat 2026-10-10. Owner: Backend. Every path a per-gathering record can take, and why each one ends in deletion. Spec: [02-retention-and-deletion.md](02-retention-and-deletion.md).

## 1. The three nets

1. **Delete job.** Every transition to Gone upserts a `delete` job at Gone + 60 s in the same transaction that writes `state = gone`. Both commit or neither does.
2. **Sweeper.** Every 60 s: delete gatherings Gone for over 5 minutes, and anything past `expires_at`. It needs no job and no state.
3. **Storage expiry.** Every per-gathering row carries `expires_at` (t0 + 5 h or S + 24 h, BR-D-2), set at creation from the engine's `expires_at`. Even a gathering whose jobs were lost, never left Kindling and never got a timer is past expiry by then, and net 2 deletes it.

All per-gathering tables cascade from `gatherings`, so deleting the one row deletes the rest in the same statement.

## 2. Paths

| # | Path | What happens | Why it ends in deletion | Test |
| --- | --- | --- | --- | --- |
| 1 | Host taps Done | Gone, delete job + 60 s | net 1; net 2 at + 5 min | `flow.test.ts` Flare full flow |
| 2 | Host cancels | Gone, not this time | same | `restart` test |
| 3 | Ember times out | timer `gone` at t0 + 60 min | the timer runs as a job, then net 1 | Ember path |
| 4 | Lit times out | timer `gone` at t0 + 4 h, or S + step + 60 min | same | Plan path |
| 5 | Plan deadline, under 2 fit | Gone from `plan_deadline` | same | engine tests; BE runs the job |
| 6 | Server crash before commit | nothing was written | the previous state still has its jobs | transaction rollback |
| 7 | Server crash after commit, before the delete job runs | the job row is in Postgres | the next boot's first tick runs overdue jobs | `jobs survive a server restart` |
| 8 | Delete job row lost or deleted | Gone row stays | net 2 deletes Gone rows older than 5 min | `a lost delete job is covered by the sweeper` |
| 9 | Every job lost while Kindling | row stays Kindling | net 3: past t0 + 5 h, the sweeper deletes it | `storage expiry deletes a gathering whose jobs never ran` |
| 10 | Hub drops mid-job | the photo buffer is zero-filled in `finally` and never stored | nothing was written | `app.test.ts`, relay tests |
| 11 | Telegram or push call fails | the error is caught after commit | the state change and jobs are already committed | `a failing Telegram or push call never blocks...` |
| 12 | Two writers race (answer vs `ember` timer) | both take `FOR UPDATE`; the timer re-reads | whichever ends the gathering schedules the delete | BR-F-2 test |
| 13 | A job fires late or twice | the job row is deleted inside the same transaction as its event; a second runner finds no row and does nothing | idempotent | `runEvent` `jobId` check |
| 14 | Member forgets the group | answers leave through the engine, then the row; cascade | hosted gatherings are cancelled first, so paths 2 and 1 apply | `forgetGroup` |
| 15 | Last member forgets | the group row goes; cascade takes everything | one statement | `forgetGroup` |
| 16 | Group idle 180 days | the sweeper deletes the group | cascade | `sweep` |
| 17 | Spark ticket never used | expires at the gathering's expiry + 24 h; swept | net 2 | `sweep` |
| 18 | Phone sends a write after Gone | 410, nothing stored | | `writes after Gone` |
| 19 | Outbox replays after deletion | 404, nothing stored | the id no longer exists | `GET` after delete |
| 20 | Cron (scheduler) stopped for hours | `jobs` keep their due times | the first tick runs every overdue job in due order; the sweeper runs on the next interval or `npm run sweep` | restart test |

## 3. How to check by hand

```
npm run audit -- <gatheringId>   # 0 rows in all 7 tables, exit 0
npm run audit                    # every per-gathering store has 0 expired rows, exit 0
npm run sweep                    # prints counts only
```
