# Integrations bugs (for the lead to merge into docs/BUGLOG.md)

## BUG-INT-1: web-push can't reach an http push endpoint in tests

- **Date:** 2026-10-10
- **Area:** Integrations (push)
- **Symptom:** `webpush.sendNotification` always opens an `https` request, so a local fake push service on `http://127.0.0.1` could not receive anything, and the RFC 8291 test could not run.
- **Cause:** web-push 3.6.7 hard-codes `https.request` (src/web-push-lib.js line 4).
- **Fix:** Use `webpush.generateRequestDetails` for encryption and the VAPID header, and send it with `fetch`. Same bytes on the wire; one HTTP client; `fetch` is injectable.
- **Proof:** push.test.ts decrypts 2 of 2 lit pushes to the contract shape and verifies the VAPID JWT; 6 of 6 tests pass.

## BUG-INT-2: the secret scan blocked a push over a fake Render key

- **Date:** 2026-10-10
- **Area:** Integrations (deploy test)
- **Symptom:** `git push` failed: `deploy-render.test.ts:15 render-api-key`.
- **Cause:** The fake key in the test started with `rnd_`, the prefix the scan treats as a live Render key.
- **Fix:** Fake key `fake-render-key-for-tests` with no live prefix.
- **Proof:** `npm run secret-scan`: 510 files, 0 findings; the push went through.

## BUG-INT-3: bot tests timed out under the full suite

- **Date:** 2026-10-10
- **Area:** Integrations (tests)
- **Symptom:** In `npm run ci`, telegram.test.ts and push.test.ts failed with "Hook timed out in 10000ms"; alone they passed.
- **Cause:** Each test made a new PGlite database (about 0.5 s alone, over 10 s with 18 test files and other agents sharing the Mac). Vitest's hook timeout is 10 s.
- **Fix:** One PGlite per test file, emptied by each world (`delete from groups`, cascades); 60 s timeouts on the hooks that create it; the coalescing test uses a 500 ms window instead of 150 ms so load can't skip it.
- **Proof:** telegram.test.ts went from 72 s to 5 s alone; `npm run ci` passes with 128 tests.

## BUG-INT-4: routes added after the first request throw

- **Date:** 2026-10-10
- **Area:** Integrations (wiring)
- **Symptom:** "Can not add a route since the matcher is already built" when the flow test mounted the preview after the first webhook call.
- **Cause:** Hono builds its router on the first request.
- **Fix:** Mount every INT module before serving (docs/integrations/wiring.md says so for BE).
- **Proof:** flow.test.ts passes with the preview mounted first.
