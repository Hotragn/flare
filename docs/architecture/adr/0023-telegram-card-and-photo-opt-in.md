# ADR-0023: Telegram posts show a branded card; real photos only on a group opt-in

Status: Accepted (founder decision, Sun 2026-10-11 ~06:40 ET). Amends ADR-0013 (Telegram groups) and contracts/telegram.md section 3.

## Context
ADR-0013 posted the Flare photo to Telegram when the host's phone sent it, else plain text. The phone never sent it, so every post was text. The founder wants Telegram to look like Flare, and wants the real photo there only when a group chooses it, because a Telegram post is the one place a Flare's content leaves our encryption.

## Decision
- **Default: a branded card.** The bot posts a 1200x800 PNG rendered on the server in memory (`apps/server/src/telegram/card.ts`): the flame for the state (Kindling grows with the count, Lit with the gold dot, Ember's dome, Gone's smoke), the six words, the place label the caption already shows, and the count line. No host or member names, no real photo, no location beyond the place label. The caption and buttons are unchanged (telegram.md 3).
- **The card follows the state.** Every edit of a card post is `editMessageMedia` with a newly drawn card and the new caption: count changes, Lit, Ember, Smaller plan, and the final line. Every bot message is still deleted at Gone (telegram.md 6, BR-D-3).
- **Real photo: per group, off by default.** `groups.telegram_photos` (migration 0004), set from the phone's "Post in Telegram" screen through `PUT /groups/{id}/telegram-settings`. Only when it is on does the host's phone send the Flare's 768 px JPEG with `PUT /gatherings/{id}/telegram-photo`. The server uploads it with `sendPhoto` from memory, zero-fills the buffer and keeps nothing. With it off, that route answers 409 and the bot does not wait for a photo. A real-photo post edits only its caption.
- **Disclosure, in three places:** the setting itself ("Telegram keeps a copy until the post is deleted; everyone in the group sees it."), the privacy page (`site.privacy.l.telegram`), and this ADR. Groups that use links only are unaffected.
- **Rendering stack:** `@resvg/resvg-wasm` 2.6.2 (published 2024-03, MPL-2.0; WASM, so the same on the Mac and on Render) with the website's fontsource faces. resvg reads TTF/OTF, so the WOFF 1.0 files are unpacked in memory (`woff.ts`, about 50 lines). We did not use satori: it had about a dozen releases in the three days before this decision, too new to trust for a release candidate.

## Consequences
- The card costs 15 to 60 ms of CPU per post or edit; edits stay coalesced to one per 3 s per message (telegram.md 5).
- If the card cannot be rendered, the post falls back to text with the same caption and buttons.
- After a server restart the bot does not know whether a post was a card or a photo; it then edits the caption only, which is correct for both.

## Proof
- Server tests: card PNG size, no host name in the card, state views, the app's flame geometry, WOFF conversion; photos off by default, 409 when off, card at once, card after the wait when on, edits by `editMessageMedia`, deletion at Gone (`apps/server/test/integrations/telegram*.test.ts`, 178 server tests pass).
- Real stack, phone to fake Bot API: `npm run e2e:telegram`, 14/14 (card PNG with caption and three buttons; photo on gives the host's JPEG).
