# Frontend bugs (wp/frontend)

Format as docs/BUGLOG.md: date, area, symptom, cause, fix, proof. The lead merges these.

## BUG-FE-1: Lit screen said "Your phone is full"
- Date: 2026-10-11. Area: FE3 link page, offline save at Lit (SRS-OFF-1).
- Symptom: in Chrome, every friend's Lit screen showed "Your phone is full, so offline mode is off." and nothing was saved for airplane mode.
- Cause: `store.saveLit` got the Svelte `$state` proxies of the view and the opened blob; IndexedDB's structured clone throws `DataCloneError` on a proxy, and the flow showed the storage-full line for any error.
- Fix: save `$state.snapshot(...)` copies; show `err.storageFull` only for `StorageFullError` (apps/web/src/lib/screens/flow/link.svelte.ts).
- Proof: `node apps/web/test/e2e/flow.ts 5`: 5/5 Lit with no storage line (docs/frontend/evidence/e2e-i6-lit.png).

## BUG-FE-2: a fast shutter tap did nothing
- Date: 2026-10-11. Area: FE2 camera (H1).
- Symptom: tapping the shutter within the first frames after the camera opened left the camera screen up; 1 of 5 e2e runs timed out.
- Cause: the capture read `video.videoWidth`, which is 0 until the first frame, and returned early.
- Fix: the tap waits for `loadeddata` (at most 3 s), then captures (apps/web/src/lib/screens/HostPage.svelte).
- Proof: e2e 5/5 after the fix, host open to Sent median 433 ms.

## BUG-FE-3: the photo can't go through the outbox
- Date: 2026-10-11. Area: FE2 photo upload, PWA outbox (ICD-5).
- Symptom: none yet (found reading the outbox); `PUT /gatherings/{id}/photo` would have sent the sealed bytes as a JSON object.
- Cause: the outbox stringifies every body as JSON with `Content-Type: application/json`; the contract wants `application/octet-stream`.
- Fix: the photo goes straight to fetch with the member's bearer token and its own Idempotency-Key, with one retry on a 5xx or network error (flow/host.svelte.ts). Change request CR-FE-2 asks PWA for binary items in the outbox.
- Proof: host.test.ts "SRS-CRE-6": the fake server stores a sealed body that is not a JPEG.
