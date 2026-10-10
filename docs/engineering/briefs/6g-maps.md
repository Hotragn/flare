# Brief 6g: Maps / GIS engineer

Branch `wp/maps`. Ports 8850 to 8859. Handoff: docs/handoffs/06g-maps.md.

You're a GIS engineer with 10 years working with OpenStreetMap and location apps. Own everything about place.

## Own
`apps/web/src/lib/map/**` (ICD-6), `apps/web/src/lib/compass/**`, `apps/web/static/maps/**`, `apps/web/static/check/compass.*` and `check.css`, `scripts/build-map-pack.ts`, `scripts/spikes/compass-flow.ts`, `docs/maps/**`, notes `maps-progress.md`, bugs `maps.md`.

## Build (WPs MP1 to MP7, approved MP1 fixes)
- Data sources and licensing (ODbL 1.0 attribution shown wherever map data is used).
- Pack v2 builder (ICD-6 `MapPack`): the analyst's pinned query (docs/requirements/evidence/fairlane-pinned.overpassql) plus `leisure=picnic_table`, named natural features (water, wood) and named streets as points every 25 m, centred on TEST_AREA (42.3169092, -83.2229394, 3 km); identifying User-Agent; overpass-api.de only, at most a few requests spaced ≥ 2 s; `osm_base` ≤ 7 days; size limit 10 KB brotli target (justify if exceeded). Commit the Fairlane pack to apps/web/static/maps/fairlane.json. Nearby data elsewhere: the same builder on demand, cached on the phone for 7 days (format spec covers refresh and versioning).
- Offline data-pack format spec (contents, size limits, versioning, refresh).
- Place functions (ICD-6): nameSpot (≤ 150 m named, else street), emberCandidates (≤ 400 m, ≤ 12), walkMinutes (×1.3 at 4.8 km/h), accessLine (200 m), needs checks (BR-A-2), natureLine (NOAA sunset, named natural feature ≤ 200 m, season; real data only), placeWords for the typed fallback chips, Plan weather (api.weather.gov at 0.1°, fail soft).
- Wayfinding without a map screen: the talking compass module (sensor handling, iOS permission flow proven in spike E3, speech rules SRS-CMP-2, tone on facing, offline from the saved target), used by FE's Lit screen.
- Walking loops with rest stops and a printable large-print PDF card (SRS-REST-2 to -6; body ≥ 18 pt, contrast ≥ 7:1, "Check the path. Map data can be wrong.").
- Community map-contribution flow: draft tags (from ML's prompt via the hub), review every tag, export OSM Note text or `.osm` only; no request to any openstreetmap.org host (SRS-MAP-3); publishing waits for the founder.
- Tests and docs.

Done = all place features work offline around Fairlane and online anywhere.
