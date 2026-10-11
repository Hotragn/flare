# Data retention and deletion spec

Version 1.0, Sat 2026-10-10. Owner: Backend. Rules: BR-D-1 to BR-D-7, ADR-0004, ADR-0015. Schema: `apps/server/src/db/migrations/0001` to `0003`. Code: `src/core/gatherings.ts` (Gone), `src/core/scheduler.ts` (delete job), `src/core/sweep.ts` (sweeper, audit).

## 1. Per-gathering stores (deleted at Gone)

Every row has `expires_at` and `ON DELETE CASCADE` from `gatherings`.

| Store | Table | Removed at Gone (same transaction) | Removed by the delete job (Gone + 60 s) | Storage expiry |
| --- | --- | --- | --- | --- |
| DS1 | gatherings | | the row (cascade takes the rest) | t0 + 5 h (Flare), S + 24 h (Plan) |
| DS2 | responses | | cascade | same as the gathering |
| DS3 | photos | yes | cascade | same |
| DS4 | jobs | all but `delete` | cascade | same |
| DS7 refs | bot_messages | | cascade (INT deletes the posts first, BR-D-3) | same |
| DS7 binds | telegram_binds | yes | cascade | 15 min after issue |
| DS11 | live_locations | yes | cascade | same as the gathering |

The sweeper deletes any gathering that is Gone for more than 5 minutes or past `expires_at`, then any row in these tables past its own `expires_at`.

## 2. Stores that survive Gone (BR-D-4)

| Store | Table | Kept until |
| --- | --- | --- |
| DS5 | groups, members | the last member forgets the group (ADR-0015), or 180 days without a gathering |
| DS6 | push_subscriptions | 30 days without a gathering in the group, the member forgets, or 404/410 from the push service |
| DS7 map | members.telegram_user_id | set to null after 30 days without a gathering |
| DS8 | sparks | 180 days without a gathering; the writer forgets (by delete token); the last member forgets |
| DS8 tickets | spark_tickets | used once, or the gathering's storage expiry + 24 h |
| DS9 | hotspots | 180 days without a gathering, or the last member forgets |
| DS10 | counters | with the group |
| SRS-IF-1 | idempotency | 24 h |
| DS7 links | telegram_links | 15 min |

"Without a gathering" uses `groups.last_gathering_at`, set at every create, or `created_at` for a group that never had one.

## 3. Schedule

| What | When | How |
| --- | --- | --- |
| Gone cleanup | the transition to Gone | `runEvent` |
| Delete job | Gone + 60 s, 1 s tick | `deleteGathering`: one `DELETE ... RETURNING` |
| Sweeper | every 60 s in the server; `npm run sweep` by hand | `sweep(db, now)` |
| Audit | `GET /api/v1/audit` (cached 60 s), `npm run audit -- <id or all>` | `audit`, `auditGathering` |

## 4. Forget this group (SRS-ID-6)

`DELETE /groups/{g}/members/{m}`, in this order:
1. Live gatherings the member answered: engine `member_left` (counts and SSE stay right).
2. Live gatherings the member hosts: engine `cancel`, so every phone gets "Not this time."
3. Sparks matching the sent delete tokens.
4. Gone gatherings the member hosted; then the member row. Cascade: push subscription, answers, live location, binds.
5. If no member is left: the group row. Cascade: Hot spots, Sparks, tickets, counters, links.

## 5. Proof

- `flow.test.ts`: full Flare, Ember, Plan and failure flows end with `auditGathering` at 0 rows in all 7 tables and `audit().pass` true.
- `contract.test.ts` `forgetGroup`: after the last member leaves, 0 rows in groups, members, gatherings, counters for that group.
- Spike E2 timing (`docs/engineering/spikes/evidence/deletion-timing.txt`): 100 Gone gatherings swept in 21 ms with the partial index.
