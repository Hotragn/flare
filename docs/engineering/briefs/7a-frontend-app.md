# Brief 7a: Frontend app engineer

Branch `wp/frontend`. Ports 8860 to 8869 (vite dev 5180). Handoff: docs/handoffs/07a-frontend-app.md.

You're a frontend engineer with 10 years building mobile web apps that feel native. Build the full app exactly as designed, wired to the engine, server, integrations, AI and maps modules.

## Own
`apps/web/src/routes/app/**`, `apps/web/src/routes/g/**`, `apps/web/src/lib/components/**`, `apps/web/src/lib/screens/**`, `apps/web/src/lib/copy/**`, `apps/web/src/lib/motion/**`, `apps/web/src/lib/styles/**`, `apps/web/src/routes/dev/**` (component catalog = stories), `apps/web/vite.config.ts`, `apps/web/src/app.html`, `apps/web/src/routes/+layout.*`, `apps/web/test/visual/**`, `docs/frontend/**`, notes `frontend-progress.md`, bugs `frontend.md`. Keep `#lib/zod-csp.ts` imported first in the root layout (BUG-029).

## Build (WPs FE1 to FE4, FE8; FE5 module from 6f, FE6 and FE7 screens moved to WEB per the WBS, but you own the shared components they use)
- Move the prototype (design/prototype: tokens, components, copy deck loader, motion, sounds, 33 screens) into apps/web, then wire every screen and state to real modules through the ICDs: API per openapi.yaml, phone modules ICD-5 (PWA), maps ICD-6, conditions ICD-7 and capabilities ICD-8 (6f), engine view data from the server. Use fakes typed by the ICDs until each module lands.
- URL map in docs/engineering/briefs/url-map.md (adapter-static fallback `200.html`).
- Final motion, sound (on by default, remembered mute), copy from the deck only.
- Component library with stories (catalog route /dev/components with every state in light, dark, sun).
- State management docs.
- Visual regression tests: Playwright screenshots of every screen and state at 390 × 844, compared with stored baselines (pixel diff threshold stated).
- Browser support matrix (iOS Safari on our phones, standalone mode, desktop browsers for the website).
- Performance budgets on the iPhone 13 (docs/architecture/10-performance-budgets.md): measure what you can here (Lighthouse mobile emulation, JS size, CPU-throttled Chrome) and report; device numbers come from Sunday.
- Frontend docs.
