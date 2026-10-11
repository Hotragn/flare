// Fix the map (MP7, SRS-MAP-1 to -4): draft OSM tags from a photo, review every tag, export
// OSM Note text or an .osm file. The app never contacts any openstreetmap.org host; the person
// posts the export themselves (publishing waits for the founder). Spec: docs/maps/06-fix-the-map.md.
import type { LatLon } from "@flare/shared/icd/map";
import { fmt } from "./copy.ts";

/** E17-S1 AC1: the only keys a draft may carry (BR-AI-4). */
export const ALLOW_KEYS = [
  "amenity",
  "backrest",
  "material",
  "seats",
  "wheelchair",
  "fee",
  "access",
  "opening_hours",
  "drinking_water",
  "step_count",
  "handrail",
  "covered",
  "lit",
] as const;
export type AllowKey = (typeof ALLOW_KEYS)[number];

const YES_NO = /^(yes|no)$/;
/** Value rules per key. Anything else is dropped from a draft. */
const VALUE: Record<AllowKey, RegExp> = {
  amenity: /^(bench|toilets|drinking_water|shelter|waste_basket)$/,
  backrest: YES_NO,
  material: /^(wood|metal|stone|concrete|plastic|brick)$/,
  seats: /^[1-9]\d?$/,
  wheelchair: /^(yes|no|limited)$/,
  fee: YES_NO,
  access: /^(yes|no|private|customers|permissive)$/,
  opening_hours: /^[\w :;,+\-/]{1,80}$/,
  drinking_water: YES_NO,
  step_count: /^[1-9]\d{0,2}$/,
  handrail: YES_NO,
  covered: YES_NO,
  lit: YES_NO,
};

export type Thing = "bench" | "toilets" | "drinking_water" | "steps";

export type Tag = { key: AllowKey; value: string };

/** Keep only allow-listed keys with valid values, first value per key, sorted by allow-list order. */
export function sanitize(raw: unknown): Tag[] {
  const out = new Map<AllowKey, string>();
  const entries: [unknown, unknown][] = Array.isArray(raw)
    ? raw.map((t) => [(t as Tag)?.key, (t as Tag)?.value])
    : raw && typeof raw === "object"
      ? Object.entries(raw)
      : [];
  for (const [k, v] of entries) {
    if (typeof k !== "string" || typeof v !== "string") continue;
    const key = k.trim().toLowerCase() as AllowKey;
    const value = v.trim();
    if (!(ALLOW_KEYS as readonly string[]).includes(key) || out.has(key)) continue;
    if (VALUE[key].test(value)) out.set(key, value);
  }
  return ALLOW_KEYS.filter((k) => out.has(k)).map((k) => ({ key: k, value: out.get(k) as string }));
}

export function isValid(tag: Tag): boolean {
  return (ALLOW_KEYS as readonly string[]).includes(tag.key) && VALUE[tag.key].test(tag.value);
}

/**
 * SRS-MAP-4: send the photo to the drafter (the hub, through the server), then zero the bytes
 * whatever happens. The photo is never stored and never part of an export.
 */
export async function draftFromPhoto(photo: Uint8Array, ask: (photo: Uint8Array) => Promise<unknown>): Promise<Tag[]> {
  try {
    return sanitize(await ask(photo));
  } catch {
    return []; // The manual tag picker takes over (ADR-0007).
  } finally {
    photo.fill(0);
  }
}

export type Reviewed = Tag & { status: "pending" | "keep" | "change" | "remove"; original: string };

export type Review = { thing: Thing; at: LatLon; seen: Date; tags: Reviewed[] };

export function startReview(thing: Thing, at: LatLon, tags: Tag[], seen: Date = new Date()): Review {
  return { thing, at, seen, tags: tags.map((t) => ({ ...t, status: "pending", original: t.value })) };
}

function set(r: Review, key: AllowKey, patch: Partial<Reviewed>): Review {
  return { ...r, tags: r.tags.map((t) => (t.key === key ? { ...t, ...patch } : t)) };
}

export const keep = (r: Review, key: AllowKey) => set(r, key, { status: "keep" });
export const remove = (r: Review, key: AllowKey) => set(r, key, { status: "remove" });
/** Change a value. Invalid values throw so the UI can show the field error. */
export function change(r: Review, key: AllowKey, value: string): Review {
  if (!isValid({ key, value: value.trim() })) throw new RangeError(`Not a valid ${key} value`);
  return set(r, key, { status: "change", value: value.trim() });
}

/** SRS-MAP-2: count of tags still to check ("{n} tags left to check"). */
export const left = (r: Review) => r.tags.filter((t) => t.status === "pending").length;
/** Export stays disabled until every tag is reviewed and at least one survives. */
export const canExport = (r: Review) => left(r) === 0 && final(r).length > 0;

/** Tags the person kept or changed, in allow-list order. */
export function final(r: Review): { key: string; value: string }[] {
  const kept = r.tags
    .filter((t) => t.status === "keep" || t.status === "change")
    .map(({ key, value }) => ({ key, value }));
  return kept;
}

function primary(thing: Thing): { key: string; value: string } {
  return thing === "steps" ? { key: "highway", value: "steps" } : { key: "amenity", value: thing };
}

/** Tags for the export: the thing's primary tag first (from the person's own choice), then the reviewed ones. */
export function exportTags(r: Review): { key: string; value: string }[] {
  const p = primary(r.thing);
  return [p, ...final(r).filter((t) => t.key !== p.key)];
}

const THING_KEY = {
  bench: "map.thing.bench",
  toilets: "map.thing.toilets",
  drinking_water: "map.thing.drinking_water",
  steps: "map.thing.steps",
} as const;

export class NotReviewed extends Error {
  constructor() {
    super("Review every tag before export");
    this.name = "NotReviewed";
  }
}

/** OSM Note text: the description (copy deck map.noteText) plus the location line. */
export function noteExport(r: Review): { text: string; lat: number; lon: number } {
  if (!canExport(r)) throw new NotReviewed();
  const date = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(r.seen);
  const tags = exportTags(r)
    .map((t) => `${t.key}=${t.value}`)
    .join(", ");
  const lat = Math.round(r.at.lat * 1e6) / 1e6;
  const lon = Math.round(r.at.lon * 1e6) / 1e6;
  return { text: fmt("map.noteText", { thing: fmt(THING_KEY[r.thing]), date, tags }), lat, lon };
}

const xml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/** An .osm (API 0.6 XML) file with one new node, for JOSM. Negative id = not yet uploaded. */
export function osmExport(r: Review): string {
  if (!canExport(r)) throw new NotReviewed();
  const tags = exportTags(r)
    .map((t) => `    <tag k="${xml(t.key)}" v="${xml(t.value)}"/>`)
    .join("\n");
  const lat = (Math.round(r.at.lat * 1e7) / 1e7).toFixed(7);
  const lon = (Math.round(r.at.lon * 1e7) / 1e7).toFixed(7);
  return `<?xml version="1.0" encoding="UTF-8"?>
<osm version="0.6" generator="Flare">
  <node id="-1" action="modify" visible="true" lat="${lat}" lon="${lon}">
${tags}
  </node>
</osm>
`;
}
