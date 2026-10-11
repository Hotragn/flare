# Frontend progress (wp/frontend)

Stopped Sun 2026-10-11 at the lead's request (usage). Branch pushed; `npm run ci` parts run: lint 0 errors, typecheck 0, root tests 52, flow tests 37, build, budget 145.4 KB of 150.

## Done (field-test path)
1. FE1: prototype components, copy loader (reads design/prototype deck directly; vite plugin slims it in the bundle), motion, sounds into apps/web; tokens and icons read from design/system and brand/icons; zod-csp first in the root layout; fallback 200.html (CR-PW3); PWA head tags and 12 splash links in app.html (CR-PW2); error code to copy map (screens/flow/errors.ts).
2. FE3: /g/{id}/ link page (screens/LinkPage.svelte, flow/link.svelte.ts): missing or wrong key, join with sealed name, optimistic I'm in, take back, condition and read-back (ICD-7 parser when it lands), not-suit and Ember only, Lit (saved for offline), Can't make it, Ember, Gone, I'm here, Spark, Plans P4 to P6 (Short one only, fade), Telegram bind, rememberGathering.
3. FE4: Lit and compass (flow/compass.ts): orientation permission first in the tap, webkitCompassHeading or absolute alpha, distance and bearing, speech cadence, offline banner.
4. FE2: host flow /app/ (screens/HostPage.svelte, flow/host.svelte.ts): camera (waits for the first frame), 768 px draft from /api/v1/drafts, typed fallback, spot from the map pack or typed, sealed send, photo upload (octet-stream, direct fetch), share sheet, Copy as text (plain-text SMS form), text yes, cancel, +1, Done; Plans P1 (times, BR-P-1 to -3) and P2 (ladder edit, BR-P-4).
5. Real PWA modules wired (flow/wire.ts); Gone from the live module becomes a last view. bits-ui replaced by native dialog and radios.
6. Proof: `npx vitest run --config apps/web/test/flow/vitest.config.ts` 37/37. `npm run build && node apps/web/test/e2e/flow.ts 5` (real screens and PWA modules in Chrome, fake API): 5/5, host open to Sent median 559 ms, link open to You're in median 399 ms, lit on both phones and compass (ahead, right, one permission call inside the tap) 5/5, 0 page errors. Evidence: docs/frontend/evidence/.
7. Bugs: docs/engineering/bugs/frontend.md (BUG-FE-1 to -3).

## Left on the field-test path
- Swap in MAP (apps/web/src/lib/map/index.ts) and ODAI (conditions, capabilities) when they land: wire.ts finds them by path; nothing else to change. Without the map pack the spot is typed and there is no access line, walk time or Ember bench; without the parser "Add a condition" is hidden.
- Run e2e against the real backend once BE is on main (serve the build from the server; same screens).
- On-device: compass on the iPhones (device checklist).

## Not done (after the field-test path)
- Catalog rewrite: routes/dev/components still the prototype page; no /dev/screens stories yet (registry.ts lists screens but the screens now take real props).
- Visual regression (apps/web/test/visual), browser matrix, budgets report, docs/frontend, handoff 07a.
- Root vitest include for apps/web/test (change request CR-FE-1).

## Change requests
- CR-FE-1 (lead): add `"apps/web/test/flow/**/*.test.ts"` to root vitest.config.ts include (the flow config also needs the svelte plugin; or call `npx vitest run --config apps/web/test/flow/vitest.config.ts` from `npm test`).
- CR-FE-2 (PWA): binary bodies in the outbox (photo PUT is application/octet-stream); FE sends the photo with fetch until then.
- CR-PW4 (already raised by PWA): `fragment` and `rememberGathering` on the ICD-5 Store; FE types them in flow/deps.ts StoreExtras.

## Copy keys added (deck.json, add only; copy-lint 0 problems, 597 strings)
err.fadeUsed, err.fadeClosed, err.wrongState, err.tooLarge, err.notMember, readback.chip.minStep, ladder.stepMetaShort, place.benchNear, place.tableNear, ladder.tpl.1 to .4, member.telegramFriend.

## Exact next step
Rewrite apps/web/src/routes/dev/components/+page.svelte and add routes/dev/screens/[id] from registry.ts with story props from lib/sample.ts (each screen's props are typed in its file); then apps/web/test/visual with Playwright screenshots at 390 × 844.
