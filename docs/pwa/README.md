# Flare PWA and offline

Owner: PWA and offline (wp/pwa). Work packages PW1 to PW7. Interfaces: ICD-5 ([client.ts](../../packages/shared/src/icd/client.ts)), ADR-0008, ADR-0010, ADR-0014.

## Modules

| Path | What | ICD-5 export | Extras |
| --- | --- | --- | --- |
| `apps/web/src/lib/crypto/index.ts` | AES-256-GCM seal and open, AAD per field, key fragment, place hash | `flareCrypto: Crypto` | `aad.*` builders, `keyFromHash`, `MissingKeyError`, `OpenError`, `fragmentOf`, `linkKey`, base64url |
| `apps/web/src/lib/store/index.ts` | IndexedDB `flare` v1, seven stores (idb 8.0.4) | `createStore(): Store` | `fragment`, `rememberGathering`, `groupOf`, `saveSeen`, `gone`, conditions, tickets, `sweep`, `StorageFullError` |
| `apps/web/src/lib/outbox/index.ts` | Store first, send in order, Idempotency-Key, retry, 24 h drop | `createOutbox(): Outbox` | `start()` triggers, `OutboxRejected`, `newIdemKey` |
| `apps/web/src/lib/outbox/bind.ts` | Telegram `?bind=` link | | `takeBindToken`, `bindTelegram` |
| `apps/web/src/lib/live/index.ts` | SSE (read with fetch), 30 s poll, version guard, server-time offset | `createLive(): Live<LiveView>` | `onGone`, `onStatus` (offline banner), `offset()` |
| `apps/web/src/lib/push/notice.ts` | Push payload to notice text, opens `notice_ct` | | `buildNotice`, `isNoticeText` |
| `apps/web/src/lib/push/subscribe.ts` | Web Push subscribe after a tap | | `pushSupport`, `loadVapidKey`, `enablePush`, `refreshPush`, `disablePush` |
| `apps/web/src/lib/push/update.ts` | "New version. Reload?" | | `watchForUpdate`, `applyUpdate` |
| `apps/web/src/lib/push/cache-plan.ts` | Precache list and request routing rules | | used by the service worker |
| `apps/web/src/lib/permissions/index.ts` | Camera, location, motion (compass) | | `askMotion`, `askLocation`, `askCompass`, `askCamera`, `permissionState` |
| `apps/web/src/lib/permissions/install.ts` | Home Screen install | | `isStandalone`, `installKind`, `captureInstallPrompt`, `promptInstall` |
| `apps/web/src/service-worker.ts` | Precache, offline navigations, push, notification click, update | | |
| `apps/web/static/manifest.webmanifest`, `static/icons/`, `static/splash/` | Manifest, 5 icons, 12 iOS splash screens (from brand/export) | | |

## How the frontend uses it

```ts
import { flareCrypto, aad, keyFromHash, MissingKeyError } from "#lib/crypto/index.ts";
import { createStore } from "#lib/store/index.ts";
import { createOutbox, OutboxRejected } from "#lib/outbox/index.ts";
import { createLive } from "#lib/live/index.ts";

const store = createStore();
const outbox = createOutbox({ store, onDropped: () => toast(t("app.outboxDropped")) });
outbox.start(); // online, pageshow, visible, every 15 s
const live = createLive({ store, onStatus: (_id, s) => (offline = !s.online), onGone: showGone });

// Link page: key from the fragment; a bad key shows invite.missingKey (SRS-RES-2).
const key = await flareCrypto.importFragment(keyFromHash(location.hash) ?? "");
// After join: save the group, then tie the gathering to it (the service worker needs this for push).
await store.saveGroup({ groupId, key, memberId, token, names });
await store.rememberGathering(gatheringId, groupId);
// "I'm in": optimistic UI first, then the outbox. null = queued (show app.offlineQueued).
const res = await outbox.send({ method: "PUT", path: `/api/v1/gatherings/${gatheringId}/me`, body: { answer: "yes" } });
// At Lit: save the offline data (SRS-OFF-1).
await store.saveLit(gatheringId, { spot, target, access, host_line, nature_line, state_since });
// New Flare in an existing group: the link needs the stored fragment.
const link = `${origin}/g/${newId}/#k=${await store.fragment(groupId)}`;
```

Compass tap: call `askCompass()` as the first statement of the click handler, before any `await` (spike E3). Push tap: call `enablePush({ outbox, groupIds, vapidKey: loadVapidKey() })` directly in the handler; it calls `Notification.requestPermission()` before its first `await`.

## Decisions taken inside the packages

1. **The fragment is stored next to the non-extractable key.** A group's second Flare needs the key in its link, and the place hash needs HKDF over the raw key, which an AES-GCM `CryptoKey` can't give. Same-origin script could use the `CryptoKey` anyway, so this adds no new reader. The fragment never leaves IndexedDB except into a link or the notice-click URL (both local).
2. **Place hash:** `HMAC-SHA-256(HKDF-SHA-256(raw key, salt = empty, info = "flare place v1"), utf8(placeKey))`, base64url, 43 characters (matches `PlaceHash`).
3. **The outbox keeps `Authorization` per item.** A queued "Forget this group" still authenticates after the group record is gone. Forget deletes the group's other queued items.
4. **408 and 429 are kept like a 5xx**, not dropped like other 4xx. A rate-limited tap should still count.
5. **SSE is read with `fetch`**, not `EventSource`, so every connect (not only the browser's own retries) sends `Last-Event-ID`. The service worker never touches `/api/`.
6. **No zod in the service worker.** `isNoticeText` mirrors `NoticeText`; a test checks both agree on 12 samples. Service worker: 6.2 KB gzipped, 6,356 bytes (31 KB with zod).
7. **Push copy** is `push-copy.json`, a copy of the deck's `push.*` strings; a test fails if they drift.
8. **No skipWaiting on install.** A new version waits for the Reload tap, so code never changes mid-tap.
9. **Precache skips** splash images (iOS reads them when the app is added), the device-check kit and source maps: 28 entries on this branch.
10. **Offline navigation** tries the page, then `/200.html`, `/404.html`, `/`. Navigations go to the network first with a 4 s limit.

## iOS install and standalone mode

| Situation | What we show | Why |
| --- | --- | --- |
| Safari tab, push wanted | `perm.notify.homeScreen` + `perm.notify.homeScreenHow` ("Tap Share, then Add to Home Screen.") | iOS has no install prompt and no push in tabs |
| Home Screen app (iOS 16.4+) | `perm.notify.*` sheet, then the system prompt from the tap | Push needs a tap and the installed app |
| Chrome with `beforeinstallprompt` | `install.*` sheet, `install.cta` opens the browser prompt | Event kept by `captureInstallPrompt()` |

Detection is by feature, never by device name: `display-mode: standalone` or `navigator.standalone === true` means installed; `"standalone" in navigator` means the iOS Share route.

What changes when installed: full screen with the splash screen; push notices work; the Home Screen app has its own storage, separate from Safari's on iOS, so a group joined in Safari must be opened once from the link inside the app (the link page saves the key again).

## iOS Safari quirks we handle

- Storage: Safari can delete script-written storage after 7 days without a visit for sites not added to the Home Screen. Saved Lit data lives at most 24 h, so the risk is the group key; the link restores it.
- No Background Sync: the outbox sends on `online`, `pageshow`, visible, and every 15 s while visible.
- `DeviceOrientationEvent.requestPermission()` only prompts as the first call in a tap (spike E3).
- Every push must show a notice: `buildNotice` never throws and always returns text.
- `EventSource` can't set headers, so the live module uses `fetch` streaming, which Safari supports.

## Head tags for `app.html` (owned by FE)

See the change request in [handoff 07b](../handoffs/07b-pwa-offline.md). Tags: manifest link, `apple-mobile-web-app-capable`, status bar style, title, the apple-touch-icon at `/icons/icon-180.png`, and the 12 `apple-touch-startup-image` links from `brand/export/splash/head-tags.html`.

## Tests

- Unit (54): `npx -w apps/web svelte-kit sync`, then `npx vitest run --config apps/web/test/pwa/vitest.config.ts`. Types: `npx tsc -p apps/web/test/pwa/tsconfig.json --noEmit`.
- Chrome end to end (19 checks): `npm run build && node apps/web/test/pwa/e2e/offline.ts`. Report: [test-report.md](test-report.md).
