# Flare: Privacy statement

Generated from `design/prototype/src/lib/copy/deck.json` by `scripts/copy-lint.mjs`; the website shows the same words (section W4). Version 1.0, 2026-10-10.

**Which variant applies:** variant **A** is in force. A = server holds spot coordinates until Gone (analyst decision 10, current requirements). B = OQ-1 adopted: coordinates only inside the sealed invite. Switch to B only after the architect's decision record adopts OQ-1. Lines marked "Variant A" or "Variant B" below are the only difference.

## The privacy promise

- Photos are encrypted on your phone. The key is in the link, after the #, and never reaches our server.
- Conditions and access needs stay on your phone. Only rules like “back by 5 PM” are sent.
- There's no No button, so there's no no to show or store.
- Within 5 minutes of the end, the Flare, its photo and every yes are deleted. Only group counters remain, like how many came.
- No accounts, no ads, no trackers, and no fonts or scripts from other sites.

## What we keep, and for how long

| What | Where, and who can read it | Deleted |
| --- | --- | --- |
| Photo, six words, spot name, your first name | Our server, sealed with the group key. Only people with the link can read it. | Within 5 minutes of the end. Names go when you tap “Forget this group”. |
| Who said yes, and their rules | Our server, used only to decide if it lights. Never shown to anyone. | Within 5 minutes of the end. |
| Variant A: The spot's map position | Our server can read it. It uses it to pick a nearby bench and point the compass. | Within 5 minutes of the end. |
| Variant B: The spot's map position | Only inside the sealed invite. Your phone picks the nearby benches, so our server never reads it. | Within 5 minutes of the end. |
| Condition words, needs, walk requests, map photos, phone check | Only on your phone. | When you clear them. Map photos go right after the draft. |
| Sparks and Hot spots | Our server, sealed with the group key. Only your group can read them. | After 180 days with no meetups, or when the last person taps “Forget this group”. |
| Alert sign-ups and the Telegram link to your group | Our server, so it can send you the lit message. | After 30 days with no meetups. |
| Group counters, like Flares sent and how many came | Our server, under a random group id. No names, places, photos or words. | Kept, so we can report how many people met. |
| Server logs | Our server. Never request bodies, photos, names, places, conditions or link keys. | After 7 days. |

## Limits we're honest about

- Telegram sees what's posted in Telegram: the photo, the six words, the spot and the count. Conditions you send the bot pass through Telegram and our server. We keep only the rule.
- In a small group, people can sometimes guess who said yes, or who made a plan smaller. With 2 or 3 people, the count alone can give it away.
- Text and satellite messages are outside our control. Your carrier and Apple carry them, and we can't delete them.
- Anyone with the group link can read that group's invites, Sparks and Hot spots. Share it only with the group.
- **Variant A:** Our server holds the spot's map position until the Flare ends, to pick a nearby bench and point the compass.
- **Variant B:** Our server never holds the spot's map position. Your phone picks nearby benches and seals them into the invite.
- To write the six words, your photo goes to our laptop over an encrypted link. If the laptop can't be reached, you type them and nothing is sent.
- Alerts travel through Apple's push service, sealed so Apple can't read them.

## Deletion audit, after our Sunday field test

The audit runs after the field test on Sun Oct 11. It counts leftover records in every store. Passing is 0.

## Where each claim comes from

| Claim | Requirement or decision |
| --- | --- |
| Photo encrypted on the phone, key only in the link fragment | FR-PRIV-1, SRS-ID-2, SRS-SEC-3 (AES-256-GCM) |
| Condition words and needs stay on the phone | FR-PRIV-2, SRS-PRIV-1, BR-C-9 |
| No No button | FR-RES-4, SRS-RES-5 |
| Deleted within 5 minutes of the end; storage expiry as a backstop | BR-D-1, BR-D-2, SRS-PRIV-2 |
| What survives, and for how long | BR-D-4, BR-D-5, docs/product/07-kpis.md |
| Logs: 7 days, no bodies, photos, names, places, conditions or keys | BR-D-6 |
| No analytics, ads, trackers or third-party fonts | SRS-PRIV-7, SRS-SEC-6 |
| Telegram, small groups, SMS and satellite limits | FR-PRIV-7, R6, R19 |
| Anyone with the link can read the group's history | R22 |
| Spot position on the server until the end (Variant A) | Analyst decision 10; OQ-1 would remove it (Variant B) |
| Photo goes to our laptop for the six words | FR-AI-1, SRS-IF-5 (hub tier) |
