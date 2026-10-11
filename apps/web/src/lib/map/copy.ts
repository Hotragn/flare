// The copy-deck strings the map module renders itself (nature line, compass speech, rest
// loop card). Values are copied word for word from design/prototype/src/lib/copy/deck.json;
// scripts/test/map-copy.test.ts fails if they drift.
export const MAP_COPY = {
  "nature.sunset": "Sunset {time}",
  "nature.feature": "By {name}",
  "nature.season": "Week {n} of {season}",
  "nature.season.spring": "spring",
  "nature.season.summer": "summer",
  "nature.season.fall": "fall",
  "nature.season.winter": "winter",
  "compass.spoken": "{name}, {meters} meters, {direction}.",
  "compass.spokenKm": "{name}, {km} kilometers, {direction}.",
  "compass.spokenNoDir": "{name}, {meters} meters.",
  "compass.ahead": "{name} is straight ahead.",
  "compass.dir.ahead": "straight ahead",
  "compass.dir.slightLeft": "slightly left",
  "compass.dir.slightRight": "slightly right",
  "compass.dir.left": "to your left",
  "compass.dir.right": "to your right",
  "compass.dir.behind": "behind you",
  "loop.none": "No loop keeps benches that close.",
  "loop.tryNext": "Try {m} m?",
  "loop.warn": "Check the path. Map data can be wrong.",
  "loop.card.title": "{min} min loop from {place}",
  "loop.summary": "{min} min · {km} km · {n} benches",
  "loop.turn.start": "Start at {place}.",
  "loop.turn.left": "Left on {path}. Bench in {m} m.",
  "loop.turn.right": "Right at {landmark}. Bench in {m} m.",
  "loop.turn.straight": "Straight past {landmark}. Bench in {m} m.",
  "loop.turn.restroom": "Restroom on your {side}.",
  "loop.turn.water": "Water on your {side}.",
  "loop.turn.end": "Back at {place}. That's the loop.",
  "loop.path.unnamed": "the path",
  "loop.landmark.corner": "the corner",
  "loop.landmark.bench": "the bench",
  "loop.side.left": "left",
  "loop.side.right": "right",
  "map.noteText":
    "Missing {thing} here, seen {date}. Suggested tags: {tags}. Drafted with Flare and checked by a person on site.",
  "map.thing.bench": "bench",
  "map.thing.toilets": "restroom",
  "map.thing.drinking_water": "drinking fountain",
  "map.thing.steps": "steps",
  "site.foot.osm": "Map data © OpenStreetMap contributors.",
} as const;

export type MapCopyKey = keyof typeof MAP_COPY;

/** Fill `{name}` slots. Unknown slots stay as written so a missing value is visible in tests. */
export function fmt(key: MapCopyKey, vars: Record<string, string | number> = {}): string {
  return MAP_COPY[key].replace(/\{(\w+)\}/g, (m, n: string) => (n in vars ? String(vars[n]) : m));
}
