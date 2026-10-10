# Brief 7b: PWA and offline engineer

Branch `wp/pwa`. Ports 8870 to 8879 (vite 5181). Handoff: docs/handoffs/07b-pwa-offline.md.

You're an engineer with 10 years building offline-first PWAs, and you know every iOS Safari quirk.

## Own
`apps/web/src/lib/crypto/**`, `apps/web/src/lib/store/**`, `apps/web/src/lib/outbox/**`, `apps/web/src/lib/live/**`, `apps/web/src/lib/permissions/**`, `apps/web/src/lib/push/**`, `apps/web/src/service-worker.ts`, `apps/web/static/manifest.webmanifest`, `apps/web/static/icons/**`, `apps/web/static/splash/**`, `apps/web/test/pwa/**`, `docs/pwa/**`, notes `pwa-progress.md`, bugs `pwa.md`.

## Build (WPs PW1 to PW7)
- Manifest, icons and iOS splash screens (from brand/export).
- iOS install flow and standalone-mode behaviour (detect, explain the Home Screen step, what changes when installed).
- Service worker: precache shell and map pack, versioning, update prompt ("New version. Reload?" style copy from the deck), push handler that opens `notice_ct` with the group key from IndexedDB and falls back to generic text, notification click.
- ICD-5 modules: crypto (ADR-0008 AAD table, fragment key), store (idb 8.0.4), outbox (ADR-0010), live (SSE + 30 s poll + server-time offset).
- Permission flows for camera, location, motion/compass (orientation first in the tap, spike E3) and notifications (iOS 16.4+ web push, only after a tap, only installed).
- Test report covering airplane mode and flaky networks (Playwright offline and throttling; outbox replays exactly once).
- Docs.
