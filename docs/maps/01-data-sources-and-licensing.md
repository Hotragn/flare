# Data sources and licensing

## Sources

| Data | Source | When it is fetched | Who sees the request |
| --- | --- | --- | --- |
| Benches, picnic tables, restrooms, drinking water, steps, parks, shelters, viewpoints, named water and woods, named streets | OpenStreetMap via the Overpass API at `https://overpass-api.de/api/interpreter` | Build time for the bundled Fairlane pack; on the phone for anywhere else (once per 7 days per ~1 km cell) | overpass-api.de (FOSSGIS) sees the query area: a 2 km circle centred on a 0.01° grid point |
| Walking network (rest loops) | Same, query 3 | Build time only (v1) | Nobody at run time |
| Sunset | Computed on the phone, NOAA Solar Calculator equations | Never fetched | Nobody |
| Season | Computed from the date | Never fetched | Nobody |
| Plan weather | US National Weather Service, `https://api.weather.gov` | When a host drafts a Plan | api.weather.gov sees a position rounded to 0.1° (about 11 km) |

No other map, tile or geocoding service is used. There is no map screen and no tiles.

## Licence: ODbL 1.0

OpenStreetMap data is © OpenStreetMap contributors, available under the Open Database License 1.0 (https://opendatacommons.org/licenses/odbl/1-0/; summary at openstreetmap.org/copyright).

What we do to comply:

1. Attribution. Every pack carries `attribution: "Map data © OpenStreetMap contributors, ODbL 1.0. openstreetmap.org/copyright"` and `validatePack` refuses a pack without it. The UI must show the copy-deck line `site.foot.osm` ("Map data © OpenStreetMap contributors.") wherever a map-derived line appears (access line, nature line from a named feature, spot name, loop card). The PDF card prints it on the last line.
2. Share-alike. The packs are a Derivative Database. They are published inside this repo (AGPL app code, ODbL data) and served as plain JSON at `/maps/`, so anyone can get them. The builder and queries are in the repo, which documents how they were made.
3. Produced Works. Lines like "By Fair Lane Lake" or "Bench 40 m" are Produced Works; attribution above covers them.

## Request rules (overpass-api.de usage policy)

- Identify ourselves. The Node builder sends `User-Agent: FlareMapPack/2.0 (+https://github.com/Hotragn/flare; ...)`. Browsers forbid setting User-Agent; the phone sends its own plus the Referer.
- Few requests, spaced. A Fairlane rebuild is 3 queries; queries are at least 2.5 s apart; "too busy" (HTTP 429 or 504) retries at most 3 times with waits of 5, 10 and 20 s (BUG-004 from the analyst's run).
- Cache. The phone keeps live packs for 7 days and reuses them.
- Never contact any openstreetmap.org host (SRS-MAP-3). A test scans the map and compass code for openstreetmap.org URLs and another checks every host contacted in the loader tests.

## Freshness

`osm_base` is Overpass's `timestamp_osm_base`. The builder refuses data older than 7 days (SRS-IF-4). The bundled Fairlane pack in this commit has `osm_base` 2026-10-11T00:53:36Z, so it is fresh until 2026-10-18T00:53Z. After that the phone tries to build a live pack and uses the stale bundled one only when offline (`source: "stale"`).
