# Brief 7c: Web engineer

Branch `wp/website`. Ports 8880 to 8889 (vite 5182). Handoff: docs/handoffs/07c-website.md.

You're a web engineer with 10 years building fast, beautiful marketing sites. Build the website exactly as designed (design/prototype `/site` route, docs/design/, docs/content/).

## Own
`apps/web/src/routes/(site)/**` (or the paths `/`, `/how/`, `/privacy/`, `/accessibility/`, `/run/` per url-map.md), `apps/web/static/site/**`, `apps/web/static/robots.txt`, `apps/web/static/sitemap.xml`, `apps/web/test/site/**`, `scripts/lighthouse.ts`, `docs/website/**`, notes `website-progress.md`, bugs `website.md`. Also WPs FE6 (Sparks history line, Hot spots, Forget, needs profile screens) and FE7 (accessibility pass) moved to you in the WBS: build those screens under `apps/web/src/routes/app/(more)/**` using FE's components (import from `#lib/components`, fake them if not landed), and run the axe pass across all app screens on the integrated build.

## Build
- Every section with its motion, mobile and desktop.
- Privacy and accessibility statement pages (docs/content/04 and 05; privacy variant B; the 9 honest limits; live deletion audit from GET /api/v1/audit, failing soft).
- "Run it yourself" page from the README.
- SEO, link previews and structured data (JSON-LD SoftwareApplication; OG image from brand/export/social).
- Lighthouse 95+ in every category, with proof: install lighthouse (exact latest version) as a dev dependency, run against the built site with Chrome, save the reports.
- Docs.
