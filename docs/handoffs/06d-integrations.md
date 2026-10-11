# Handoff 06d: Integrations

From: Integrations engineer. Date: Sat 2026-10-10. Branch `wp/integrations` (pushed). Next: the lead merges after backend; BE wires the ports in [docs/integrations/wiring.md](../integrations/wiring.md).

## Built

| Package | What | Code | Tests |
| --- | --- | --- | --- |
| INT2 | Telegram bot: webhook with constant-time secret check, allow-list and `leaveChat`, `/start {token}` linking (15 min, single use, hash only), `y:` taps with `answerCallbackQuery`, `c:` taps through bind tokens (10 min), free text dropped unread with the link sent back, one post per Flare (photo from memory or text after 15 s), count edits coalesced to 1 per 3 s, Lit, Ember, Smaller, final line, `deleteMessages` cleanup with 3 retries over 2 min, update idempotency `tg:{update_id}`, 429 back-off, restart recovery (`resume()`) | apps/server/src/telegram/ | telegram.test.ts 39, telegram-units.test.ts 6 |
| INT2 (phone side) | `POST /groups/{id}/telegram-link`, `POST /gatherings/{id}/telegram-bind` (moves the Telegram yes onto the phone's member, BR-ID-5), `PUT /gatherings/{id}/telegram-photo` (zero-filled, never stored); 503 `not_configured` when the bot is off | telegram/index.ts | in telegram.test.ts |
| INT1 | Web Push sender: web-push 3.6.7, VAPID, payload per asyncapi `push`, TTL 600, urgency high for lit and plan_on, 4 KB guard, delete subscription on 404/410 | apps/server/src/push/ | push.test.ts 6 |
| Preview (BE8 part) | `/g/{id}` SPA shell with safe Open Graph and Twitter tags (ADR-0017), brand card as a 93 KB JPEG at `/og/flare-card-1200x630.jpg` | apps/server/src/preview/ | preview.test.ts 11 |
| Plain text | `plainTime` (rule 4), `capBytes`, host name capped by bytes; 8 new contract cases | packages/shared/src/plaintext.ts | plaintext.test.ts 16 (was 8) |
| INT3 | `npm run telegram:webhook`, `npm run telegram:status` (also `-w apps/server`): dry run without `--yes`, token and secret hidden, refuses a bad setup | scripts/telegram-*.ts | telegram-scripts.test.ts 6 |
| BE10 | `npm run deploy:render`: offline dry run; `--yes` finds or creates Postgres, web service and the 5-minute sweep cron in Ohio, sets env, deploys | scripts/deploy-render.ts | deploy-render.test.ts 5 |
| Done check | One Flare sent, answered and finished through Telegram, the iMessage link and plain text, on the real schema | | flow.test.ts 1 |

Docs: [docs/integrations/](../integrations/README.md): bot command reference, message flow (sequence diagram), push, previews, plain text, operations, wiring. Bugs: [docs/engineering/bugs/integrations.md](../engineering/bugs/integrations.md) (BUG-INT-1 to -4).

## Proof

| Check | Result |
| --- | --- |
| `npm run ci` on the branch, merged with main at 97fcf86 | secret scan 593 files, 6 local values checked, 0 findings; lint and types clean; **329 tests** in 34 files pass; contracts ok; build ok; web JS 68.9 KB of 150; 38 diagrams render |
| Integrations tests | 74 in 7 files, 5 s for the bot file alone (was 72 s before the shared database) |
| Real Telegram calls in tests | 0. Every call goes to the fake Bot API (`node:http`, records calls). No `setWebhook` was run |
| Log privacy | A full flow with every log level captured holds no text, host name, place, chat id, user id or gathering id |
| Push | 2 of 2 lit pushes decrypted per RFC 8291 to the contract shape; VAPID JWT signature, `aud` and `sub` verified; largest `notice_ct` (2,800) fits under 3,993 bytes |
| Previews | Same tags for the iMessage, WhatsApp and Telegram user agents; tags in the first 4 KB of a 30 KB shell; card 1200 x 630, 92,803 bytes, under WhatsApp's 300 KB |
| Callback data | `y:{uuid}` 38 bytes (cap 64); deep-link payload 24 characters (cap 64) |
| Copy lint | 585 strings, 0 problems |
| Dry runs with the real .env | `deploy:render` shows only set/missing; `telegram:webhook` lists 3 problems (local http base URL, no webhook secret, empty allow-list) and sends nothing |

## Decisions inside the package

1. **Private yes message.** On a counted yes the bot tries a private [bot.dm.yes] message. If Telegram answers 403 the user never started the bot, and the tap answer is [bot.cb.yesNoChat]. No table records who started the bot.
2. **Every bot message is deleted at Gone,** private ones too: their ids go in `bot_messages` with the user's chat id, and cleanup sends one `deleteMessages` per chat.
3. **Final line stays 20 s, then delete.** The ids are read and the rows dropped at once, so the sweeper (60 s after Gone) can delete the gathering first without losing the delete.
4. **Photo wait 15 s.** No photo within 15 s of `created()`: the post goes out as text. A photo after that gets 409.
5. **Post kind after restart.** Unknown after a restart; the first edit tries the caption and falls back to text on a 400.
6. **Bonus ephemeral group link** for `c:` taps (Bot API 10.2) is not sent: delivery is not guaranteed and the `answerCallbackQuery` URL already opens the private chat.
7. **Push over fetch.** web-push encrypts and signs (`generateRequestDetails`); `fetch` sends (BUG-INT-1).
8. **Preview card is a JPEG** made from the brand PNG (740 KB PNG is over WhatsApp's limit).
9. **Deploy base URL.** When `.env` has a local http `PUBLIC_BASE_URL`, the deploy sets the service's own `https://...onrender.com` URL.

## Interface change requests

- **ICR-INT-1 (additive, openapi.yaml, endpoints INT owns, applied):** `503 Unavailable` added to `telegramWebhook`, `bindTelegram` and `putTelegramPhoto`, for a server with no bot token (`mountTelegramOff`). `npm run contracts` passes.
- **ICR-INT-2 (BE, no ICD file change):** BE implements four ports for `mountTelegram` (`yes`, `view`, `member`, `me`) and one for `mountPreview` (`need`), forwards `telegram` and `push` effects, and calls `bot.created(id)` after a Telegram Flare commits. Exact signatures and semantics: [wiring.md](../integrations/wiring.md).
- **Note for BE (no change asked):** `push_subscriptions` has no `expires_at`; it is removed by cascade with the member. The telegram-photo PUT is not replayed by Idempotency-Key: a repeat gets 409, which the contract allows.

## Copy keys added (deck.json, add only)

- `bot.post.smaller`: "Smaller plan: {step}." (group post after a Plan steps down)
- `bot.cb.closed`: "This Flare is closed." (tap reply after Lit or Gone)

Also used from the deck: `bot.*`, `invite.yes`, `invite.condition`, `lit.notice`, `lit.find`, `gone.title`, `outside.thanks`, `push.ember`, `push.planOn`, `og.link.safe.title`, `og.link.safe.desc`.

## Not done, and why

- **BE9** (`npm run kpi`, `npm run audit:logs`): not in my brief's build list; Backend's brief says BE builds both because they read BE's tables.
- **Wiring into `createApp`:** BE owns app.ts and main.ts; the url-map says the lead wires INT's mounts at integration. Wiring is copy-paste from [wiring.md](../integrations/wiring.md).
- **Live Telegram test and `setWebhook`:** wait for the device checklist and the founder, as the brief says. Before `telegram:webhook -- --yes`, add `TELEGRAM_WEBHOOK_SECRET` and `TELEGRAM_ALLOWED_CHAT_IDS` to `.env` (both are missing now).

## For the next person

- Hono builds its router on the first request: mount every INT module before serving (BUG-INT-4).
- Multipart turns `\n` into `\r\n` in the photo caption (WHATWG form data); Telegram shows both as a line break.
- One of two `npm run ci` runs failed on the engine's timing test B14 (p99 over 5 ms with other agents loading the Mac); the rerun passed. Not an integrations test; reported for the engine owner.
- Tests share one PGlite per file; a world empties it with `delete from groups`, which cascades.
