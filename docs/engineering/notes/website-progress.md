# Website progress (wp/website)

Tests: `npx vitest run --config apps/web/test/site/vitest.config.ts` (root config lacks apps/web/test; change request).

## Done
- Prototype lib copied verbatim into apps/web/src/lib (components, copy, motion, styles, generated tokens and icons, brand.ts, sample.ts) plus static/brand and static/sounds; 3 Biome error fixes. FE's versions win at merge.
- FE6: apps/web/src/routes/app/(more)/ more.ts (Hot spots rank/merge/load, Sparks history line, Forget, needs), wire.ts (finds PWA store/crypto by shape via import.meta.glob), pages /app/hotspots/, /app/needs/, /app/forget/ (all take ?g=), HistoryLine.svelte for FE's I1/P4. 20 tests.
- Copy keys added: more.noGroup, forget.failed (both decks).

## In progress
- FE7 accessibility pass (axe across app screens), then the website.

## Next step
- scripts or test for axe: build, serve build on port 8880, run axe-core via playwright-core Chrome on every route.
