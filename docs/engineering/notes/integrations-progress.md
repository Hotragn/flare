# Integrations progress

Branch `wp/integrations`. Brief: docs/engineering/briefs/6d-integrations.md.

## Done
- Bot API client (apps/server/src/telegram/api.ts), copy loader (telegram/copy.ts), fake Bot API (apps/server/test/integrations/fakes/bot-api.ts).
- Copy keys added: bot.post.smaller, bot.cb.closed.

## In progress
- Telegram webhook and poster (telegram/store.ts, webhook.ts, poster.ts, index.ts).

## Exact next step
Write telegram/store.ts (SQL on bot tables), then webhook.ts with tests against the fake Bot API and PGlite.

## Remaining after that
Push sender (push/), preview (preview/), plain text cases, scripts telegram-webhook/status and deploy-render (dry run), docs/integrations/, handoff 06d.
