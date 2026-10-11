# Web Push sender

`createPush({ db, vapid })` in `apps/server/src/push/index.ts`. `notify(gatheringId, effect)` takes the engine's push effect (`{event, to, label?, step?}`, ICD-1) and returns `{sent, removed, failed}`.

| Item | Value | Source |
| --- | --- | --- |
| Library | web-push 3.6.7 (`generateRequestDetails`), sent with `fetch` | brief INT1 |
| Encryption | RFC 8291, `Content-Encoding: aes128gcm` | asyncapi `push` |
| Signing | VAPID (RFC 8292), keys `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | env spec |
| TTL | 600 s | asyncapi `push` |
| Urgency | `high` for `lit` and `plan_on`, else `normal` | asyncapi `push` |
| Payload | `{v: 1, g, kind, event, label?, step?, at?, notice_ct?}` | asyncapi `pushNotice` |
| Size | JSON at most 3,993 bytes (4,096 minus 103 bytes of aes128gcm overhead); `notice_ct` is dropped if it would go over, and the service worker shows the fallback | Web Push limit |
| Recipients | `set`: the chosen set; `all`: every member of the group; a list: those ids, filtered to the group | ICD-1 |
| 404 or 410 | The subscription is deleted | brief INT1 |
| Other errors | Counted as `failed`; the subscription stays | |

`at` is sent for `plan_on` and `plan_ember` (the Plan start, shown as `{time}`).

## Proof

`apps/server/test/integrations/push.test.ts` (6 tests) runs a fake push service on `node:http` that decrypts each request the way a browser does (ECDH P-256, HKDF, AES-128-GCM, padding delimiter) and checks the VAPID JWT signature and audience. The decrypted body equals the contract shape. With the largest `notice_ct` the contract allows (2,800 characters) the payload is under 3,993 bytes.

`vapidFromEnv()` returns null when any VAPID setting is missing; `/config` then reports `vapid_public_key: null` and the app relies on the bot or the open page.
