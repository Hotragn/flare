# Place functions (ICD-6)

All pure functions over a pack, on the phone, no model, no network (SRS-ACC-6, ADR-0010). Import from `#lib/map/index.ts`: `maps` implements the frozen `Maps` interface; extras are named exports. Distances are great-circle (haversine). A place with `access=private` or `access=no` is never offered.

| Function | Rule | Behaviour |
| --- | --- | --- |
| `nameSpot(pack, at)` | SRS-CRE-3 | Nearest named park, water, woods, shelter, viewpoint, bench or picnic table within 150 m; else the nearest named street within 300 m; else `null`. `key` is the OSM id. Never coordinates. |
| `emberCandidates(pack, spot)` | BR-E-1 | Benches and picnic tables within 400 m, nearest first, at most 12, one per OSM element. |
| `walkMinutes(from, to)` | BR-C-7 | Straight-line metres × 1.3 ÷ 80 m/min (4.8 km/h). Not rounded; callers round for display. |
| `accessLine(pack, place)` | SRS-ACC-2, BR-A-4 | Within 200 m: count and nearest metres for seats (benches + picnic tables), restrooms, drinking water. `steps_mapped` is true when `highway=steps` lies within 50 m, the same radius as the avoid-steps rule, so the line and the check never disagree. |
| `checkNeeds(pack, needs, from, place)` | BR-A-2, SRS-PLAN-6 | Pass or fail. `failedNeeds` returns which clauses fail: `steps` (steps within 50 m of the place, or within 20 m of the straight line from `from`), `rest` (no seat within the limit), `restroom` (no toilets within 300 m). `from` is the person's own position and is never sent. Without `from`, only the place clause of avoid-steps applies. |
| `natureLine(pack, place, when, tz)` | SRS-NAT-1 | 1. "Sunset 6:57 PM" when sunset is 0 to 3 h after `when`; 2. "By {name}" for named water or woods within 200 m; 3. "Week 3 of fall". Only real data: NOAA sunset, OSM names, the date. |
| `sunset(at, day)` | MP4 | NOAA Solar Calculator equations, apparent sunset (zenith 90.833°), day chosen from longitude so the local day is right after midnight UTC. Invalid Date when the sun doesn't set. |
| `endsAfterSunset(place, end)` | BR-P-9 | For "Ends after sunset". |
| `placeWords(pack, place)` | ADR-0007 | Up to 8 chips for the typed six words: the spot name, other names within 200 m, then nouns for what is mapped within 100 m ("bench", "fountain", "steps"). |
| `planWeather(at, start, end)` | MP5, SRS-PLAN-2 | Two calls to api.weather.gov at 0.1° (points, then forecastHourly), reduced to `{ rain_likely, temp_f }`: rain likely at a 50% chance or more in any hour of the window; temp is the window's mean, clamped to -40..130. Any error, non-2xx, timeout (5 s), odd payload, or a forecast URL off api.weather.gov returns `null`. |
| `load(area)`, `loadNear(at)`, `loadPathsNear(at)` | SRS-IF-4 | See 02-pack-format.md, "Refresh". |

## Proof at five Fairlane points

From `scripts/test/map-places.test.ts` and `map-nature.test.ts` on the committed pack:

| Point | nameSpot | Ember candidates | Access line | Nature line at 11 AM / 5 PM EDT Oct 11 |
| --- | --- | --- | --- | --- |
| Mall centroid 42.31691, -83.22294 | Town Center Drive (street) | 0 | restroom 72 m, no seats | Week 3 of fall / Sunset 6:57 PM |
| Wagner Park 42.3055, -83.2447 | Wagner Park | 12 | 12 seats (nearest 139 m), water 138 m, steps mapped | Week 3 of fall / Sunset 6:57 PM |
| Fair Lane Lake 42.316, -83.237 | Fair Lane Lake | 3 | 3 seats (nearest 3 m) | By Fair Lane Lake / Sunset 6:57 PM |
| Village Green 42.3064, -83.227 | Village Green | 12 | 12 seats (nearest 44 m), restroom 141 m | By Suwanee Island / Sunset 6:57 PM |
| Rotunda Drive 42.295, -83.21 | Rotunda Drive (street) | 0 | none mapped | Week 3 of fall / Sunset 6:57 PM |

Sunset for Dearborn on Oct 11, 2026: 6:57:15 PM EDT (evidence: about 6:57 PM). Our NOAA implementation agrees with the independent sunrise equation within 1.5 min on the 11th of every month of 2026.

Timing on an M-series Mac (Node 24): each function under 3 ms on the 11,043-item pack after the first call (the first decodes the pack, about 20 ms).

## Data caveats shown to people

- "No steps mapped" means none are in OpenStreetMap, not that there are none (copy `site.access.g2`).
- Greenfield Village (Village Green) is a paid museum, but OSM does not tag its paths `access=customers`, so it is offered like a park.
