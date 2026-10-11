# Maps progress (wp/maps)

## Done
- Pack v2 builder: apps/web/src/lib/map/{geo,overpass,pack}.ts, scripts/build-map-pack.ts. First live run Oct 10 20:56 ET: counts match evidence (54 benches, 7 picnic tables, 7 toilets, 3 water, 32 parks, 28 steps). Raw size 57.7 KB brotli with streets at 25 m, over the 10 KB target.

## In progress
- Shrinking street points (dedupe same name within 25 m, fewer highway classes) and committing fairlane.json.

## Exact next step
Rebuild from raw (`--from-raw <scratchpad>/raw`), commit the pack, then place functions (places.ts) with tests in scripts/test/map-*.test.ts.
