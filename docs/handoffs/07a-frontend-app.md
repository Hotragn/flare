# Handoff 07a: Frontend app

From: Frontend app engineer (stopped at the lead's request, Sun 02:10 ET), finished by the engineering lead. Date: Sun 2026-10-11.

## Built
- **FE1 shell:** prototype components, motion and sounds moved into `apps/web/src/lib/`. The copy deck, tokens and icons are read from `design/`, and a Vite plugin ships only the deck's text. `#lib/zod-csp.ts` is imported first (BUG-029). Contract error codes map to deck strings in `screens/flow/errors.ts`. Bits UI was replaced by native `<dialog>` and radios, which brought web JS from 150.9 to 129.8 KB.
- **FE3 link page `/g/{id}/`:**
  - missing-key screen; first-time join with a sealed name; optimistic "You're in."; take back; Can't make it;
  - conditions with read-back; the Ember-only offer;
  - saved Lit for offline; Ember, Gone, I'm here and Spark;
  - Plan answers with the ladder, "Short one only" and I'm fading; Telegram bind link; `rememberGathering`.
- **FE4 Lit and compass:** orientation is asked first in the tap; iOS and Chrome headings; distance and bearing; speech cadence; offline banner.
- **FE2 host `/app/`:**
  - camera first, the six-word draft with typed fallback, spot from the map pack, sealed send, photo upload, share sheet, Copy as text;
  - text yes, cancel, +1 and Done;
  - Plan times and ladder edit.
- **Added by the lead:**
  - "Ask DigitalOcean" on H2's fallback (ADR-0022);
  - one ladder label set (`ladder.template.step*`);
  - `flow.ts real` mode against the real server and hub, which also checks CSP.
- CR-PW2 (iOS head tags, splash) and CR-PW3 (`200.html` fallback) done.

## Proof
- `node apps/web/test/e2e/flow.ts 5 real`, at 390 × 844 against the real server, real hub with Gemma, real engine and the PWA modules:
  - 5/5 runs; host open to Sent median 2.7 s; link open to "You're in." median 284 ms;
  - lit on both phones; compass right; 0 page errors; 0 CSP violations.
  - Evidence: docs/frontend/evidence/flow-real.txt.
- Flow unit tests: 37/37 (`vitest --config apps/web/test/flow/vitest.config.ts`, part of `npm test`).
- Link page JS: 133.8 KB of 150 (`npm run budget`, per route).
- Bugs: docs/engineering/bugs/frontend.md (BUG-FE-1 to 3, merged into the BUGLOG).

## Not done (after the field test, per the manager)
- Component and screen catalog rewrite (`/dev/components` is still the prototype page).
- Visual regression tests, browser support matrix, budgets report, docs/frontend.
- CR-FE-2: binary bodies in the outbox. The photo uploads by direct fetch with its own Idempotency-Key.

## For the next person
- Exact next step: docs/engineering/notes/frontend-progress.md.
- The map, conditions and capabilities modules are found by path in `screens/flow/wire.ts`.
