# ADR-0013: Telegram groups get readable posts, disclosed; the bot never reads free text

Status: Accepted. Date: 2026-10-10. Answers questions 3 and 4 of handoff 06 with the founder's lean. Contract: [contracts/telegram.md](../contracts/telegram.md).

## Context
A Telegram post needs readable text (the six words, the place, the host's first name) and buttons that open the link. The server holds only sealed data for link groups. Conditions typed to the bot would reach Telegram and our server as free text, which BR-C-9 forbids, and resolving "only with Amor" needs readable names the server doesn't have (BR-ID-3).

## Decision
1. **Readable only for groups that chose Telegram.** When the host adds the bot, the group's `channel` becomes `telegram`. From then on the host's phone sends `telegram: {host, invite, place, link, ember_places, step_names}` in plain text with each gathering. The server keeps it in `gatherings.telegram_plain` until Gone and deletes it with the row. The photo for the post goes from memory to `sendPhoto` and is not stored.
2. **The link with its key is posted on the buttons,** so Telegram, and our server while the gathering is live, could read that group's sealed data. The app says this before the bot is added, and the privacy page lists it as a limit.
3. **No free text.** The bot never parses, stores or logs message text. "Add a condition" opens the link page through a personal bind link; any other private message gets the link back and is dropped. Conditions are always made by the phone's rules parser and read back.
4. **Private replies** by `answerCallbackQuery` (always shown only to the tapper); an ephemeral group message (Bot API 10.2) as a bonus because its delivery isn't guaranteed (lab 03).
5. **One message per gathering, edited.** A new notifying message only when it lights or shrinks. Deleted at Gone with `deleteMessages` (BR-D-3).
6. **Pushes for link groups stay sealed** (ADR-0014); this exception covers the Telegram channel only.

## Consequences
- Copy changes in this phase: `bot.dm.condAsk`, `bot.dm.condExample`, `bot.dm.condPrivacy`, `bot.dm.yesBtn` and `bot.dm.saved` (the bot-side condition dialogue) are replaced by `bot.dm.link` and `bot.post.condition`; the privacy text no longer says conditions pass through Telegram, and gains the Telegram link limit.
- A Telegram member made by a tap has no sealed name; others see "A Telegram friend" until that person opens their personal link and picks a name.
- `with(...)` conditions naming a Telegram-only member are not possible until they bind a phone.
