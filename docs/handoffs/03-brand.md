# Handoff 03: Brand to Product design

From: Brand designer. Date: Sat 2026-10-10. Next role: Product (UX and UI) design.

## What was delivered

| Path | Contents |
| --- | --- |
| docs/brand/01-strategy.md | Story, positioning, promise, personality, is and isn't, voice table, taglines |
| docs/brand/02-name-check.md | App Store, npm, GitHub and DEV checks with risk levels and a recommendation; raw data in docs/brand/evidence/ |
| docs/brand/03-brand-book.md | Mark, wordmark, lockups, clear space, minimum sizes, misuse, the four state marks, color system, sun mode, type, icons, illustration and texture, photography, motion and sound direction, asset index, manifest and head snippets |
| docs/brand/contrast-table.md | 22 color pairs: WCAG ratio plus outdoor ratios (bright shade, open sun) |
| brand/logo/ | 25 SVGs: 4 marks, 3 wordmarks, 6 lockups, 12 state marks (light, dark, currentColor) |
| brand/icons/ | 16 UI icons (24 grid, 2 px stroke, currentColor) |
| brand/icon/ | App icon masters (standard and maskable) |
| brand/export/ | 13 PNG icon sizes, 2 maskable, apple-touch-icon, favicon.svg/.ico/PNGs, 12 splash screens with `<link>` tags, OG image, DEV cover, contact sheet |
| brand/tokens/ | tokens.css (light, dark, sun mode, reduced motion) and tokens.json (colors, roles, type scale, radii, spacing, motion) |
| brand/fonts/ | Fraunces and Atkinson Hyperlegible Next WOFF2 files with OFL licenses |
| brand/tools/ | palette.mjs (single source), build.mjs (generates everything), contrast.mjs (pass/fail gate) |

## Proof

- `npm run build` regenerates all assets: logo=25, icons=16, icon=2, export=37, texture=2, tokens=2, fonts=8 files.
- `npm run contrast`: all 22 pairs pass WCAG 2.2 (body text ≥ 7:1, secondary and accent ≥ 4.5:1, large UI ≥ 3:1). The first run failed one pair (ink on maple button, 4.25:1); fixed by making buttons maple-700 with birch text (5.93:1).
- Visual review: every logo SVG, the contact sheet, the OG image, the DEV cover and a splash were rendered and inspected. Fixed during review: choppy Gone smoke, a broken "g" in outlined text (BUG-006), an undersized mark in lockups, unclear restroom and fade icons.
- Sizes checked: favicon.ico holds 16, 32 and 48; icons 512 and maskable 512 are 512 × 512; apple-touch-icon is 180 × 180; OG 1200 × 630; DEV cover 1000 × 420; splash files match each phone (1170 × 2532, 1206 × 2622, 1320 × 2868, and landscape).
- Export folder cut from 40 MB to 2.4 MB by removing grain from icons and splash screens.
- Tooling: @resvg/resvg-js 2.6.2, opentype.js 2.0.0, @fontsource 5.3.0 packages, png-to-ico 3.0.2; `npm install` reported 0 vulnerabilities.

## Key decisions and why

1. **The mark is an upside-down map pin:** a flame with the pin's hole at its base. It ties fire to place and is distinct from flame emoji and other "Flare" logos. The hole is never filled.
2. **State is shape first, color second:** Kindling (small flame), Lit (full), Ember (low dome), Gone (dashed ring and smoke). In light mode Kindling and Lit share maple; size tells them apart. Works in one color and for color-blind people.
3. **Sun mode:** outdoor screens force light roles and 1.15× text (`data-sun`), because dark pairs lose most of their contrast in daylight (maple on dusk: 4.50 indoors, 1.56 in open sun).
4. **Type:** Fraunces for the wordmark and titles; Atkinson Hyperlegible Next, designed for low-vision readers, for everything else.
5. **Name:** keep "Flare" this weekend, with a descriptor; risk is Medium now and High for any App Store listing ("Flare - For Groups", 6,674 ratings, same category). Trademark not searched. Package name `flare-outside` is free on npm.

## What product design must do next

- Design every screen listed in docs/handoffs/02-analyst.md using `brand/tokens/tokens.css` roles (never raw hex), the 16 icons (draw new ones on the same grid), and the state marks for Kindling, Lit, Ember and Gone.
- Turn the motion and sound direction (brand book section 8) into exact specs: Kindling growth steps per yes, Lit catch, Ember settle, Gone drift; with Reduce Motion and silent alternatives.
- Apply sun mode to Lit, compass, Ember and arrival screens.
- Keep fixed strings from the SRS as written; the voice table in 01-strategy.md shows the tone for new ones (buttons ≤ 3 words, messages ≤ 12).
- Fill the `design` column in docs/requirements/05-rtm.csv and run `python3 docs/requirements/tools/trace.py`.

## Things to know

- Gold is never used for text on light backgrounds (1.65:1).
- Primary buttons: maple-700 background, birch-50 label. Ink on maple is not allowed.
- The glow mark (gold dot) needs at least 24 px; below that use the plain maple mark.
- Founder decision needed later: public repo name and any store listing name (02-name-check.md).
- `lab/` is not ours to edit.

## Update after founder review (Oct 10)

- Share images redone: three directions explored, "Golden hour" chosen and applied to both the DEV cover and the OG image (brand book section 6).
- App icon checked at 60 and 120 px beside real App Store icons; flame enlarged, background lightened, dot enlarged.
- Repo and package name confirmed by the founder: `flare-outside`. Rename decision before any store listing stays with the founder.

## Change requests

None against earlier phases.
