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

## BUG-009: Screens drifted from fixed requirement strings

- **Date:** 2026-10-10
- **Area:** Copy (prototype screens)
- **Symptom:** While moving copy into the deck, 5 screens didn't match the requirements: I7 offline said "Offline. Pointing to the spot saved at 2:14 PM." (SRS-OFF-2 fixes "Offline. Saved at {time}."); P5 after a fade said "Smaller plan: Short walk at 11:00 AM." (BR-P-7 fixes "Smaller plan: {step name}."); O5 split SRS-REST-4 into "No loop keeps benches that close." plus "Try 300 m between seats?"; I9 showed an invented nature line "You'll be sitting on the bench." (SRS-NAT-1 allows only sunset, a named OSM feature or the season); I1, I10 and P7 said "Nothing about it was kept", which is untrue because group counters are kept.
- **Cause:** Strings were typed into each component, and the old copy lint only counted words.
- **Fix:** One source: design/prototype/src/lib/copy/deck.json, read through `t()`. `scripts/copy-lint.mjs` now checks 41 fixed strings word for word and fails on any hardcoded text in screens.
- **Proof:** `node scripts/copy-lint.mjs`: "Fixed: 41/41 … Problems: 0".

## BUG-010: svelte-check warns on the scrollable content region

- **Date:** 2026-10-10
- **Area:** Prototype (Screen.svelte)
- **Symptom:** `npm run check` after `npm ci` reported 1 warning, "noninteractive element cannot have nonnegative tabIndex value", on `<main class="content" tabindex="0">`, so the 0-warning gate failed before any copy change.
- **Cause:** The tabindex is deliberate (axe `scrollable-region-focusable`, WCAG 2.1.1), but Svelte's a11y rule doesn't know that.
- **Fix:** `<!-- svelte-ignore a11y_no_noninteractive_tabindex -->` on that one element, next to the comment that explains why.
- **Proof:** `npm run check`: 699 files, 0 errors, 0 warnings. axe still 0 violations on 193 targets.

## BUG-011: Menu rows had run-together accessible names

- **Date:** 2026-10-10
- **Area:** Prototype (O0 Menu)
- **Symptom:** The focus audit read the rows as "Plan for laterA walk on Sunday, with a deadline": title and subtitle joined with no space, so VoiceOver reads one long word.
- **Cause:** The two spans sit in a flex column with no text between them.
- **Fix:** A visually hidden ". " between title and subtitle.
- **Proof:** docs/design/07-annex-focus-order.md now lists "Plan for later. A walk later, with a time to answer by".

## BUG-012: Copy lint misread Svelte expressions as hardcoded text

- **Date:** 2026-10-10
- **Area:** Copy tooling (scripts/copy-lint.mjs)
- **Symptom:** The first run flagged 38 "hardcoded text" lines that were all `{t("…", { n })}` calls or `{#if i < 2}` blocks.
- **Cause:** Stripping `{…}` with a flat regex fails on nested braces (`t("key", { n: 2 })`), and the `<` inside `{#if i < 2}` looked like a tag.
- **Fix:** Remove Svelte expressions with a small brace-and-quote-aware scanner before looking for text between tags.
- **Proof:** 0 false hits; a literal "Sun 11:00 AM" in P1 was still caught and moved to sample.ts.

## BUG-013: a11y script crashes when design/exports is missing

- **Date:** 2026-10-10
- **Area:** Prototype tooling (scripts/a11y.mjs)
- **Symptom:** `node scripts/a11y.mjs` ran every check, then died with ENOENT writing design/exports/a11y-report.json.
- **Cause:** design/exports is git-ignored since commit 5d90fc6, so a fresh worktree doesn't have it, and the script doesn't create it.
- **Fix:** `mkdir -p design/exports` before the run (or run `npm run export` first). The script is left as is for its owner; a one-line `fs.mkdirSync(dir, { recursive: true })` would remove the step.
- **Proof:** Rerun: "Checked 193 pages and screen states. Violations: 0 (serious or critical: 0)".
