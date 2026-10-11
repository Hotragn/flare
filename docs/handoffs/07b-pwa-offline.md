# Handoff 07b: PWA and offline to the engineering lead and FE

From: PWA and offline engineer. Date: Sat 2026-10-10, 21:20 ET. Branch `wp/pwa`. Work packages PW1 to PW7, all done. Guide: [docs/pwa/README.md](../pwa/README.md). Test report: [docs/pwa/test-report.md](../pwa/test-report.md).

## What was built

| WP | Deliverable | Path |
| --- | --- | --- |
| PW1 | Crypto (ICD-5): 256-bit key in `#k=`, AES-256-GCM with the ADR-0008 AAD table, place hash | apps/web/src/lib/crypto/index.ts |
| PW2 | IndexedDB store `flare` v1, seven stores, Lit save (24 h), Gone cleanup, Forget, sweep | apps/web/src/lib/store/index.ts |
| PW3 | Outbox: store first, send in order, Idempotency-Key, retry, 24 h drop, triggers | apps/web/src/lib/outbox/index.ts |
| PW4 | Live: SSE read with fetch (Last-Event-ID on every connect), 30 s poll, version guard, offset, offline status | apps/web/src/lib/live/index.ts |
| PW5 | Service worker: precache shell and map pack, network-first navigations, versioned caches, update on request, sealed push, notice click | apps/web/src/service-worker.ts, apps/web/src/lib/push/{notice,cache-plan,update}.ts |
| PW5 | Manifest, 5 icons, 12 iOS splash screens from brand/export | apps/web/static/manifest.webmanifest, static/icons/, static/splash/ |
| PW6 | Permission flows (motion first in the tap, location, camera), install detection, push subscribe after a tap, Telegram `?bind=` | apps/web/src/lib/permissions/{index,install}.ts, lib/push/subscribe.ts, lib/outbox/bind.ts |
| PW7 | Saved Lit data and the airplane-mode, flaky-network test in Chrome | apps/web/test/pwa/e2e/offline.ts |

## Proof

| Command | Result |
| --- | --- |
| `npm run ci` | Exit 0: secret scan 0 findings; lint clean; svelte-check 409 files 0 errors; 52 root tests; contracts ok; build; web JS 68.9 KB of 150; 37 diagrams |
| `npx -w apps/web svelte-kit sync && npx vitest run --config apps/web/test/pwa/vitest.config.ts` | 54 tests pass (crypto 8, store 7, outbox 9, live 9, notice 7, cache plan 6, permissions 8), 3 runs in a row |
| `npx tsc -p apps/web/test/pwa/tsconfig.json --noEmit` | 0 errors |
| `npm run build && node apps/web/test/pwa/e2e/offline.ts` | 19/19 checks pass, 3 runs in a row: offline shell 25 ms; outbox 5 offline taps sent once; 20 flaky taps applied once each (13 replays served); throttled SSE change in 417 ms; sealed push readable, no-key push generic; update waits for the tap |
| Service worker size | 6,356 bytes gzipped (was 31 KB with zod, BUG-PWA-2) |
| `node design/prototype/scripts/copy-lint.mjs` | 583 strings, 0 problems |

## Interface change requests

**CR-PW1 (lead, root config): run the web tests in `npm test`.** The root vitest config doesn't include apps/web/test, so my 54 tests run only with their own config today. FE's tests will need the same line. `typecheck` already runs `svelte-kit sync` before `test` in `ci`.

```diff
--- a/vitest.config.ts
+++ b/vitest.config.ts
@@
       "apps/hub/test/**/*.test.ts",
       "scripts/test/**/*.test.ts",
+      "apps/web/test/pwa/**/*.test.ts",
     ],
```

Add a script for the browser test (root package.json):

```diff
+    "e2e:pwa": "npm run build && node apps/web/test/pwa/e2e/offline.ts",
```

**CR-PW2 (FE, apps/web/src/app.html): PWA head tags.** iOS reads these from the HTML; without them there is no manifest, no full-screen launch and no splash.

```diff
     <link rel="apple-touch-icon" href="%sveltekit.assets%/apple-touch-icon.png" />
+    <link rel="manifest" href="%sveltekit.assets%/manifest.webmanifest" />
+    <meta name="mobile-web-app-capable" content="yes" />
+    <meta name="apple-mobile-web-app-capable" content="yes" />
+    <meta name="apple-mobile-web-app-title" content="Flare" />
+    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
+    <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#16233A" />
+    <!-- 12 lines from brand/export/splash/head-tags.html (paths already match static/splash/) -->
     %sveltekit.head%
```

**CR-PW3 (FE, apps/web/vite.config.ts): fallback `200.html`** as url-map.md says (today `404.html`). The service worker tries `/200.html`, then `/404.html`, so either works offline; this only aligns with the server.

**CR-PW4 (lead, optional, additive to ICD-5):** FE needs two store methods beyond `Store`: `fragment(groupId)` (links for a group's next Flare) and `rememberGathering(gatheringId, groupId)` (lets the service worker find the key for a push). They exist on `FlareStore` already; adding them to `client.ts` would make the fake honest:

```diff
 export interface Store {
   group(groupId: string): Promise<GroupRecord | null>;
+  fragment(groupId: string): Promise<string | null>;
+  rememberGathering(gatheringId: string, groupId: string): Promise<void>;
```

No frozen type was changed on this branch.

## Copy keys added (deck.json, add only)

`app.updateReady` "New version. Reload?", `app.updateReload` "Reload", `app.outboxDropped` "Some taps didn't send.", `install.title` "Add Flare to your Home Screen?", `install.body` "It opens full screen and can buzz you when it's lit.", `install.cta` "Add to Home", `install.later` "Not now", `install.done` "Flare is on your Home Screen."

## For FE (what to call)

1. Call `outbox.start()` once at app start, and `store.sweep()` once per open.
2. After saving a group, call `store.rememberGathering(gatheringId, groupId)` for every gathering you show; the live module also records `group_id` from each view.
3. A link with no or a bad key: `importFragment` throws `MissingKeyError`; show `invite.missingKey`.
4. `outbox.send` resolves the response, `null` when queued (show `app.offlineQueued`), or rejects with `OutboxRejected { code }` (show the deck string for the code).
5. `createLive({ onStatus })`: show `app.offline` with `savedAt` when `online` is false.
6. At Lit call `store.saveLit(id, data)`; the Lit screen reads `store.lit(id)` offline.
7. Compass and push asks must be the first call in the tap handler (`askCompass()`, `enablePush(...)`).
8. On `/g/{id}/`, call `takeBindToken()` and, after join, `bindTelegram(outbox, id, token)`.
9. `watchForUpdate(() => showBanner())` and `applyUpdate()` on the Reload tap.

## Not done, and why

- **Real-device checks** (Home Screen install, splash, iOS push from the server, motion prompt) need the iPhones: device checklist on Sunday. Push from the server also needs INT1 and VAPID keys.
- **The Lit screen and compass UI in airplane mode** (rest of T-OFF-1) is FE's screen; its data layer is proven here (e2e check 9).
- **Map pack** is MAP's file; the e2e serves a stand-in at the same path. The service worker precaches the real one when it lands in apps/web/static/maps/.
- **Group time zone in push times:** the service worker formats `{time}` in the phone's zone. All four field-test phones are in America/Detroit; a group zone would need it in the payload or the notice.

## Bugs

docs/engineering/bugs/pwa.md: BUG-PWA-1 (`$service-worker` removed in SvelteKit 3), BUG-PWA-2 (zod in the worker, 31 KB), BUG-PWA-3 (web tests need `svelte-kit sync`).

## Note

`svelte-kit build` prints a `tsconfig_invalid` warning asking for `src/service-worker` in apps/web/tsconfig.json `exclude`. The entry is there; the warning has no effect on the build or svelte-check (0 errors). The tsconfig isn't mine.
