# PWA and offline progress (wp/pwa)

## Done (all of PW1 to PW7)
- PW1 crypto, PW2 store, PW3 outbox, PW4 live, PW5 service worker + manifest + icons + splash, PW6 permissions,
  install, push subscribe, update, Telegram bind, PW7 Chrome e2e.
- 54 unit tests (`npx -w apps/web svelte-kit sync && npx vitest run --config apps/web/test/pwa/vitest.config.ts`).
- 19/19 e2e checks (`npm run build && node apps/web/test/pwa/e2e/offline.ts`), evidence in docs/pwa/evidence/.
- 8 copy keys added, copy-lint 0 problems.
- Docs: docs/pwa/README.md, docs/pwa/test-report.md; bugs docs/engineering/bugs/pwa.md; handoff docs/handoffs/07b-pwa-offline.md.
- `npm run ci` exit 0 (web JS 68.9 KB of 150).

## In progress
- Nothing.

## Next step
Wait for the lead: CR-PW1 (vitest include), CR-PW2 (app.html head tags, FE), CR-PW3 (200.html fallback, FE),
CR-PW4 (optional ICD-5 additions). On Sunday: device checklist rows for install, splash, push and motion.
