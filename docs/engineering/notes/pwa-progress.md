# PWA and offline progress (wp/pwa)

## Done
- Branch wp/pwa; merged origin/main (build order). Added idb 8.0.4 and fake-indexeddb 6.2.5 (dev) to apps/web.

## Design decisions so far
- Store keeps the key fragment (base64url raw key) next to the non-extractable CryptoKey: a group's later Flares need the key for their links, and placeHash needs HKDF from the raw key.
- Outbox snapshots `Authorization` per item at enqueue, so a queued forget still authenticates after the group record is gone.
- Push copy: a small JSON copied from the deck's push.* keys, with a test that fails on drift (the whole deck is 85 KB).
- Root vitest.config.ts doesn't include apps/web/test; tests run with `npx vitest run --config apps/web/test/pwa/vitest.config.ts`; change request for the root include line.

## In progress
- PW1 crypto (apps/web/src/lib/crypto/index.ts) and tests.

## Next step
Write crypto, store, outbox, live (field-test path), then service worker push, permissions, then manifest, icons, splash, e2e, docs, handoff.
