# Website

Five prerendered pages in `apps/web/src/routes/(site)/`, built from the prototype's `/site` design (docs/design/06-website.md) and the copy deck. Every string comes from `deck.json`; commands on the Run page are code.

| Path | Sections | Source |
| --- | --- | --- |
| `/` | W1 hero, W2 steps, W3 shrink, short W4 to W6 with links | prototype `/site` |
| `/how/` | W2 and W3 in full | prototype `/site` |
| `/privacy/` | Promises, live deletion audit, what we keep (8 rows), the limits | docs/content/04, variant B |
| `/accessibility/` | Features, target, what we tested, known gaps, why benches, feedback | docs/content/05 |
| `/run/` | Setup steps | README "Run it yourself" |

## Files

| File | What it does |
| --- | --- |
| `+layout.svelte` | Skip link, sticky nav (links from 900 px), "Open Flare", footer nav; preloads 3 font files; sets `data-flame="css"` so site flames use the CSS renderer |
| `+layout.ts` | `prerender = true` |
| `site.css` | All website styles, scoped under `.site` |
| `Seo.svelte`, `seo.ts` | Title, description, canonical, Open Graph, Twitter card, JSON-LD `SoftwareApplication` on `/` |
| `audit.ts` | `GET /api/v1/audit` with a 5 s timeout, zod check; any failure gives "down" and the page keeps the static audit text |
| `reveal.ts` | 12 px rise and fade as a section scrolls in, once; skipped under reduced motion and for anything already on screen |
| `Steps.svelte`, `Shrink.svelte` | W2 and W3, shared by `/` and `/how/` |
| `apps/web/static/robots.txt`, `sitemap.xml` | Crawl rules (app, link pages and kits disallowed) and the 5 URLs |
| `apps/web/static/site/` | OG image (from brand/export/social, 1200 x 630) and the paper grain as WebP |

The origin in canonical and OG tags is `https://flare-outside.onrender.com` (openapi.yaml `servers`). Set `SITE_ORIGIN` at build time to change it; update `robots.txt` and `sitemap.xml` to match (a test checks they agree).

## Decisions

- **100 in all four categories (Sun 2026-10-11).** Median of 3 runs on 5 pages, mobile and desktop: 100 everywhere; 26 of 30 mobile runs scored 100, 4 scored 99. What moved mobile performance from 96 to 98 up to 100, with the look and motion unchanged:
  - No `modulepreload` links on website pages, and the boot script imports SvelteKit after the first frame (`apps/web/src/hooks.server.ts`). Before, about 100 KB of JS requests started before the first paint, and the mobile simulation counted all of them. Hydration now follows one frame later; the server's CSP hashes the edited inline script.
  - Paper grain as a 128 px WebP tile, 10 KB instead of 45 KB, cut from the same noise (before and after screenshots match).
  - `/ai/` is an app page kept out of search on purpose (robots.txt), so it is not in this run.
- **CSS flames on the site.** With WebGL flames, Lighthouse mobile scored 59 on `/`: 2,640 ms of blocking time from shaders running in software. The CSS renderer has the same shape and motion (docs/design/motion.md section 2). The flag is cleared when the visitor leaves for the app.
- **Inline CSS** (`inlineStyleThreshold: 16384` in apps/web/vite.config.ts): 6 render-blocking stylesheets cost about 300 ms each on simulated 4G. CSP allows inline styles (`style-src 'self' 'unsafe-inline'`).
- **WebP paper grain**: 45 KB instead of 121 KB; it was the LCP element on `/how/`.
- **Limits on the privacy page**: the deck has 9 limit strings; `l.coordsA` and `l.coordsB` are alternatives, so variant B shows 8.
- **"Open Flare" instead of "Try the prototype"**: the app is real now, so the hero button goes to `/app/`. New key `site.nav.open`.

## Checks

| Command | What it proves |
| --- | --- |
| `npx vitest run --config apps/web/test/site/vitest.config.ts` | 26 tests: audit fails soft, the 5 pages have titles and descriptions, sitemap matches, JSON-LD, plus the FE6 tests |
| `npm run build && node scripts/lighthouse.ts` | Lighthouse 13.5.0 on 5 pages, mobile and desktop, 3 runs each (median kept, every run listed); fails below 100. Reports in [lighthouse/](lighthouse/), numbers in [lighthouse/summary.json](lighthouse/summary.json) |
| `node apps/web/test/site/a11y.ts --out docs/website/evidence/a11y.json` | axe-core 4.14.0 and 44 px targets on every built page (FE7) |
| `node apps/web/test/site/shots.ts docs/website/screens` | Full-page screenshots at 390 and 1440 px; fails on sideways scroll |

The Lighthouse run serves `apps/web/build` from a small static server (`apps/web/test/site/serve.ts`, gzip, immutable caching like production) and answers `/api/v1/audit` with a passing audit, so the privacy page renders its live table.
