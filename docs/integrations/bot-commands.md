# Bot command reference: @FairlaneFlareBot

Privacy mode on: in a group the bot sees only commands and button taps. Text in square brackets is the copy deck key; the exact words live in `design/prototype/src/lib/copy/deck.json`.

## In the group chat

| Someone does | The bot does | Reply |
| --- | --- | --- |
| Adds the bot with the app's link (`t.me/FairlaneFlareBot?startgroup={token}`), which posts `/start@FairlaneFlareBot {token}` | Checks the chat is allow-listed and the token is live (15 min, single use, stored as a hash). Links the chat to the group | [bot.start.hello] and [bot.start.what], one message |
| Adds the bot to a chat that is not allow-listed | Leaves the chat (`leaveChat`). Logs `tg.refused` with no title or content | Private message to whoever added it: [bot.refuse.dm], if they started the bot |
| Sends any message in an unlisted chat the bot is still in | Leaves the chat | None |
| `/help` | | [bot.help] |
| `/start {token}` with a used or expired token | Nothing | None |
| A command for another bot (`/help@OtherBot`) | Nothing | None |
| Taps **I'm in** (`y:{gatheringId}`) | Makes a Telegram member for this user in this group (no name), records a yes with no conditions | Private toast [bot.cb.yes]. If the user never started the bot: [bot.cb.yesNoChat]. Also a private message [bot.dm.yes] + [bot.dm.yes2] when it can |
| Taps **I'm in** again | Nothing | [bot.cb.already] |
| Taps **I'm in** after Lit or Gone, or on a post from another chat | Nothing | [bot.cb.closed] |
| Taps **Add a condition** (`c:{gatheringId}`) | Makes or reuses the member, creates a bind token (10 min) | Opens the private chat: `t.me/FairlaneFlareBot?start=b_{token}` |
| Taps **Open in Flare** | (URL button) | Opens `{link}?via=tg#k=...` |

## In a private chat

| Someone sends | Reply |
| --- | --- |
| `/start` | [bot.start.hello], [bot.start.what], [bot.start.next] |
| `/start b_{token}` (from Add a condition) | [bot.dm.link] with a button [invite.condition] to `{link}?via=tg&bind={token}#k=...`. Expired token: [bot.dm.nothingOpen] |
| `/help` | [bot.help] |
| Anything else, text or not | Dropped unread: not parsed, stored or logged (ADR-0013). If one of the user's groups has an open Flare: [bot.dm.link] with a fresh bind link. Else [bot.dm.nothingOpen] |

## Posts the bot writes

| When | Message | Buttons |
| --- | --- | --- |
| A Flare starts (photo from the host's phone, or text after 15 s with no photo) | `{invite}` / `{host} · {place}` / [bot.post.need] / [bot.post.until]. Plans add one [bot.plan.step] line per step | [invite.yes], [invite.condition], [bot.post.open] |
| The count changes | Same post, new [bot.post.need]. At most one edit per 3 s per post | Same |
| Lit (Flare) | Post edited to [lit.notice]; one new message [lit.notice] so phones buzz; private [lit.notice] with [lit.find] to each Telegram member of the chosen set who started the bot | [bot.post.open] only |
| Lit (Plan) | Same, with [push.planOn] | [bot.post.open] only |
| Ember | Post edited: bench name, [bot.post.ember]; one new message [push.ember] (Plan: [bot.post.smaller]) | Answer buttons stay |
| Plan steps down | Post edited: [bot.post.smaller] | Answer buttons stay |
| Gone | Post edited to [gone.title] or [outside.thanks]; 20 s later every bot message for the Flare (group and private) is deleted with `deleteMessages` | None |

## Callback data and limits

| Item | Value | Limit |
| --- | --- | --- |
| `y:{uuid}`, `c:{uuid}` | 38 bytes | 64 bytes |
| Deep-link payload `b_{token}` | 24 characters | 64 |
| Startgroup token | 22 characters (128 bits, base64url) | 64 |
| Count edits | 1 per 3 s per post | 20 messages per minute per group |
| `deleteMessages` | up to 100 ids per call, per chat | 1 to 100 |
