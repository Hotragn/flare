# Integrations

Every way a Flare reaches people outside the app. Owner: Integrations. Code in `apps/server/src/telegram/`, `apps/server/src/push/`, `apps/server/src/preview/`, `packages/shared/src/plaintext.ts`, `scripts/telegram-*.ts`, `scripts/deploy-render.ts`. Tests in `apps/server/test/integrations/` (74 tests in 7 files) and `packages/shared/test/plaintext.test.ts` (16).

| Doc | What it covers |
| --- | --- |
| [bot-commands.md](bot-commands.md) | Every command, button and reply of `@FairlaneFlareBot`, with the copy key for each |
| [message-flow.md](message-flow.md) | One Flare from link to deletion in Telegram, with the calls the bot makes |
| [push.md](push.md) | The Web Push sender: payload, encryption, TTL, cleanup |
| [previews.md](previews.md) | What iMessage, WhatsApp and Telegram read from a `/g/{id}` link |
| [plain-text.md](plain-text.md) | The SMS and satellite line, the reply, and what the code adds to the contract |
| [operations.md](operations.md) | `telegram:webhook`, `telegram:status`, `deploy:render`, and the order to run them |
| [wiring.md](wiring.md) | How the server mounts these modules and what it must pass in |

Contracts these follow: [telegram.md](../architecture/contracts/telegram.md), [plain-text.md](../architecture/contracts/plain-text.md), asyncapi.yaml channel `push`, openapi.yaml tag `telegram`. Decisions: ADR-0012, ADR-0013, ADR-0014, ADR-0017.

## Rules the code keeps

- No real Telegram call in any test. The bot runs against a fake Bot API (`test/integrations/fakes/bot-api.ts`, a `node:http` server that records calls and answers like Telegram).
- Nothing is logged but fixed event names and counts: `tg.refused`, `tg.linked`, `tg.yes`, `tg.posted`, `tg.bound`, `tg.deleted`, `tg.delete_failed`, `tg.error`, `push.sent`. A test runs a full flow and checks the logs hold no text, name, place, chat id, user id or gathering id.
- Every string a person reads comes from the copy deck. A missing key stops the server at start.
- `setWebhook` and the Render deploy wait for the founder. Both scripts print a dry run unless given `--yes`.
