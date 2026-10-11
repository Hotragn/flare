# Handoff 06g: Maps / GIS to the lead, FE, PWA, ODAI and ML

From: Maps (branch `wp/maps`). Date: Sun 2026-10-11, early morning ET. Covers MP1 to MP7.

## Start here

- Import everything from `#lib/map/index.ts` and `#lib/compass/index.ts`. `maps` implements the frozen ICD-6 `Maps` interface unchanged.
- Docs: [docs/maps/README.md](../maps/README.md) and its six pages.
- Swap your ICD-6 fakes for the real module: it is pure TypeScript with no Svelte and no dependencies beyond `@flare/shared` types.

## What was delivered

| WP | Path | Contents |
| --- | --- | --- |
| MP1 | `scripts/build-map-pack.ts`, `lib/map/{overpass,pack,geo}.ts`, `static/maps/fairlane.json` | Pack v2 builder (pinned query verbatim, picnic tables, shelters, viewpoints, named water and woods, named parks and streets every 25 m); identifying User-Agent; overpass-api.de only; 2.5 s spacing; busy retries; refuses `osm_base` older than 7 days; ODbL attribution. Fairlane pack built with `osm_base` 2026-10-11T00:53:36Z. |
| MP1 | `lib/map/store.ts` | `load`, `loadNear` (bundled, then 7-day Cache API pack built on the phone, then stale), `loadPathsNear` |
| MP2 | `lib/map/places.ts` | `nameSpot`, `emberCandidates`, `walkMinutes`, `accessLine`, `placeWords`, plus `failedNeeds`, `nearestSeatM`, `stepsNear`, `isUsable` |
| MP3 | `lib/map/places.ts` | `checkNeeds` with each BR-A-2 clause |
| MP4 | `lib/map/{sun,nature}.ts` | NOAA sunset, `natureLine`, `season`, `endsAfterSunset` (BR-P-9) |
| MP5 | `lib/map/weather.ts` | `planWeather`: api.weather.gov at 0.1°, `{ rain_likely, temp_f }` or `null` |
| FE4 support | `lib/compass/` | Talking compass: permission order from spike E3, heading sources and smoothing, speech rules, facing vibrate-or-tone, offline target |
| MP6 | `lib/map/{paths,loop,card}.ts`, `static/maps/fairlane-paths.json` | Walking network pack, loop builder, turn list, PDF card writer, spoken turns |
| MP7 | `lib/map/fixmap.ts` | Allow-list sanitizer, photo zeroing, review (keep, change, remove), Note text and `.osm` export |
| Docs | `docs/maps/` | Sources and ODbL, pack format (size, versioning, refresh), place functions, compass, loops, Fix the map |
| Bugs | `docs/engineering/bugs/maps.md` | BUG-MAPS-1 to -4 |

## Proof

| Check | Result |
| --- | --- |
| `npm run ci` on `wp/maps` | Green: secret scan 0 findings, lint 0, typecheck 0 errors (403 files), 139 tests (87 of them maps), contracts ok, build ok, web JS 62.7 KB gz of 150, 37 diagrams |
| Pinned counts | 54 benches, 7 picnic tables, 7 toilets, 3 drinking water, 32 parks, 28 steps: equal to evidence/README.md |
| Pack size | 37,836 B brotli (target 10 KB; justified in docs/maps/02-pack-format.md: 10,222 street points at 25 m; no encoding found under 23 KB for streets alone) |
| Five Fairlane points | Names, Ember candidates, access lines and nature lines in docs/maps/03-place-functions.md, all asserted in tests |
| Sunset Oct 11 Dearborn | 6:57:15 PM EDT; within 1.5 min of the independent sunrise equation on 12 dates |
| Weather live | 1 real run: `{ rain_likely: false, temp_f: 65 }` in 543 ms; fails soft on down, 503, odd JSON, timeout and off-site redirect (tests) |
| Loops | Village Green 20 min / 200 m: 1,021 m, 9 rests, longest gap 152 m, 194 ms; gaps measured by walking the path in tests |
| Card | 2-page PDF, 3.1 KB, all text ≥ 18 pt, black on white, viewed rendered |
| No openstreetmap.org | Source scan test plus host log in loader tests; only overpass-api.de, api.weather.gov and `/maps/` |
| Overpass use | 3 queries in total for this build (2 for the pack, 1 for paths), 2.5 s apart, with User-Agent |

## For each consumer

- FE (Lit screen, FE4): see docs/maps/04-compass.md for the tap handler. Show `site.foot.osm` near map-derived lines. Spot names never show coordinates. `accessLine` gives counts and metres; use `access.*` copy; never "step-free".
- FE (Bench to Bench, Fix the map): `buildLoop` result messages are already rendered from the copy deck. Offer `cardPdf` as a Blob download ("Print card").
- PWA: precache `/maps/fairlane.json` (37.8 KB br). Fetch `/maps/fairlane-paths.json` (89.4 KB br) on first use of Bench to Bench, then cache it. Live packs use the Cache API name `flare-maps-v2`.
- ODAI: `placeWords(pack, place)` gives up to 8 chips. For OD5, `LoopRequest` is defined in `lib/map/loop.ts` (see change request 2).
- ML (ML5): `draftFromPhoto(bytes, ask)` takes your drafter as `ask`; the reply can be an object or `[{ key, value }]`; anything off the allow-list is dropped.
- Engine/server (Ember, BR-E-3): phones report pass or fail per `emberCandidates` id (OSM id) using `checkNeeds`.

## Interface change requests

1. CSP and privacy (architect, BE): on-demand packs outside Fairlane call Overpass from the phone. `docs/architecture/08-security-privacy.md` `connect-src` needs `https://overpass-api.de`:
   ```diff
   - connect-src 'self' https://api.weather.gov
   + connect-src 'self' https://api.weather.gov https://overpass-api.de
   ```
   and a privacy line: "Outside the Fairlane area, your phone asks OpenStreetMap's Overpass service for benches and paths near you, to about 1 km." Until then `loadNear` fails soft outside Fairlane (stale pack or `PackError`); the field test is unaffected.
2. ICD-6, additive (ODAI owns the producer): add the rest-loop request type so OD5 and MAP share it.
   ```diff
   +/** OD5 parser output, MP6 input (SRS-REST-1, -2). */
   +export type LoopRequest = {
   +  minutes: number;
   +  rest_gap_m: 100 | 200 | 400;
   +  avoid_steps: boolean;
   +  prefer?: ("trees" | "water" | "quiet")[];
   +};
   ```
   `lib/map/loop.ts` would then import it instead of declaring it.
3. Allow-list (Product, analyst; BR-AI-4, E17-S1): add `highway` (value `steps` only) and `leisure` (value `picnic_table` only), so a draft can describe steps and picnic tables. Today the export adds `highway=steps` from the person's own choice.
4. Root scripts (lead): BUG-MAPS-3, `npm test` needs `svelte-kit sync` first on a fresh checkout. Proposed: `"pretest": "npm run -w apps/web check"`.
5. Config I changed, flagged for review: `biome.json` now excludes `apps/web/static/maps` (generated JSON; Biome would pretty-print the 11,043 items one value per line). Same pattern as the existing `apps/web/static/check/capability` exclusion.

## Copy keys added (16, add-only; copy-lint 0 problems, 587 strings, 41/41 fixed)

`nature.sunset` "Sunset {time}", `nature.feature` "By {name}", `nature.season` "Week {n} of {season}", `nature.season.spring|summer|fall|winter`, `loop.path.unnamed` "the path", `loop.landmark.corner` "the corner", `loop.landmark.bench` "the bench", `loop.side.left|right`, `map.thing.bench` "bench", `map.thing.toilets` "restroom", `map.thing.drinking_water` "drinking fountain", `map.thing.steps` "steps". `lib/map/copy.ts` mirrors the strings the module renders; a test fails if they drift from deck.json. I did not regenerate docs/content/ (Copy's generated files).

## Not done, and why

- Field accuracy of the compass (SRS-CMP-4) and a walked loop with only the card (E16-S3 AC2) need the phones on Sunday: device checklist step 5 and one tester.
- The static compass check page (`apps/web/static/check/compass.js`) still uses its own three directions; it is a sensor check, not the product compass, so I left it as spike E3 proved it.
- Loops outside bundled areas: not offered in v1 (walking network per cell is too heavy for a phone; docs/maps/05-rest-loops.md "Limits").

## Things to know

- Rebuild packs within 7 days of a field day: `node scripts/build-map-pack.ts` and `--paths`. The current pack goes stale 2026-10-18T00:53Z.
- Most Fairlane benches are clustered; Bench to Bench mostly says "No loop" outside Greenfield Village. That is the OSM data.
- Greenfield Village is a paid museum but its paths carry no access tag, so it is treated as public.
