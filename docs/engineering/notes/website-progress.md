# Website progress (wp/website)

Tests: `npx vitest run --config apps/web/test/site/vitest.config.ts` (26). Browser: `npm run build && node apps/web/test/site/fe6-e2e.ts` (13 checks, real PWA store and crypto), `node apps/web/test/site/a11y.ts`, `node scripts/lighthouse.ts`, `node apps/web/test/site/shots.ts`.

## Done
- FE6 screens /app/hotspots/, /app/needs/, /app/forget/ (take ?g=), HistoryLine.svelte, more.ts, wire.ts. E2E passes with PWA's modules from main.
- FE7 axe + 44 px pass: 48 page views, 0 serious or critical outside /check/ (BUG-WEB-1 for /check/).
- Website: /, /how/ (with the Gemma attribution), /privacy/ (live audit, fails soft), /accessibility/, /run/; SEO, OG, JSON-LD, robots, sitemap; docs/website/README.md.
- Branch now carries frontend's versions of the shared lib (components, copy loader, motion, styles, vite.config) plus `inlineStyleThreshold: 16384`; deck = frontend's deck + my 32 keys.
- Lighthouse with the prototype lib: lowest 98 (all 10 runs). With frontend's lib (last run, reports committed): mobile `/` performance 61, every other score 98 to 100.

## Exact next step
- Find why mobile `/` dropped to 61 with frontend's components: run `node /path/lhm.mjs docs/website/lighthouse/mobile-home.html` style check (bootup-time, TBT). Likely suspects: frontend's root +layout.svelte or Flame/Scenery changes starting WebGL or a rAF loop on the hero despite `data-flame="css"`. Fix inside (site) only, rerun `node scripts/lighthouse.ts` until lowest >= 95, commit the reports.
- Then write docs/handoffs/07c-website.md (drafted content: see final report to the lead).
