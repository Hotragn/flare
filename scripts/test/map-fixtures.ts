// Shared fixtures for the map tests: the committed Fairlane pack, five field-test points,
// and a builder for small synthetic packs.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Kind, LatLon, MapPack } from "@flare/shared/icd/map";
import { destination } from "../../apps/web/src/lib/map/geo.ts";
import { ATTRIBUTION, KIND_CODES } from "../../apps/web/src/lib/map/pack.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const FAIRLANE_PATH = path.join(ROOT, "apps/web/static/maps/fairlane.json");
export const fairlane = (): MapPack => JSON.parse(fs.readFileSync(FAIRLANE_PATH, "utf8"));

/** Five points around the field-test area. */
export const POINTS = {
  mall: { lat: 42.3169092, lon: -83.2229394 }, // Fairlane Town Center centroid (TEST_AREA)
  wagner: { lat: 42.3055, lon: -83.2447 }, // Wagner Park, west Dearborn
  lake: { lat: 42.316, lon: -83.237 }, // Fair Lane Lake, UM-Dearborn
  green: { lat: 42.3064, lon: -83.227 }, // Village Green, Greenfield Village
  resid: { lat: 42.295, lon: -83.21 }, // Rotunda Drive, no amenities mapped
} satisfies Record<string, LatLon>;

const CODE: Record<Kind, string> = Object.fromEntries(Object.entries(KIND_CODES).map(([c, k]) => [k, c])) as Record<
  Kind,
  string
>;

export const ORIGIN: LatLon = { lat: 42.3, lon: -83.2 };

/** A place `m` metres from ORIGIN on bearing `deg`. */
export const at = (deg: number, m: number): LatLon => destination(ORIGIN, deg, m);

export type Spec = { kind: Kind; p: LatLon; id?: string; tags?: Record<string, string> };

export function tinyPack(specs: Spec[], osm_base = new Date().toISOString()): MapPack {
  return {
    v: 2,
    area: "test",
    center: [ORIGIN.lat, ORIGIN.lon],
    radius_m: 3000,
    osm_base,
    attribution: ATTRIBUTION,
    kinds: KIND_CODES,
    items: specs.map((s, i) => [CODE[s.kind], s.p.lat, s.p.lon, s.id ?? `n${i + 1}`, s.tags ?? 0]),
  };
}
