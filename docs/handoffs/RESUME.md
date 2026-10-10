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

## Exact next step now
Start the product designer role: write docs/design/01-brief-and-ux-scan.md, then scaffold design/prototype (SvelteKit + Bits UI + brand tokens).
