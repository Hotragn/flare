# ADR-0010: Offline first: service worker, static map pack, outbox

Status: Accepted. Date: 2026-10-10. Implements SRS-OFF-1 to SRS-OFF-5 and SRS-IF-4. Details in [07-offline-sync-and-ai.md](../07-offline-sync-and-ai.md).

## Decision
- **App shell** precached by SvelteKit's built-in service worker (`src/service-worker.ts`, `$service-worker` manifest). No Workbox: the built-in one covers precache plus two runtime rules and adds 0 KB of library.
- **Map pack** `static/maps/fairlane.json` (6.7 KB, 1.8 KB brotli; 128 features within 3 km; pinned Overpass result of 2026-10-10 17:07 UTC) precached with the shell. Phones never call Overpass live: lab 05 saw only overpass-api.de answer, mirrors 500 or 504, and 406 for default User-Agents. A build script refreshes the pack with a User-Agent and checks `timestamp_osm_base` is under 7 days old.
- **Saved Lit data** (SRS-OFF-1) in IndexedDB: spot, compass target, access line, host line, nature line, state time. Deleted when the phone learns Gone or 24 h after Lit.
- **Outbox** in IndexedDB: `{idem_key, method, path, body, recorded_at}`. Every write goes through it. Sent in order on `online`, on page show, and every 15 s while visible; removed on any 2xx or 4xx; kept 24 h. Server idempotency keys make retries safe (SRS-REL-2).
- **Offline photo**: the host types six words with map-pack chips; no model (ADR-0007).

## Consequences
- Background Sync is not used: Safari doesn't support it. Taps queued while the app is closed go out the next time it opens.
- A friend who never opened the link online can't open it offline; the plain-text form (ADR-0012) covers them.
