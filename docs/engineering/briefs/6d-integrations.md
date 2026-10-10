# Brief 6d: Integrations engineer

Branch `wp/integrations`. Ports 8820 to 8829. Handoff: docs/handoffs/06d-integrations.md.

You're an integrations engineer with 10 years building chat bots and messaging features. Own every way a Flare reaches people outside the app.

## Own
`apps/server/src/telegram/**`, `apps/server/src/push/**`, `apps/server/src/preview/**`, their tests under `apps/server/test/integrations/**`, `scripts/telegram-*.ts`, `scripts/deploy-render.ts` (BE10: dry run only), `docs/integrations/**`, notes `integrations-progress.md`, bugs `integrations.md`. The plain-text format already exists in packages/shared/src/plaintext.ts (you own it now: extend, keep its tests).

## Build (WPs INT1 to INT3, BE10, preview)
- Telegram bot per docs/architecture/contracts/telegram.md: webhook with secret header, allow-list and leaveChat, /start {token} chat linking, `y:` taps with answerCallbackQuery, `c:` taps opening the link page via the bind flow, free text dropped unread with the link sent back (founder decision; ADR-0013), one message per Flare with coalesced count edits, Lit and Ember posts, cleanup with deleteMessages. Export `mountTelegram(app, deps)`; deps per BE's handoff, and until then define the narrow interface you need in your module and fake it in tests.
- Tested locally against a fake Bot API (node:http) that records calls. No real Telegram calls. The live test in "Flare test" runs Sunday from lab/ (docs/engineering/05-device-checklist.md), before any setWebhook. Provide `npm run telegram:webhook` and `telegram:status`, both refusing to run without `--yes` and printing a dry run otherwise.
- Web Push sender (web-push 3.6.7, VAPID from env, payload per asyncapi `push`, delete subscription on 404/410). Export `createPush(deps)`.
- Share links for iMessage and WhatsApp: `mountPreview(app, deps)` serving the SPA shell for `/g/{id}` with Open Graph and Twitter tags per ADR-0017 (brand card `og-image-1200x630.png`, "A Flare from a friend", count only). Test what iMessage's and WhatsApp's crawlers read (user agents, tag sizes, image size and type).
- Plain-text SMS and satellite format: encoder, reply parser and tests (exists; add any missing cases from docs/architecture/contracts/plain-text.md).
- Render deploy script (dry run; `--yes` required; masks values) per docs/architecture/01-system-architecture.md section 6.

## Deliver, all finished
The bot complete and tested; previews; plain text; bot command reference and message flow docs (docs/integrations/).

Done = a Flare can be sent, answered and finished through Telegram, iMessage links and plain text (proved with the fake Bot API and a server test flow).
