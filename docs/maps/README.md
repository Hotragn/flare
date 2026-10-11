# Maps and place

Everything Flare knows about place: the offline map packs, the place functions (ICD-6), the talking compass, Bench to Bench loops with the large-print card, and Fix the map. Owner: Maps (wp/maps).

| Doc | What |
| --- | --- |
| [01-data-sources-and-licensing.md](01-data-sources-and-licensing.md) | Where the data comes from, ODbL attribution, request rules |
| [02-pack-format.md](02-pack-format.md) | Map pack v2 and paths pack v1: contents, size, versioning, refresh |
| [03-place-functions.md](03-place-functions.md) | nameSpot, emberCandidates, walkMinutes, accessLine, needs checks, nature line, placeWords, weather |
| [04-compass.md](04-compass.md) | Talking compass: sensors, iOS permission order, speech rules, facing tick |
| [05-rest-loops.md](05-rest-loops.md) | Bench to Bench: loop search, turn list, PDF card, spoken turns |
| [06-fix-the-map.md](06-fix-the-map.md) | Draft, review, export; no request to openstreetmap.org |

## Code

| Path | What |
| --- | --- |
| `apps/web/src/lib/map/index.ts` | `maps` (the ICD-6 `Maps` object) and every extra export |
| `apps/web/src/lib/map/{geo,overpass,pack,store}.ts` | Geometry, Overpass queries, pack build and decode, loading and the 7-day cache |
| `apps/web/src/lib/map/{places,nature,sun,weather}.ts` | Place functions, nature line, NOAA sunset, Plan weather |
| `apps/web/src/lib/map/{paths,loop,card}.ts` | Walking network, loop builder, PDF card |
| `apps/web/src/lib/map/fixmap.ts` | Fix the map |
| `apps/web/src/lib/map/copy.ts` | Copy-deck strings the module renders (checked against deck.json by a test) |
| `apps/web/src/lib/compass/` | Talking compass |
| `apps/web/static/maps/fairlane.json`, `fairlane-paths.json` | Bundled Fairlane packs, served at `/maps/` |
| `scripts/build-map-pack.ts` | Builder (Node) |
| `scripts/test/map-*.test.ts` | 87 tests across 7 files |

## Rebuild the Fairlane packs

```sh
node scripts/build-map-pack.ts --raw /tmp/flare-map-raw          # 2 queries, about 5 s
node scripts/build-map-pack.ts --paths --raw /tmp/flare-map-raw  # 1 query, about 10 s
```

Then `npm test`: the pack test checks the pinned counts and the size ceiling. Rebuild at least every 7 days before a field day (the builder refuses data older than that).
