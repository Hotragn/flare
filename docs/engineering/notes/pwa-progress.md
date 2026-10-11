# PWA and offline progress (wp/pwa)

## Done
- Branch wp/pwa; merged origin/main (build order). Added idb 8.0.4 and fake-indexeddb 6.2.5 (dev) to apps/web.

## Design decisions so far
- Store keeps the key fragment (base64url raw key) next to the non-extractable CryptoKey: a group's later Flares need the key for their links, and placeHash needs HKDF from the raw key.
- Outbox snapshots `Authorization` per item at enqueue, so a queued forget still authenticates after the group record is gone.
- Push copy: a small JSON copied from the deck's push.* keys, with a test that fails on drift (the whole deck is 85 KB).
- Root vitest.config.ts doesn't include apps/web/test; tests run with `npx vitest run --config apps/web/test/pwa/vitest.config.ts`; change request for the root include line.

- PW1 crypto, PW2 store, PW3 outbox, PW4 live (fetch-based SSE + poll + offset): 33 unit tests pass
  (`npx -w apps/web svelte-kit sync` once, then `npx vitest run --config apps/web/test/pwa/vitest.config.ts`;
  types: `npx tsc -p apps/web/test/pwa/tsconfig.json --noEmit`).

- PW5 service worker (SvelteKit 3: `$app/manifest` + `$app/env`, `$service-worker` is removed), push notice
  builder without zod (SW 6.3 KB gz; with zod it was 31 KB), cache plan, manifest, icons, splash.
- PW6 permissions, install, push subscribe, update helpers, Telegram bind. 54 unit tests.

## In progress
- PW7 + e2e in Chrome: apps/web/test/pwa/e2e/offline.ts (harness built with vite, fake API serving the build).

## Next step
Write the e2e script, run it, write docs/pwa/test-report.md; add copy keys (app.updateReady, app.updateReload,
app.outboxDropped, install.*) to the deck and run copy-lint; docs/pwa/README.md; handoff 07b; npm run ci.
