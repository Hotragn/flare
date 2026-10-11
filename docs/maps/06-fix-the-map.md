# Fix the map

SRS-MAP-1 to -4 (P1). Code: `apps/web/src/lib/map/fixmap.ts`, exported as `fixmap` from `#lib/map/index.ts`.

## Flow

1. Photo. The person photographs a bench, restroom, drinking fountain or steps and picks which one (`Thing`).
2. Draft. `draftFromPhoto(bytes, ask)` sends the photo to the drafter (`ask`: the hub through the server, ML's prompt, ADR-0007) and zero-fills the bytes afterwards, also on failure (SRS-MAP-4). On failure the manual tag picker starts with no tags.
3. Sanitize. Only the 13 allow-list keys survive (`amenity, backrest, material, seats, wheelchair, fee, access, opening_hours, drinking_water, step_count, handrail, covered, lit`; E17-S1), each with a value rule (for example `seats` 1 to 99, `backrest` yes or no). Everything else, including `name` and `inscription`, is dropped (BR-AI-4).
4. Review. `startReview` marks every tag pending. `keep`, `change` (validated) and `remove` set each one. `left(r)` drives "{n} tags left to check". `canExport` is false until none are pending and at least one survives (SRS-MAP-2).
5. Export (SRS-MAP-3). Two formats, nothing sent:
   - OSM Note text: copy `map.noteText` ("Missing bench here, seen Oct 11, 2026. Suggested tags: amenity=bench, backrest=yes, seats=2. Drafted with Flare and checked by a person on site.") plus the position to 6 decimals, for the person to paste into a Note on the OSM site themselves.
   - `.osm` file (API 0.6 XML) with one new node (`id="-1"`, `action="modify"`), the thing's primary tag (`amenity=…` or `highway=steps`) and the reviewed tags, XML-escaped, for JOSM.
6. The share sheet (FE) hands either to the person. Publishing anything to OSM waits for the founder.

## No openstreetmap.org requests

The module has no network code at all; the drafter is injected. `scripts/test/map-fixmap.test.ts` scans every file in `lib/map` and `lib/compass` for an openstreetmap.org URL, and the loader tests record every host contacted (overpass-api.de, api.weather.gov and `/maps/` only).

## Gaps

- `highway` and `leisure` are not on the allow-list, so a draft can't say `highway=steps` or `leisure=picnic_table`. The export adds `highway=steps` from the person's own choice of thing; picnic tables can't be drafted. Change request to Product in the handoff.
- There is no AsyncAPI job for tag drafts yet (ML5); `ask` is the seam.
