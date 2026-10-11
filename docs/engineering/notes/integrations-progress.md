# Integrations progress

Branch `wp/integrations`. Brief: docs/engineering/briefs/6d-integrations.md.

## Done (committed and pushed)
- Telegram bot: apps/server/src/telegram/ (api.ts client, copy.ts deck loader, store.ts SQL, render.ts, bot.ts, index.ts `mountTelegram`). Tests: apps/server/test/integrations/telegram.test.ts (39) against the fake Bot API (fakes/bot-api.ts) and PGlite.
- Link previews: apps/server/src/preview/ (`mountPreview`, brand card JPEG 93 KB). Tests: preview.test.ts (11).
- Plain text: `plainTime`, `capBytes`, host byte cap in packages/shared/src/plaintext.ts; 8 new contract tests.
- Full flow test: flow.test.ts (Telegram + link preview + plain text, create to delete).
- Web Push sender: apps/server/src/push/ (`createPush`, `vapidFromEnv`), web-push 3.6.7. Tests: push.test.ts (6), payload decrypted per RFC 8291, VAPID JWT verified.
- Copy keys added: bot.post.smaller, bot.cb.closed.

## Exact next step
scripts/telegram-webhook.ts and scripts/telegram-status.ts (dry run without --yes, token masked), root npm scripts, then scripts/deploy-render.ts (dry run only), then docs/integrations/, bugs file, handoff 06d, `npm run ci`.
