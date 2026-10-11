// Place functions over a map pack (ICD-6). Pure, deterministic, no network, no model
// (SRS-ACC-6). Rules: docs/requirements/03-business-rules.md (BR-A-2, BR-C-7, BR-E-1).
import type { AccessLine, Kind, LatLon, MapPack, Needs, Place } from "@flare/shared/icd/map";
import { distanceM, distanceToSegmentM } from "./geo.ts";
import { places } from "./pack.ts";

export const NAME_RADIUS_M = 150; // SRS-CRE-3
export const STREET_RADIUS_M = 300; // past this, "the street name" would mislead; nameSpot returns null
export const EMBER_RADIUS_M = 400; // BR-E-1
export const EMBER_MAX = 12;
export const ACCESS_RADIUS_M = 200; // SRS-ACC-2
export const STEPS_SPOT_M = 50; // BR-A-2
export const STEPS_LINE_M = 20; // BR-A-2
export const RESTROOM_M = 300; // BR-A-2
export const WALK_M_PER_MIN = 4800 / 60; // BR-C-7: 4.8 km/h
export const WALK_DETOUR = 1.3; // BR-C-7

/** Seats: where a person can rest. Benches and picnic tables (BR-E-1 treats them alike). */
export const SEAT_KINDS: ReadonlySet<Kind> = new Set<Kind>(["bench", "picnic_table"]);
/** Named features that can name a spot, before falling back to the street. */
const NAMING_KINDS: ReadonlySet<Kind> = new Set<Kind>([
  "park",
  "water",
  "wood",
  "shelter",
  "viewpoint",
  "bench",
  "picnic_table",
]);

/** Places a person can't use: mapped access=private or access=no. */
export function isUsable(p: Place): boolean {
  const a = p.tags.access;
  return a !== "private" && a !== "no";
}

/** Places of the given kinds within `radius` metres, nearest first, with their distance. */
export function near(
  pack: MapPack,
  at: LatLon,
  kinds: ReadonlySet<Kind>,
  radius: number,
): { place: Place; m: number }[] {
  const out: { place: Place; m: number }[] = [];
  // Cheap box test before the haversine: 1° lat is about 111 km.
  const dLat = radius / 111_000 + 1e-6;
  const dLon = dLat / Math.max(0.01, Math.cos((at.lat * Math.PI) / 180));
  for (const p of places(pack)) {
    if (!kinds.has(p.kind)) continue;
    if (Math.abs(p.lat - at.lat) > dLat || Math.abs(p.lon - at.lon) > dLon) continue;
    const m = distanceM(at, p);
    if (m <= radius) out.push({ place: p, m });
  }
  out.sort((a, b) => a.m - b.m || (a.place.osm_id < b.place.osm_id ? -1 : 1));
  return out;
}

/** Nearest per OSM element: one entry per osm_id (outlines and streets have many points). */
function distinct(list: { place: Place; m: number }[]): { place: Place; m: number }[] {
  const seen = new Set<string>();
  return list.filter(({ place }) => {
    if (seen.has(place.osm_id)) return false;
    seen.add(place.osm_id);
    return true;
  });
}

/**
 * SRS-CRE-3: the nearest named feature within 150 m, else the nearest street name (within
 * 300 m), else null. `key` is the OSM id, stable across rebuilds. Coordinates are never part of the name.
 */
export function nameSpot(pack: MapPack, at: LatLon): { name: string; key: string } | null {
  const named = near(pack, at, NAMING_KINDS, NAME_RADIUS_M).find(({ place }) => place.name && isUsable(place));
  if (named?.place.name) return { name: named.place.name, key: named.place.osm_id };
  const street = near(pack, at, new Set<Kind>(["street"]), STREET_RADIUS_M).find(({ place }) => place.name);
  if (street?.place.name) return { name: street.place.name, key: street.place.osm_id };
  return null;
}

/** BR-E-1: usable benches and picnic tables within 400 m of the spot, nearest first, at most 12. */
export function emberCandidates(pack: MapPack, spot: LatLon): Place[] {
  return distinct(near(pack, spot, SEAT_KINDS, EMBER_RADIUS_M))
    .filter(({ place }) => isUsable(place))
    .slice(0, EMBER_MAX)
    .map(({ place }) => place);
}

/** BR-C-7: straight-line distance × 1.3 at 4.8 km/h, in minutes (not rounded). */
export function walkMinutes(from: LatLon, to: LatLon): number {
  return (distanceM(from, to) * WALK_DETOUR) / WALK_M_PER_MIN;
}

function nearest(pack: MapPack, at: LatLon, kinds: ReadonlySet<Kind>, radius: number) {
  const list = distinct(near(pack, at, kinds, radius)).filter(({ place }) => isUsable(place));
  return { count: list.length, nearest_m: list[0] ? Math.round(list[0].m) : null };
}

/** Steps (highway=steps) within 50 m of the place: drives "Steps mapped" (BR-A-4) and BR-A-2. */
export function stepsNear(pack: MapPack, place: LatLon): boolean {
  return near(pack, place, new Set<Kind>(["steps"]), STEPS_SPOT_M).length > 0;
}

/**
 * SRS-ACC-2: counts and nearest distance within 200 m. Benches count benches and picnic
 * tables. Restrooms skip access=private/no. `steps_mapped` uses BR-A-2's 50 m so the line
 * and the needs check never disagree.
 */
export function accessLine(pack: MapPack, place: LatLon): AccessLine {
  return {
    benches: nearest(pack, place, SEAT_KINDS, ACCESS_RADIUS_M),
    restrooms: nearest(pack, place, new Set<Kind>(["toilets"]), ACCESS_RADIUS_M),
    water: nearest(pack, place, new Set<Kind>(["drinking_water"]), ACCESS_RADIUS_M),
    steps_mapped: stepsNear(pack, place),
  };
}

/** Which BR-A-2 clauses fail; empty when the place suits. Runs on the phone only. */
export function failedNeeds(
  pack: MapPack,
  needs: Needs,
  from: LatLon | null,
  place: LatLon,
): ("steps" | "rest" | "restroom")[] {
  const out: ("steps" | "rest" | "restroom")[] = [];
  if (needs.avoid_steps) {
    let fail = stepsNear(pack, place);
    if (!fail && from) {
      // Steps within 20 m of the straight line from the person to the spot. Pre-filter to
      // steps inside a box around the segment plus 20 m.
      const span = distanceM(from, place) / 2 + STEPS_LINE_M;
      const mid = { lat: (from.lat + place.lat) / 2, lon: (from.lon + place.lon) / 2 };
      fail = near(pack, mid, new Set<Kind>(["steps"]), span + 1).some(
        ({ place: s }) => distanceToSegmentM(s, from, place) <= STEPS_LINE_M,
      );
    }
    if (fail) out.push("steps");
  }
  if (needs.rest_gap_m !== null) {
    const seat = nearest(pack, place, SEAT_KINDS, needs.rest_gap_m);
    if (seat.count === 0) out.push("rest");
  }
  if (needs.restroom_300m && nearest(pack, place, new Set<Kind>(["toilets"]), RESTROOM_M).count === 0)
    out.push("restroom");
  return out;
}

/** BR-A-2 for one person and one place: true when the place passes every need. */
export function checkNeeds(pack: MapPack, needs: Needs, from: LatLon | null, place: LatLon): boolean {
  return failedNeeds(pack, needs, from, place).length === 0;
}

/** Nearest seat in metres from the place, any distance up to 3 km; for "Nearest bench {m} m". */
export function nearestSeatM(pack: MapPack, place: LatLon): number | null {
  return nearest(pack, place, SEAT_KINDS, 3000).nearest_m;
}

const KIND_WORD: Partial<Record<Kind, string>> = {
  bench: "bench",
  picnic_table: "picnic table",
  shelter: "shelter",
  viewpoint: "viewpoint",
  drinking_water: "fountain",
  park: "park",
  water: "water",
  wood: "woods",
  steps: "steps",
};

/**
 * Words for the typed six-word chips when the hub is out (ADR-0007): the spot's name, other
 * named features within 200 m, then plain nouns for what is mapped within 100 m. At most 8,
 * lower-case nouns, no duplicates.
 */
export function placeWords(pack: MapPack, place: LatLon): string[] {
  const words: string[] = [];
  const push = (w: string | null | undefined) => {
    if (!w) return;
    if (!words.some((x) => x.toLowerCase() === w.toLowerCase())) words.push(w);
  };
  push(nameSpot(pack, place)?.name);
  const all = new Set<Kind>(Object.keys(KIND_WORD) as Kind[]);
  for (const { place: p } of distinct(near(pack, place, all, ACCESS_RADIUS_M))) {
    if (p.name && p.kind !== "bench") push(p.name);
  }
  for (const { place: p } of distinct(near(pack, place, all, 100))) push(KIND_WORD[p.kind]);
  return words.slice(0, 8);
}
