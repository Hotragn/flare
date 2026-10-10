# ADR-0009: No coordinates or readable places on the server

Status: Accepted. Date: 2026-10-10. Adopts OQ-1 (handoff 02) as variant B and supersedes analyst decision 10 (DS1 `spot` with `lat`, `lon`).

## Context
The founder asked that the server not hold spot coordinates. The data dictionary had `spot {place_key, name_ct, lat, lon}`, `ember_spot {bench_osm_id, lat, lon}`, Plan ladder places with `lat, lon`, and DS11 live locations in plain `lat, lon`. The server used coordinates for two jobs: choosing the Ember bench (BR-E-1) and the compass target.

## Decision
1. **The phone picks the candidates.** At send time the host's phone runs the BR-E-1 search on its map pack: benches and picnic tables within 400 m, nearest first, at most 12. It seals their names and coordinates into the gathering blob.
2. **The server sees labels, not places.** The server gets `ember_candidates: ["c1", ..., "cN"]` in distance order. Phones report pass or fail per label (BR-E-3). At Ember the server picks the first label that passed for every yes and every "Ember only" yes (BR-E-1), or `spot` if none did (BR-E-2), and sends only the label.
3. **OSM ids are not sent either.** The analyst's proposal kept "candidate OSM ids" on the server, but an OSM node id resolves to exact coordinates with one public API call (`api.openstreetmap.org/api/0.6/node/{id}`). Opaque per-gathering labels close that gap (BUG-023).
4. **Plans the same way:** steps carry `place: "step:1"` to `"step:4"`; names and coordinates are sealed.
5. **Live location sealed:** `location_ct` (DS11) is ciphertext; the server stores it overwritten in place and deletes it at Gone.
6. **The compass works from the sealed blob,** saved on the phone at Lit (SRS-OFF-1).
7. **Schema test:** `apps/server/test/db.test.ts` fails if any table outside the counters has a column named `lat`, `lon`, `latitude`, `longitude`, `spot`, `place_name` or `name`.

## Consequences
- The copy deck's `privacy.coords` variant switches from A to B (done in this phase; the website and privacy statement follow).
- The server cannot check "within 400 m" itself; a host's phone with a modified client could send far candidates. Acceptable: the host chooses the place anyway.
- If no phone reports within 60 s of Ember, all candidates count as pass (BR-E-4) and `c1`, the nearest bench, wins.
- Telegram groups are the disclosed exception: the place name is in the bot post (ADR-0013). Coordinates never are.
