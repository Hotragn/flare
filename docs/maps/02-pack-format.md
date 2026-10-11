# Offline data-pack format

Two files per bundled area, both JSON, both served from `/maps/`:

| File | Type | Used by | Fairlane size (raw / gzip / brotli) |
| --- | --- | --- | --- |
| `{area}.json` | Map pack v2 (ICD-6 `MapPack`) | Every place function | 443,502 / 59,918 / 37,836 B |
| `{area}-paths.json` | Paths pack v1 | Bench to Bench only | 328,604 / 119,122 / 89,404 B |

## Map pack v2 (ICD-6)

```ts
type MapPack = {
  v: 2;
  area: string;                 // "fairlane", or "live-41.88_-87.63" for phone-built packs
  center: [number, number];     // [lat, lon]
  radius_m: number;             // 3000 bundled, 2000 live
  osm_base: string;             // Overpass timestamp_osm_base, ISO 8601
  attribution: string;          // ODbL line; required
  kinds: Record<string, Kind>;  // one-letter codes
  items: [code, lat, lon, osm_id, tags | 0][];
};
```

Kind codes: `b` bench, `p` picnic_table, `t` toilets, `d` drinking_water, `s` steps, `h` shelter, `v` viewpoint, `k` park, `w` water, `f` wood, `r` street.

Rules:

- `osm_id` is `n`, `w` or `r` plus the OSM id. Points come from node positions or the Overpass centre of a way or relation.
- Kept tags: `name, access, wheelchair, toilets:wheelchair, backrest, fee, opening_hours, covered, indoor`. Streets keep only `name`.
- Multi-point features (streets, named water and woods outlines, named park outlines): the first point of an osm id carries the tags; later points carry `0` and inherit them on decode.
- Streets: named ways of class trunk, primary, secondary, tertiary, unclassified, residential, living_street, pedestrian, footway, path or cycleway, sampled every 25 m; a point is dropped when a kept point of the same name is within 12.5 m (dual carriageways, split ways). Street points are rounded to 4 decimals (about 11 m); everything else to 5 (about 1.1 m).
- Named water and woods and named parks: outline sampled every 50 m, clipped to the radius. Water tagged `water=wastewater`, `covered=yes`, `landuse=industrial`, or named like a tank or sewer is dropped (four sewer tanks near Fairlane are tagged `natural=water`).
- Items are sorted by code, then osm id; the build is deterministic for the same input.

### Contents of the Fairlane pack

Built 2026-10-10 20:56 ET, `osm_base` 2026-10-11T00:53:36Z, centre 42.3169092, -83.2229394 (OSM way 168151050), radius 3,000 m, 11,043 items. Distinct OSM elements per kind:

| Kind | Count | Evidence (docs/requirements/evidence/README.md) |
| --- | --- | --- |
| bench | 54 | 54 |
| picnic_table | 7 | 7 |
| toilets | 7 | 7 |
| drinking_water | 3 | 3 |
| park | 32 | 32 |
| steps | 28 | 28 |
| shelter | 9 | not pinned |
| viewpoint | 1 | not pinned |
| water (named) | 34 | not pinned |
| wood (named) | 1 | not pinned |
| street (named ways) | 1,238 | not pinned |

The pinned counts match exactly; `scripts/test/map-pack.test.ts` checks them.

### Size: why 37.8 KB brotli, not 10 KB

The 10 KB brotli target was set from lab spike 05's pack (128 points, 1.8 KB brotli), which had no streets. ICD-6 asks for named streets as one point per 25 m. Within 3 km of Fairlane that is 10,222 street points after dedupe, about 3.3 bytes each after brotli. Without streets the pack is 4.7 KB brotli.

Measured steps: 57.7 KB (first build) → 43.4 KB (same-name dedupe) → 37.8 KB (dedupe, 4-decimal street points, no service roads, sewer tanks dropped). The pack is precached once by the service worker (PWA), about 0.3 s on a 1 Mbps link. The test sets a 40 KB ceiling so growth is caught.

Other encodings don't reach 10 KB either: streets as delta-coded polylines of their own vertices measured 23.0 KB brotli (27.7 KB with the rest of the pack). At a 3 km radius, named streets cost 20 KB or more in any form; the only lever left is a smaller street radius, which would make `nameSpot` return null in parts of the test area. We keep 3 km.

## Paths pack v1 (rest loops only)

```ts
type PathsPack = {
  v: 1; area: string; center: [number, number]; radius_m: number;
  osm_base: string; attribution: string;
  names: string[];          // way names, indexed
  nodes: number[];          // [dlat, dlon, …] integer deltas in 1e-5°, first pair from center
  ways: number[][];         // [name index or -1, flags, node index, …]; flags 1 = steps, 2 = off-road
};
```

Query 3 takes highways a person can walk (footway, path, pedestrian, living_street, residential, unclassified, tertiary, secondary, primary, service, cycleway, steps, track), drops `access=private|no` and `foot=no|private` unless foot access is explicitly allowed, and drops `area=yes`. The builder also drops `service=parking_aisle|drive-through|driveway`. Each way is split at junctions and simplified with Douglas-Peucker at 3 m, so turns and distances survive.

Fairlane: 16,926 nodes, 7,713 ways, 89.4 KB brotli (186 KB before simplification and delta coding). It is not needed for the field-test path, so the PWA can fetch it on first use of Bench to Bench rather than precache it.

## Versioning

- `v` is the format version. Readers accept exactly the version they know (`validatePack`, `validatePaths`) and refuse others with `PackError`.
- A format change bumps `v`, the Cache API name (`flare-maps-v{v}`) and the file is rebuilt; old caches are ignored.
- Data changes do not bump `v`; `osm_base` tells data age.

## Refresh

| Situation | What happens |
| --- | --- |
| Point inside a bundled area, pack fresh (< 7 days) | Bundled pack, no network beyond `/maps/` |
| Bundled pack older than 7 days, online | Live pack built on the phone |
| Elsewhere, cached live pack < 7 days | Cached pack |
| Elsewhere, no fresh pack, online | Two Overpass queries (2.5 s apart), pack built on the phone, cached under its 0.01° cell key |
| Offline, only a stale pack | Stale pack, `source: "stale"` |
| Offline, nothing | `PackError("No map data here yet …")`; the UI uses typed words and no place lines |

A live pack covers a point when the point is at least 500 m inside its 2 km radius; the cell grid keeps every point within about 700 m of a centre.

On-demand packs on the phone need `https://overpass-api.de` in the CSP `connect-src` and a privacy line; both are interface change requests in the handoff.
