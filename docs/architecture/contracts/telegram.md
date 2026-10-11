# Contract: Telegram bot

Version 1.0, Sat 2026-10-10. Bot API 10.3 (checked 2026-10-10, lab report 03). Bot: `@FairlaneFlareBot`, privacy mode on. Webhook: `POST /api/v1/telegram/webhook` (openapi.yaml). Decision: [ADR-0013](../adr/0013-telegram-readable-posts.md). Copy: `bot.*` keys in the copy deck, listed in docs/content/06-channels.md.

## 1. Setup

| Step | Call | Notes |
| --- | --- | --- |
| Deploy | `setWebhook(url=https://{host}/api/v1/telegram/webhook, secret_token=TELEGRAM_WEBHOOK_SECRET, allowed_updates=["message","callback_query","my_chat_member"], drop_pending_updates=true)` | Run by `npm run -w apps/server telegram:webhook` after the founder approves the deploy. Polling and webhook are exclusive; no local poller may run at the same time |
| Every update | Compare header `X-Telegram-Bot-Api-Secret-Token` with `TELEGRAM_WEBHOOK_SECRET` in constant time | Wrong or missing: 401, nothing logged but `tg.refused` |
| Allow-list | `TELEGRAM_ALLOWED_CHAT_IDS`, comma list | At release: only "Flare test" (BR-CH-1) |

The handler answers 200 within 1 s and does the Telegram calls after the response, so Telegram never retries a slow update. Each update id is processed once (idempotency table, key `tg:{update_id}`).

## 2. Linking a chat to a group

1. In the app, the host taps "Add to Telegram". The phone calls `POST /api/v1/groups/{groupId}/telegram-link` and opens `https://t.me/FairlaneFlareBot?startgroup={token}`.
2. The host picks the chat. Telegram adds the bot and posts `/start@FairlaneFlareBot {token}` there.
3. The bot gets the `message`. If the chat id is allow-listed and the token is live (15 min, single use), it sets `groups.telegram_chat_id` and `groups.channel = 'telegram'`, and replies `bot.start.hello`, `bot.start.what`.
4. If the chat is not allow-listed, the bot calls `leaveChat`, logs `{event: "tg.refused", reason: "not_allow_listed"}` with no chat title or content, and does nothing else (SRS-CH-1). The same happens on `my_chat_member` for any unlisted chat.

Before step 1 the app shows the disclosure: Telegram will see what Flare posts there (the card or, if the group turns photos on, the photo; the six words, the place, the host's first name and the count).

## 3. Posting a gathering

At `createGathering` for a Telegram group, the phone sends `telegram: {host, invite, place, link}` in plain text. The server keeps it in `gatherings.telegram_plain` until Gone (deleted with the row), and:

1. The post is a photo with this caption (ADR-0023). By default the photo is the **branded card**: a 1200x800 PNG rendered in memory (`apps/server/src/telegram/card.ts`) with the flame for the state, the six words, the place label and the count line; no names and no real photo. It goes out right away. Only when the group turned on "Show photos in this Telegram group" (`PUT /groups/{id}/telegram-settings`, off by default) does the bot wait up to 15 s for `PUT /gatherings/{id}/telegram-photo` (the same 768 px JPEG it sent for the draft) and send that instead, from memory. With photos off, `telegram-photo` answers 409 and nothing is uploaded. Caption:
   ```
   {invite}
   {host} · {place}
   Need {n} more. Nobody sees who.
   Open until {time}.
   ```
   and an inline keyboard:
   - `[I'm in]` callback data `y:{gatheringId}` (38 bytes, under the 64-byte cap)
   - `[Add a condition]` callback data `c:{gatheringId}`
   - `[Open in Flare]` URL button: `{link}?via=tg` (the fragment carries the key, which is why ADR-0013 discloses it)
2. Saves `(chat_id, message_id)` in `bot_messages`.

Photos on and no photo arrives within 15 s: the card goes out. If the card cannot be rendered, the post goes out as `sendMessage` with the same text and keyboard. The photo for Telegram is never stored on the server.

Edits (section 5) on a card post use `editMessageMedia` with a newly rendered card, so the image follows Kindling, Lit, Ember and the final line; a real-photo post edits only its caption. Every post is deleted at Gone (section 6).

## 4. Taps

| Update | Bot does | Private reply (answerCallbackQuery, `cache_time: 0`) |
| --- | --- | --- |
| `y:{id}` from a new Telegram user | Makes a member (`via = telegram`, `name_ct = null`, `telegram_user_id`), records a yes with no rules, runs the solver | `bot.cb.yes` "You're in. Only you see this." If the user never started the bot: `bot.cb.yesNoChat` |
| `y:{id}` again | Nothing | `bot.cb.already` |
| `c:{id}` | Makes (or reuses) the member, creates a bind token (10 min) | Answers with `url = https://t.me/FairlaneFlareBot?start=b_{token}`: Telegram opens the private chat. Bonus: an ephemeral group message to that user with the same link (delivery not guaranteed, Bot API 10.2) |
| `/start b_{token}` in private | Replies with one URL button `[Add a condition]` → `{link}?via=tg&bind={token}` | The link page opens, the phone joins, calls `telegram-bind`, and the condition flow runs on the phone, read back as usual |
| Any other private text | Drops it unread: not parsed, not stored, not logged | Replies `bot.dm.link` with the same `[Add a condition]` button (`invite.condition`) when one gathering is open, else `bot.dm.nothingOpen` |
| `/help` | | `bot.help` |

Free text is never parsed on the server (founder decision, ADR-0013). That keeps BR-C-9 true for Telegram too: conditions are made only by the phone's rules parser.

## 5. Updates to the post

- Count changes: `editMessageCaption` (or `editMessageText`) with the new "Need N more." and the same keyboard, at most once per 3 s per message (coalesced), well under 20 messages a minute per group. "message is not modified" (400) is ignored.
- Lit: edit the post to "It's lit. {host} is at {place}.", remove the I'm in and condition buttons, then send one new notifying message `lit.notice` to the chat so phones buzz. DM each Telegram member of the chosen set who started the bot: `lit.notice` with a [Find them] button (`lit.find`).
- Ember: edit to `bot.post.ember` with the bench name from `telegram.ember_places` (only Telegram groups send it), and send one notifying message.
- Plan smaller: edit to "Smaller plan: {step}."

## 6. Cleanup at Gone (BR-D-3, SRS-CH-4)

1. Edit the post to the final line ("Not this time." or "Thanks for coming.").
2. Within the 5-minute window of BR-D-1, `deleteMessages(chat_id, [all message_ids])` in one call (1 to 100 ids). Every post is under 36 h old (BR-P-1), inside Telegram's 48 h delete limit.
3. Delete the `bot_messages` rows. The gathering row (with `telegram_plain`) is deleted by the sweeper; `ON DELETE CASCADE` takes the rest.
4. A failed delete is retried 3 times over 2 min, then logged as `{event: "tg.delete_failed", count}` with no ids.

## 7. Limits we rely on

| Limit | Value | Source |
| --- | --- | --- |
| Messages per group | 20 per minute | Bot FAQ, lab report 03 |
| Callback data | 1 to 64 bytes | Bot API |
| answerCallbackQuery text | 0 to 200 characters | Bot API |
| Delete window | 48 h after sending | Bot API |
| deleteMessages | 1 to 100 ids | Bot API |
| Deep-link payload | up to 64 of `A-Z a-z 0-9 _ -` | Bot features page |
