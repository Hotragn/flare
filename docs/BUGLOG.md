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
