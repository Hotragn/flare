# ADR-0015: "Forget this group"

Status: Accepted. Date: 2026-10-10. Settles the conflict between BR-D-5 ("any member's tap deletes Sparks and Hot spots") and SRS-ID-6 ("only if they are the last member"), question 7 of handoff 06.

## Decision
SRS-ID-6 wins, with one addition:
- Any member's tap deletes **their own** data: member row, push subscription, Telegram map entry, their answers in live gatherings (the solver re-runs), and the Sparks they wrote, found by the per-Spark delete tokens the phone kept (`spark_delete_tokens`). Then the phone deletes its keys and saved data.
- If they were the **last member**, the group goes too: Hot spots blob, all Sparks, counters (`ON DELETE CASCADE` from `groups`).
- A host who forgets a group with a live gathering cancels it first ("Not this time.").

## Why
One member shouldn't erase memories that belong to the whole group, but everyone should be able to take back what they wrote. Spark rows carry no author id, so the delete token is how a writer proves authorship without the server learning who wrote what.

## Consequences
- BR-D-5's last sentence is amended to match (BUG-026). The copy "You're the last one, so its Sparks go too." stays.
- Contract: `DELETE /api/v1/groups/{groupId}/members/{memberId}` returns `{last_member, sparks_deleted}`.
