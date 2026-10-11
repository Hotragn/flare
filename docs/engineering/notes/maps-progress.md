# Maps progress (wp/maps)

## Done
- Pack v2 builder: apps/web/src/lib/map/{geo,overpass,pack}.ts, scripts/build-map-pack.ts. Fairlane pack committed (osm_base 2026-10-11T00:53:36Z, 11,043 items, 37.8 KB brotli). Counts match evidence (54/7/7/3/32/28).
- Place functions (places.ts): nameSpot, emberCandidates, walkMinutes, accessLine, checkNeeds/failedNeeds, placeWords.
- Nature line (nature.ts, sun.ts NOAA), endsAfterSunset (BR-P-9). Copy keys nature.* added to deck.json.
- Tests: scripts/test/map-{pack,places,nature}.test.ts (44 tests).

## Exact next step
Compass module apps/web/src/lib/compass/ (speech rules SRS-CMP-2, tone/haptic, permission order), then maps index (load + 7-day cache), weather, rest loops + card, Fix the map, docs/maps, handoff.
