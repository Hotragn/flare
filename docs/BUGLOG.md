# Bug log

One entry per problem we solved, so nobody solves it twice. Newest at the bottom.

Format: ID, date, area, symptom, cause, fix, proof.

---

## BUG-001: DEV listings miss and repeat posts

- **Date:** 2026-10-10
- **Area:** Research (DEV field scan)
- **Symptom:** Paging `#hf26challenge` with DevRelay `get_articles` (10 x 100) returned 947 unique posts. 24 of the 48 most-reacted Week 1 posts were missing. Paging `GET /api/articles?tag=...&top=8` (9 x 100) gave 701 unique out of 900 rows.
- **Cause:** The tag listing is ordered by a score that changes while you page, so posts shift between pages. The `top` listing has many ties at 0 reactions, with the same effect. DEV's date-sorted search feed is stable but stops at 800 results per sort direction.
- **Fix:** Use the union of all three: the search feed `https://dev.to/search/feed_content?per_page=100&page=N&tag_names%5B%5D=<tag>&sort_by=published_at&sort_direction=desc&class_name=Article`, the same feed with `sort_direction=asc`, and both API listings. Then check that the top-reacted posts are all present.
- **Proof:** The union held 2,009 posts and 813 Week 1 entries. All 48 top-reacted Week 1 posts were present. The only gap left is Oct 5, 18:00 to 20:58 UTC.

## BUG-002: DEV API rate limit makes bulk reads crawl

- **Date:** 2026-10-10
- **Area:** Research
- **Symptom:** `GET https://dev.to/api/articles/<user>/<slug>` returned 429 with `retry-after: 34` after a few calls. Throughput fell to about 5 articles a minute. `GET /api/articles/<id>` returned 404 for valid ids without an auth header.
- **Cause:** Anonymous rate limit on the API.
- **Fix:** Read article pages from the CDN (`https://dev.to/<user>/<slug>`). The body sits between `id="article-body"` and the first `below-post-bb` (or `id="comments"`). Strip HTML comments before counting words.
- **Proof:** 691 pages fetched in about 7 minutes at 0.25 s spacing with no 429s. On 3 articles, word counts were within 1 to 7% of the original markdown.

## BUG-003: Page-text extraction ran into comments and sidebars

- **Date:** 2026-10-10
- **Area:** Research
- **Symptom:** "Postgres" matched 332 of 682 entries, and the median post came out at 938 words.
- **Cause:** The first extractor looked for an end marker (`crayons-article__main`) that doesn't exist, then fell back to taking the rest of the page, including comments, sidebars and ad slots.
- **Fix:** End at `below-post-bb` (551 of 560 pages) or `id="comments"` (9 of 560).
- **Proof:** Postgres fell to 21 of 682 and the median to 725 words. Other counts moved by 2 points or less.

## BUG-004: Overpass returns "too busy" or stale data

- **Date:** 2026-10-10
- **Area:** Maps data
- **Symptom:** overpass-api.de returned an HTML page "Dispatcher_Client::request_read_and_idx::timeout. The server is probably too busy" (HTTP error) on 3 of 4 tries. overpass.private.coffee answered but its data timestamp was 2026-05-31 (4 months stale). maps.mail.ru returned 504.
- **Cause:** Public Overpass load; mirrors lag.
- **Fix:** Retry overpass-api.de with backoff (20 s, 30 s, 40 s...). Always check `osm3s.timestamp_osm_base` in the response before trusting a mirror. Send a User-Agent. Ship a pre-fetched pack for the test area.
- **Proof:** Fourth attempt succeeded with timestamp 2026-10-10T17:07:36Z; result saved in docs/requirements/evidence/.

## BUG-005: BLS and CDC block scripted fetches

- **Date:** 2026-10-10
- **Area:** Research
- **Symptom:** curl to bls.gov and cdc.gov returns 403 even with a browser User-Agent.
- **Fix:** Read BLS release pages in the built-in browser. For CDC disability numbers, use the open data API: `https://data.cdc.gov/resource/s2qv-b27b.json` (DHDS), filter `locationabbr`, `stratification1='Overall'`, `indicatorid='STATTYPE'`.
- **Proof:** DHDS returned US 2022 mobility 12.2%, vision 5.5%; BLS 2025 release text read in the browser.

## BUG-006: Outlined text showed a broken "g"

- **Date:** 2026-10-10
- **Area:** Brand assets
- **Symptom:** In the OG image, "Kindling" rendered as "Kindlin" plus a stray mark. The glyph's own data was fine (50 commands, normal bounding box).
- **Cause:** opentype.js 2.0.0 `toPathData()` output, concatenated across glyphs, was placed wrongly by resvg on glyphs with several contours.
- **Fix:** Serialize `path.commands` ourselves as absolute M, L, C, Q, Z (`absPath` in brand/tools/build.mjs). Also: opentype.js 2.0.0 can't read WOFF2 without a decompressor; read the `.woff` files.
- **Proof:** Re-rendered OG image and DEV cover show "Kindling" correctly.

## BUG-007: Bits UI pulls a vulnerable nested SvelteKit 2

- **Date:** 2026-10-10
- **Area:** Prototype dependencies
- **Symptom:** `npm audit` reported 5 low-severity issues (cookie < 0.7.0, GHSA-pxg6-pf52-xh8x) after installing bits-ui 2.19.5 with @sveltejs/kit 3.0.1. `npm audit fix --force` proposed downgrading bits-ui to 2.11.7.
- **Cause:** bits-ui → runed and svelte-toolbelt declare @sveltejs/kit ^2 as a peer, so npm installed a nested kit 2.x with the old cookie.
- **Fix:** `"overrides": { "@sveltejs/kit": "$@sveltejs/kit" }` in package.json, so every dependent uses our kit 3.0.1.
- **Proof:** `npm audit`: found 0 vulnerabilities; `npm ls @sveltejs/kit` shows one deduped 3.0.1.

## BUG-008: SvelteKit 3 rejects svelte.config.js, `kit` options and $lib

- **Date:** 2026-10-10
- **Area:** Prototype (SvelteKit 3.0.1)
- **Symptoms and fixes:**
  1. `config_file_unsupported`: SvelteKit 3 no longer reads `svelte.config.js`. Pass options to the Vite plugin: `sveltekit({ adapter, prerender })` in vite.config.ts.
  2. `config_kit_namespace`: options are passed flat, not under `kit: {}`.
  3. `config_option_deprecated_alias`: `alias` is deprecated. `$lib` is no longer predefined (generated `paths` is `{}`). Use Node subpath imports: `"imports": { "#lib/*": "./src/lib/*" }` in package.json, and import with the file extension (`#lib/brand.ts`, `#lib/components/Flame.svelte`).
  4. `tsconfig_extends_missing`: tsconfig must `"extends": "$app/tsconfig"` (written to node_modules/$app/tsconfig.json by `svelte-kit sync`).
  5. Subpath import targets can't leave the package, so files from design/system and brand/ are copied in by `scripts/sync-assets.mjs` (runs before dev, build and check).
- **Proof:** `npm run check`: 0 errors, 0 warnings across 649 files; `npm run build` wrote the static site.

## BUG-009: The `lab/` ignore rule hid the prototype's /lab test pages

- **Date:** 2026-10-10
- **Area:** Repo (motion test pages)
- **Symptom:** `git status` did not list `design/prototype/src/routes/lab/` (the /lab/fps, /lab/haptics and /lab/motion pages), so they would never be committed.
- **Cause:** `.gitignore` had `lab/`, which matches a folder named `lab` at any depth, not only the spike folder at the repo root.
- **Fix:** Anchor it: `/lab/`.
- **Proof:** `git check-ignore -v lab/reports/06-flame.md` still prints `.gitignore:7:/lab/`; the route files now show as new files and are committed.

## BUG-010: A prop named `state` breaks `$state` in the same component

- **Date:** 2026-10-10
- **Area:** Prototype (Svelte 5.57.2)
- **Symptom:** Adding `let x = $state(...)` to Flame.svelte and FlameMeter.svelte gave `store_rune_conflict` warnings and "Cannot use 'state' as a store" errors in `npm run check`.
- **Cause:** The components take a prop called `state`, so `$state` reads as a store subscription to that prop (same root cause as the screens' `view` prop, BUG-008 notes).
- **Fix:** Keep the public prop name and rename it locally: `let { state: st = "lit" } = $props()`.
- **Proof:** `npm run check`: 0 errors, 0 warnings.

## BUG-011: Mask texture channels came out wrong from canvas readback

- **Date:** 2026-10-10
- **Area:** Motion (WebGL flame)
- **Symptom:** Drawing the flame, dome and Gone mark into the red, green and blue channels of one transparent 2D canvas gave full-strength color at soft edges, so shapes overlapped wrongly in the shader.
- **Cause:** `getImageData` returns un-premultiplied color. On a transparent canvas, coverage lives in alpha and the color channels read 255 at any coverage.
- **Fix:** Fill the canvas opaque black first, then draw the shapes with `globalCompositeOperation = "lighter"`. Each channel then holds the coverage of its shape. The wide glow is blurred on a 128 px copy and scaled up.
- **Proof:** Shapes render correctly in /lab/fps in all four states; one-time mask build fell from 36.5 ms to 17.3 ms at 1x CPU (Chrome, M4).

## BUG-012: `afconvert -h` exits with code 2

- **Date:** 2026-10-10
- **Area:** Motion (sound generator)
- **Symptom:** design/motion/make-sounds.mjs reported "n/a" for every M4A size although `/usr/bin/afconvert` exists.
- **Cause:** The script treated any non-zero exit from `afconvert -h` as "not installed"; `afconvert -h` prints help and exits 2.
- **Fix:** Treat only `ENOENT` (command not found) as missing.
- **Proof:** The script now writes lit.m4a (8,199 bytes) and ember.m4a (6,138 bytes) and prints all four M4A sizes.

## BUG-013: a11y script crashes in a fresh worktree; svelte-check warns on Screen.svelte

- **Date:** 2026-10-10
- **Area:** Prototype tooling
- **Symptoms and fixes:**
  1. `node scripts/a11y.mjs` threw `ENOENT ... design/exports/a11y-report.json`: design/exports/ is git-ignored, so a new checkout lacks it. Fix: `mkdir -p design/exports` before the run (the script is otherwise unchanged).
  2. `npm run check` printed 1 warning, `a11y_no_noninteractive_tabindex`, on the scrollable `<main tabindex="0">` in Screen.svelte. The tabindex is deliberate (axe rule scrollable-region-focusable). Fix: a `svelte-ignore` comment on that line.
  3. Scripts were fixed to port 5318, which a parallel session uses. Fix: `PORT=5321` support in export.mjs, a11y.mjs and focus-audit.mjs (default stays 5318).
- **Proof:** `npm run check` 0 errors, 0 warnings; `PORT=5321 node scripts/a11y.mjs` 193 targets, 0 violations; `PORT=5321 node scripts/focus-audit.mjs` 0 targets under 44 px.

## BUG-014: View-transition test frames looked shifted on the prototype page

- **Date:** 2026-10-10
- **Area:** Motion (test tooling)
- **Symptom:** In design/motion/sequence.mjs frames of /proto at 390 px wide, both snapshots of the phone appeared about 400 px lower than the phone during the step transition.
- **Cause:** Two things. The new screen loads through `{#await}`, so the first new snapshot was empty (real bug). And at 390 px the phone sits below the side panel, so Playwright scrolled the page during the transition, while view-transition pseudo-elements stay in viewport coordinates (test artifact).
- **Fix:** The step update now waits for the next screen module and one task before the new snapshot is taken. Prototype transition frames are taken at 1280 x 960 (`VW=1280 VH=960`).
- **Proof:** Frames at 0, 100, 200 and 700 ms show a clean crossfade from H5 to I6 and the catch playing after it.
