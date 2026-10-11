// Map pack v2 (ICD-6 MapPack): build from Overpass results, validate, and decode to places.
// Format spec: docs/maps/02-pack-format.md.
import type { Kind, LatLon, MapPack, Place } from "@flare/shared/icd/map";
import { bearingDeg, destination, distanceM, round5 } from "./geo.ts";
import type { OverpassElement, OverpassGeom, OverpassResult } from "./overpass.ts";

export const PACK_VERSION = 2;
export const MAX_AGE_MS = 7 * 24 * 3600 * 1000; // SRS-IF-4
export const STREET_STEP_M = 25;
export const OUTLINE_STEP_M = 50;
export const ATTRIBUTION = "Map data © OpenStreetMap contributors, ODbL 1.0. openstreetmap.org/copyright";

/** One-letter codes keep the pack small. */
export const KIND_CODES: Record<string, Kind> = {
  b: "bench",
  p: "picnic_table",
  t: "toilets",
  d: "drinking_water",
  s: "steps",
  h: "shelter",
  v: "viewpoint",
  k: "park",
  w: "water",
  f: "wood",
  r: "street",
};
const CODE_OF = Object.fromEntries(Object.entries(KIND_CODES).map(([c, k]) => [k, c])) as Record<Kind, string>;

/** Tags kept on points. Everything else is dropped to save bytes and avoid surprises. */
export const KEEP_TAGS = [
  "name",
  "access",
  "wheelchair",
  "toilets:wheelchair",
  "backrest",
  "fee",
  "opening_hours",
  "covered",
  "indoor",
] as const;

type Item = MapPack["items"][number];

export function osmId(e: Pick<OverpassElement, "type" | "id">): string {
  return `${e.type[0]}${e.id}`;
}

function pickTags(tags: Record<string, string> | undefined): Record<string, string> | 0 {
  if (!tags) return 0;
  const out: Record<string, string> = {};
  for (const k of KEEP_TAGS) if (tags[k] !== undefined) out[k] = tags[k];
  return Object.keys(out).length ? out : 0;
}

/** Kind for an element from query 1 or the point part of query 2. */
export function pointKind(tags: Record<string, string>): Kind | null {
  if (tags.amenity === "bench") return "bench";
  if (tags.leisure === "picnic_table") return "picnic_table";
  if (tags.amenity === "toilets") return "toilets";
  if (tags.amenity === "drinking_water") return "drinking_water";
  if (tags.highway === "steps") return "steps";
  if (tags.amenity === "shelter") return "shelter";
  if (tags.tourism === "viewpoint") return "viewpoint";
  if (tags.leisure === "park") return "park";
  return null;
}

/** Kind for a named feature sampled along its geometry (query 2, second part). */
export function lineKind(tags: Record<string, string>): Kind | null {
  if (!tags.name) return null;
  if (tags.natural === "water" || tags.waterway) return "water";
  if (tags.natural === "wood" || tags.landuse === "forest") return "wood";
  if (tags.leisure === "park") return "park";
  if (tags.highway) return "street";
  return null;
}

function elementPoint(e: OverpassElement): LatLon | null {
  if (e.lat !== undefined && e.lon !== undefined) return { lat: e.lat, lon: e.lon };
  if (e.center) return { lat: e.center.lat, lon: e.center.lon };
  return null;
}

/** Points every `step` metres along a polyline, including both ends. */
export function samplePolyline(line: LatLon[], step: number): LatLon[] {
  if (line.length === 0) return [];
  const first = line[0] as LatLon;
  const out: LatLon[] = [first];
  let carry = 0; // metres walked since the last emitted point
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1] as LatLon;
    const b = line[i] as LatLon;
    const seg = distanceM(a, b);
    if (seg === 0) continue;
    const brg = bearingDeg(a, b);
    let pos = step - carry;
    while (pos <= seg) {
      out.push(destination(a, brg, pos));
      pos += step;
    }
    carry = seg - (pos - step);
  }
  const last = line[line.length - 1] as LatLon;
  const tail = out[out.length - 1] as LatLon;
  if (distanceM(tail, last) > step / 4) out.push(last);
  return out;
}

function lines(e: OverpassElement): LatLon[][] {
  const clean = (g: (OverpassGeom | null)[]) => g.filter((p): p is OverpassGeom => p !== null);
  if (e.geometry) return [clean(e.geometry)];
  if (e.members) return e.members.filter((m) => m.geometry).map((m) => clean(m.geometry ?? []));
  const p = elementPoint(e);
  return p ? [[p]] : [];
}

export type BuildInput = {
  area: string;
  center: [number, number];
  radius_m: number;
  pinned: OverpassResult;
  extra: OverpassResult;
  /** Build time; the pack is refused when osm_base is older than 7 days at this time. */
  now?: Date;
};

export class PackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PackError";
  }
}

/** Build pack v2. Deterministic for the same input: items sorted by kind, osm id, then position. */
export function buildPack(input: BuildInput): MapPack {
  const base = input.pinned.osm3s?.timestamp_osm_base;
  if (!base) throw new PackError("Overpass result has no timestamp_osm_base");
  const now = input.now ?? new Date();
  const age = now.getTime() - Date.parse(base);
  if (!(age <= MAX_AGE_MS)) throw new PackError(`OSM data is older than 7 days (${base})`);

  const centre: LatLon = { lat: input.center[0], lon: input.center[1] };
  const inside = (p: LatLon) => distanceM(centre, p) <= input.radius_m;
  const items: Item[] = [];
  const seen = new Set<string>();
  const add = (kind: Kind, p: LatLon, id: string, tags: Record<string, string> | 0) => {
    const lat = round5(p.lat);
    const lon = round5(p.lon);
    const key = `${CODE_OF[kind]}|${id}|${lat}|${lon}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push([CODE_OF[kind], lat, lon, id, tags]);
  };

  const pointFrom = (res: OverpassResult) => {
    for (const e of res.elements) {
      const tags = e.tags ?? {};
      const kind = pointKind(tags);
      if (!kind) continue;
      // Points from query 2's geometry part are handled below; a way with geometry has no center.
      const p = elementPoint(e);
      if (!p) continue;
      add(kind, p, osmId(e), pickTags(tags));
    }
  };
  pointFrom(input.pinned);
  pointFrom({ elements: input.extra.elements.filter((e) => !e.geometry && !e.members) });

  for (const e of input.extra.elements) {
    if (!e.geometry && !e.members) continue;
    const tags = e.tags ?? {};
    const kind = lineKind(tags);
    if (!kind) continue;
    const id = osmId(e);
    const step = kind === "street" ? STREET_STEP_M : OUTLINE_STEP_M;
    // Streets keep only the name; nature and parks keep the usual tags.
    const t = kind === "street" ? { name: tags.name as string } : pickTags(tags);
    let first = true;
    for (const line of lines(e)) {
      for (const p of samplePolyline(line, step)) {
        if (!inside(p)) continue;
        add(kind, p, id, first ? t : 0);
        first = false;
      }
    }
  }

  items.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[3] < b[3] ? -1 : a[3] > b[3] ? 1 : 0));
  return {
    v: 2,
    area: input.area,
    center: input.center,
    radius_m: input.radius_m,
    osm_base: base,
    attribution: ATTRIBUTION,
    kinds: KIND_CODES,
    items,
  };
}

/** Throws PackError unless `x` is a well-formed pack v2. */
export function validatePack(x: unknown): MapPack {
  const p = x as MapPack;
  if (!p || typeof p !== "object") throw new PackError("Pack is not an object");
  if (p.v !== PACK_VERSION) throw new PackError(`Unsupported pack version ${String(p.v)}`);
  if (typeof p.area !== "string" || !Array.isArray(p.center) || typeof p.radius_m !== "number")
    throw new PackError("Pack header is incomplete");
  if (typeof p.osm_base !== "string" || Number.isNaN(Date.parse(p.osm_base)))
    throw new PackError("Pack has no osm_base");
  if (!p.attribution?.includes("OpenStreetMap")) throw new PackError("Pack has no ODbL attribution");
  if (!Array.isArray(p.items)) throw new PackError("Pack has no items");
  for (const it of p.items) {
    if (
      !Array.isArray(it) ||
      it.length !== 5 ||
      !p.kinds[it[0]] ||
      typeof it[1] !== "number" ||
      typeof it[2] !== "number"
    )
      throw new PackError("Pack has a malformed item");
  }
  return p;
}

const decoded = new WeakMap<MapPack, Place[]>();

/** All places in the pack. Points after the first of one osm id inherit its tags. Cached per pack. */
export function places(pack: MapPack): Place[] {
  const hit = decoded.get(pack);
  if (hit) return hit;
  const tagsOf = new Map<string, Record<string, string>>();
  const out: Place[] = [];
  for (const [code, lat, lon, id, t] of pack.items) {
    const kind = pack.kinds[code];
    if (!kind) continue;
    let tags = t === 0 ? tagsOf.get(id) : t;
    if (t !== 0) tagsOf.set(id, t);
    tags ??= {};
    out.push({ kind, lat, lon, osm_id: id, name: tags.name ?? null, tags });
  }
  decoded.set(pack, out);
  return out;
}

/** Counts of distinct OSM elements per kind, for checks against the evidence counts. */
export function countByKind(pack: MapPack): Record<Kind, number> {
  const ids = new Map<Kind, Set<string>>();
  for (const p of places(pack)) {
    const s = ids.get(p.kind) ?? new Set<string>();
    ids.set(p.kind, s);
    s.add(p.osm_id);
  }
  const out = {} as Record<Kind, number>;
  for (const k of Object.values(KIND_CODES)) out[k] = ids.get(k)?.size ?? 0;
  return out;
}

/** True when the pack's OSM data is younger than 7 days at `now`. */
export function isFresh(pack: MapPack, now: Date = new Date()): boolean {
  return now.getTime() - Date.parse(pack.osm_base) <= MAX_AGE_MS;
}
