# Flare design

- Docs: [docs/design/](../docs/design/) (start with 01 and 02).
- Tokens: `system/tokens.css`, `system/tokens.json` (`node system/build-tokens.mjs`).
- Prototype and real-code screens: `prototype/` (SvelteKit 3, Svelte 5, Bits UI).
- Exports: `exports/` (screens, wireframes, pages, accessibility reports).

```bash
cd design/prototype && npm ci && npm run build && npm run preview
```

Open http://127.0.0.1:5318/proto/ for the clickable prototype. `npm run export` regenerates PNGs; `npm run a11y` runs axe-core; `node scripts/focus-audit.mjs` checks focus order and targets; `node scripts/copy-lint.mjs` checks copy limits.
