# Integrations progress

Branch `wp/integrations`. Brief: docs/engineering/briefs/6d-integrations.md.

## Status: DONE (Sat 2026-10-10)
Handoff: docs/handoffs/06d-integrations.md. Docs: docs/integrations/. Bugs: docs/engineering/bugs/integrations.md.

## Done (committed and pushed)
- Telegram bot (INT2), phone routes, `mountTelegramOff`; 45 tests.
- Web Push sender (INT1); 6 tests.
- Link previews; 11 tests.
- Plain text additions; 16 tests (was 8).
- telegram:webhook and telegram:status (INT3); deploy:render (BE10); 11 tests.
- Full flow test.
- `npm run ci` green after merging main at 97fcf86: 329 tests.

## Exact next step
None in this package. Waiting on: BE implements the ports in docs/integrations/wiring.md; the lead wires the mounts at integration; the founder approves deploy and setWebhook.
