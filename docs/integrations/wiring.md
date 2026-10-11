# Wiring: how the server uses these modules

For Backend and the lead at integration. Nothing here changes an ICD file; the ports below are what INT needs from BE, typed in `apps/server/src/telegram/bot.ts`, `telegram/index.ts` and `preview/index.ts`.

## In `createApp`

Mount before the static `app.get("*")` route, and before the first request: Hono builds its router on the first request and then refuses new routes.

```ts
import { mountTelegram, mountTelegramOff, telegramEnv } from "./telegram/index.ts";
import { mountPreview } from "./preview/index.ts";
import { createPush, vapidFromEnv } from "./push/index.ts";

const tg = telegramEnv(); // null unless token, secret and username are valid
const bot = tg && db ? mountTelegram(app, { db, ...tg, yes, view, member, me }) : null;
if (!bot) mountTelegramOff(app); // same four routes answer 503 not_configured
mountPreview(app, { need, publicBaseUrl: env.publicBaseUrl, webBuildDir });
const vapid = vapidFromEnv();
const push = vapid && db ? createPush({ db, vapid }) : null;
```

After start: `await bot?.resume()` (posts Telegram Flares that never got a post). On shutdown: `bot?.close()`.

## Ports BE implements

| Port | Called when | Must do | Returns |
| --- | --- | --- | --- |
| `yes(gatheringId, memberId)` | Someone taps I'm in | Engine event `answer` with `answer: "yes"`, `rules: []`, `ember_only: false`, inside a transaction; run effects after commit | `"counted"`, `"already"` (member already said yes), `"closed"` (wrong state, group full, any engine error) |
| `view(gatheringId)` | Every post render | `engine.view` | `{ need, until: next_change_at }`, or null when missing or Gone |
| `member(authorization)` | The three phone routes | Check `Bearer {memberId}.{writeToken}` against the hash | `{ memberId, groupId }` or null |
| `me(gatheringId, memberId)` | telegram-bind answers 200 | The `Me` body | `Me` |
| `need(gatheringId)` (preview) | `/g/{id}` | `engine.view(...).need` | number, or null when missing or Gone |

## Effects BE forwards

| Engine effect | Call |
| --- | --- |
| `{type: "telegram", action}` | `bot.effect(gatheringId, action)` (`edit_count`, `lit`, `ember`, `smaller`, `final`). Returns at once; the bot queues the work |
| `{type: "push", event, to, label?, step?}` | `push.notify(gatheringId, effect)` |
| createGathering committed for a group with `channel = 'telegram'` and a `telegram` object | `bot.created(gatheringId)`: posts text after 15 s unless the photo arrives |

`final` must be sent when the gathering turns Gone, before the sweeper deletes the row (60 s later). The bot reads the message ids at once and deletes them 20 s later, holding the ids in memory.

## Tables INT reads and writes (migration 0001, no new tables)

`groups.telegram_chat_id` and `channel`; `members` rows with `via = 'telegram'`; `telegram_links`; `telegram_binds`; `bot_messages`; `idempotency` keys `tg:{update_id}` and `{memberId}:{Idempotency-Key}`; `push_subscriptions` (delete on 404/410); `responses` (only in telegram-bind, to move a yes onto the phone's member).

Each write is one SQL statement, so it is safe on a connection pool without a transaction.
