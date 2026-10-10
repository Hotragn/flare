# Resume note

Updated: Sat 2026-10-10, before the usage-limit pause (reset 3:50 PM ET).

## Done (committed)
- Research scan (docs/research/00), product docs v1.1 with CR-1 (docs/product/), analyst specs (docs/requirements/, trace.py passes), architect open questions OQ-1 and OQ-2 (handoff 02), brand (brand/, docs/brand/, handoff 03).
- brand/tools refactor: shared geometry and text code moved to brand/tools/shared.mjs; build.mjs imports it; `npm run build` still produces all assets.

## In progress: brand share-image fix (founder feedback, Oct 10)
Founder asked for:
1. 2 or 3 directions for the DEV cover (1000 x 420): an illustrated golden-hour outdoor scene (horizon, maple leaves, bench or path) with the flame states living in the scene, visible paper grain, a tighter and bigger tagline.
2. Pick the strongest and apply it to the OG image (1200 x 630).
3. Check the app icon at 60 and 120 px next to real iOS icons; make sure the gold dot doesn't turn to mush.
4. Small fix, then update handoff 03 and commit.

Planned directions: A "Golden hour" illustrated scene; B "Cut paper" layered hills on birch; C "Bold type" maple field with a huge tagline. Script: brand/tools/covers.mjs (to write), output to brand/export/social/directions/.

## Next role after that: product designer (UI/UX)
Full brief is in the founder's message (Oct 10). Deliverables go in design/ and docs/design/: design brief and UX scan, flows and IA (Flare and Plan), wireframes, hi-fi screens in real code (design/prototype/) for every state in light, dark and sun mode with PNG exports, clickable prototype of the key moments, website design (mobile and desktop), design system tokens (CSS + JSON) and components, accessibility annotations, then handoff 04 for motion and copy.

Stack research done: svelte 5.57.2, @sveltejs/kit 3.0.1, vite 8.3.4, bits-ui 2.19.5 (accessible headless primitives), playwright-core 1.64.0 using the installed Google Chrome for screenshots (no browser download). Alternative considered: react 19.3.0 + react-aria-components 1.22.1. Leaning Svelte + Bits UI because SRS-PERF-2 caps link-page JS at 150 KB gzipped. Architect confirms in a decision record.

## Exact next step (superseded below)
Write brand/tools/covers.mjs with the three directions, render them, review the PNGs, pick one.

## Update: brand share-image fix DONE (committed)
Golden-hour direction shipped to DEV cover and OG; icon fixed after the home-screen check.

## Product design: in progress
Done: docs/design/01-brief-and-ux-scan.md, 02-flows-and-ia.md (screen ids H1..H6, I0..I12, P1..P7, O0..O8, W1..W6); design/system/build-tokens.mjs -> tokens.css/json; design/prototype scaffold (SvelteKit 3.0.1, Svelte 5.57.2, Vite 8.3.4, Bits UI 2.19.5, TS 6.0.3, overrides fix BUG-007, 0 vulns).
Lab inputs (Oct 10): photo AI runs on the hub (gemma4:e4b, ~3.0 s per photo), no in-browser vision on iPhone; design the draft as arriving in ~3 s, typed six-word fallback when the hub is unreachable. Flame: lab recommends a 1.9 KB WebGL shader with CSS fallback (prototype uses SVG/CSS; note for engineering). Fairlane pack 6.7 KB.
Remaining: src/lib/styles/app.css, components (Flame, Button, Icon, PhotoPrint, TypeWords, NeedCount, AccessLine, NatureLine, Sheet, TextField, QuorumToggle, Banner, Compass, StepLadder, ListRow, TopBar, Screen), screens registry + one component per screen id, routes (/screens, /screens/[id], /proto, /components, /site), scripts/export.mjs (playwright-core + Chrome: hi-fi PNGs per screen/state/theme, wireframes via data-wire), scripts/a11y.mjs (axe-core), docs/design/03..07, handoff 04 (motion and copy).

## Progress (product design)
- Components done: Flame, Button, Icon, PhotoPrint, TypeWords, NeedCount, InfoLines, Screen (with overlay slot), Sheet (Bits Dialog + inline), TextField, Choice (Bits ToggleGroup), Compass, Ladder, SampleScene. sample.ts holds shared copy and data.
- Screens done: H1 to H6 (src/lib/screens), registry.ts, /screens/[id] route, /screens/manifest.json, scripts/export.mjs (44 PNGs + 6 wireframes, 0 page errors), scripts/contact.mjs, scripts/shot.mjs.
- Gotchas: screen prop is `view`, not `state` (clashes with $state rune); imports use #lib/...ts with extension (BUG-008).

## Progress update (latest)
- Hearth (flame + ground + sparks + horizon) and Scenery (golden-hour scene) components done; used on H4, H5, H6, I4, I6, I8, I9, I10, I12.
- Invitee screens I0 to I12 written and registered; `npm run check` 0 errors; export run: 91 screens + 16 wireframes, 0 page errors.
- Contact sheet of invitee screens rendered to the scratchpad but NOT yet reviewed visually.

## Progress update (latest)
- All 33 screens done and registered (H1-H6, I0-I12, P1-P7, O0, O1, O2, O4, O5, O6, O8). Full export: 189 hi-fi PNGs + 33 wireframes, 0 page errors, svelte-check 0/0.
- Founder feedback folded in: FlameMeter (live flame + count) on I1, H2, I9, P4; Spark history line on the invite; compass uses the pin-flame pointer, tightening distance rings, facing glow; stronger UI grain (static/brand/paper-grain-ui-256.png).

## Product design: DONE
Handoff: docs/handoffs/04-product-design.md. All checks pass (svelte-check 0/0, axe 0 violations on 193 targets, focus audit 0 small targets, copy lint 0 problems, JS 51 KB gz).

## Exact next step now
Wait for the founder's review of handoff 04 and the next role (motion and sound, then copy).
