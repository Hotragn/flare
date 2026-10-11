# ADR-0029: Crew Atlas, your crew's places drawn on the phone

Status: Accepted (Sun 2026-10-11).

## Context
The backlog (#9) asked for a Crew Atlas: the crew's outings, Sparks and Hot spots as a private map of its places, with facts that come only from data. The crew's places live in the sealed Hot spots blob, which only members' phones can open. Each entry has the place key (an OSM id from the map pack), the name, how many times the crew met there and the last day, and no coordinates.

## Decision
- **Drawing.** The Atlas is drawn on the phone (`lib/components/CrewAtlas.svelte`) at the top of the Crew space, when the crew has places.
  - **Positions** come from the map pack already on the phone: `place_key` → `items[3]` → lat and lon. Typed places with no OSM id are listed but not drawn.
  - **Context** comes from the same pack: water, woods, parks, streets and benches inside the box, at most 1,200 points.
  - **Nothing is fetched for it.** There are no map tiles and no requests, so where the crew meets never leaves the phone. The only network use is the pack file, which the app already loads.
- **Facts only from data.** "Met once · Oct 11" or "Met 3 times · last Oct 4", from the blob's count and last day. Dot size grows with the count, at 6 + 3·log2(count) px.
- **No AI caption.** The backlog imagined Gemma writing the Atlas. Gemma runs on the hub, so a written caption would mean sending the crew's decrypted places off the phone, which breaks the Hot spots promise (BR-K-6). The facts read just as well from templates, so we left the model out.
- **Accessibility.** The SVG is `role="img"` with a label ("Map of 3 places your crew met"), and the list of facts underneath carries the same information as text.
- **Budget.** The component and the map module load on demand from the Crew page.

## Tests
`apps/web/test/e2e/sparks.ts` runs on the real stack. It creates a real Hot spot: a Flare lights, a friend arrives, and the host ends it. The Crew page then shows the Atlas with "West Road · Met once · Oct 11" (`docs/frontend/evidence/e2e-crew-atlas.png`).

## Consequences
- The crew gets a map of where it goes outside, private by construction.
- When a crew uses more than one map pack, the Atlas draws the places found in the pack named by `area`, which is Fairlane by default.
