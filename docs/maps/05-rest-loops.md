# Bench to Bench: walking loops with rest stops

SRS-REST-2 to -6. Code: `apps/web/src/lib/map/{paths,loop,card}.ts`. Input comes from ODAI's rest-loop parser (OD5).

```ts
type LoopRequest = { minutes: number; rest_gap_m: 100 | 200 | 400; avoid_steps: boolean; prefer?: ("trees" | "water" | "quiet")[] };
const paths = await loadPathsNear(spot);              // null outside a bundled area
const r = buildLoop(pack, paths, spot, req, spotName); // { ok: true, loop } | { ok: false, message, next_gap_m }
const pdf = cardPdf(r.loop, spotName);                 // Uint8Array, application/pdf
const stop = speakTurns(r.loop.turns);                 // reads the turns aloud
```

## How a loop is found

1. Graph: the paths pack (02-pack-format.md). Private and no-access ways are not in it. With `avoid_steps`, steps edges are skipped.
2. Rests: the start (people gather there) plus every usable bench and picnic table within reach, snapped to the nearest graph node within 25 m.
3. Rest graph: from each rest, shortest walking paths to other rests no longer than the gap.
4. Search: depth-first over the rest graph for a cycle back to the start whose length is within ±20% of `minutes × 50 m` (3 km/h). Prunes any branch that can't get home inside +20%. At most 20,000 expansions. Score = length error + share of path walked twice − 0.3 × share on preferred ground (near named water, woods or parks, or off-road paths for "quiet"). Lowest score wins.
5. Turns: "Start at {place}." Left or right at junctions with a turn of 40° or more (bearings over 20 m, at least 30 m since the last line), each with "Bench in {m} m"; "Straight past the bench" when a bench is passed with no turn; "Restroom/Water on your {side}" within 30 m; "Back at {place}. That's the loop."
6. No loop: "No loop keeps benches that close. Try {next} m?" (100 → 200 → 400); at 400 m only the first sentence. No loop is shown (SRS-REST-4).

## Proof on the Fairlane pack

| Start | Ask | Result | Time (Node, M-series Mac) |
| --- | --- | --- | --- |
| Village Green | 20 min, 200 m | 1,021 m, 20 min, 9 rests, longest gap 152 m | 194 ms |
| Village Green | 40 min, 200 m | 1,608 m, 32 min (inside −20%), 12 rests, longest gap 199 m | 18 ms |
| Village Green | 40 min, 400 m, trees | 2,015 m, 40 min, 11 rests, longest gap 318 m | 697 ms |
| Village Green | 60 min, 200 m | No loop. Try 400 m? | 7 ms |
| Wagner Park, Fair Lane Lake, Rotunda Drive, the mall | any | No loop | under 40 ms |

Most of Fairlane's 54 mapped benches sit in clusters (12 within 30 m at Wagner Park), so loops exist only where benches are spread along paths, mainly Greenfield Village. That is the data, not a bug; Fix the map is how it improves.

Tests (`scripts/test/map-loop.test.ts`): on the real pack, every loop starts and ends at the spot, uses only graph edges, keeps every gap between consecutive rests within the limit (measured by walking the path), and is within ±20%; on a synthetic grid: no retracing, gap failure, steps avoidance, parking aisles dropped.

## Large-print card (SRS-REST-5)

A PDF 1.4 written by `cardPdf` with no dependencies: US Letter, 0.75 in margins, Helvetica. Title 30 pt bold, body 20 pt, attribution 18 pt; black on white (21:1). Lines: title "{min} min loop from {place}", "{min} min · {km} km · {n} benches", numbered turns with bench distances, restrooms and water, then "Check the path. Map data can be wrong." in bold and the ODbL line. Wrapped lines keep a hanging indent; pages break between lines. A 20-minute loop is 2 pages, 3.1 KB.

Tests check the xref offsets, that every text run is 18 pt or more, no grey text, contrast ≥ 7:1, numbered turns, bench distances, the warning and attribution. The FE offers it with a download link (`Blob`, `application/pdf`) and the button "Print card".

## Spoken turns (SRS-REST-6)

`speakTurns` queues "1. Start at …", "2. …" with Web Speech at rate 0.9; the returned function stops it ("Stop reading").

## Limits

- Loops work inside bundled areas only (v1): the walking network is too heavy to fetch per cell on a phone. Elsewhere the UI says there is no loop.
- OSM sidewalks are partly mapped; a loop may follow a road where the sidewalk is a separate, unconnected way.
