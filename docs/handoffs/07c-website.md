# Handoff 07c: Website

From: Web engineer (stopped at the lead's request, Sun 02:10 ET); written by the engineering lead from the engineer's report. Date: Sun 2026-10-11.

## Built
- **Website** in `apps/web/src/routes/(site)/`: `/`, `/how/`, `/privacy/`, `/accessibility/`, `/run/`, all prerendered.
  - `/how/` carries the Gemma attribution.
  - `/privacy/` uses variant B, the honest limits (now including Sentry, ADR-0021, and DigitalOcean, ADR-0022) and the live `GET /api/v1/audit`, which fails soft.
  - SEO: canonical, Open Graph, Twitter, JSON-LD `SoftwareApplication`, `robots.txt` and `sitemap.xml`. The origin comes from `SITE_ORIGIN`, checked by a test.
- **FE6 screens** in `apps/web/src/routes/app/(more)/`: Hot spots (by count, then most recent; merge by max), needs profile (phone only), Forget this group (server first, then the phone), and the Sparks `HistoryLine`.
- **FE7 accessibility pass:** `apps/web/test/site/a11y.ts`, axe plus a 44 px target check, light and dark, at 390 and 1280 px.

## Proof
- Site tests: 26/26 (`vitest --config apps/web/test/site/vitest.config.ts`, part of `npm test`).
- `node apps/web/test/site/fe6-e2e.ts`: 13 checks in Chrome with the real store and crypto. Needs are kept with 0 server requests. Only place hashes are sent. Forget deletes with the member token.
- axe (lead's run, 04:00): 64 page views; 0 serious or critical findings and 0 small targets outside `/check/`.
- Lighthouse (engineer's runs): 98 to 100 on 9 of 10 page and width runs, and 100 for accessibility, best practices and SEO everywhere.

## Not done (after the field test, per the manager)
- **Mobile `/` Lighthouse performance is 61** (bar 95). It dropped after the merge onto frontend's shared components. Suspect: root layout, Flame or Scenery running WebGL or an animation loop on the home page.
  - Next step: read bootup time and blocking time in docs/website/lighthouse/mobile-home.html, fix inside `(site)/`, and rerun `node scripts/lighthouse.ts` until every score is at least 95.
- **ICRs still open:**
  - Store access to Spark delete tokens for Forget.
  - The Hot spots blob shape in `sealed.ts`.
  - Confirm Sparks are sealed as raw UTF-8 bytes.
- **No settings screen:** the design has none.

## For the next person
Exact next step: docs/engineering/notes/website-progress.md.
