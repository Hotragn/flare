// ICD-6: map pack and place functions (work package MAP), used by the frontend, the
// on-device AI parser (place words), and PWA (precache). Frozen v1. Pure functions over
// the static pack; no network at run time (ADR-0010).

export type Kind =
  | "bench"
  | "picnic_table"
  | "toilets"
  | "drinking_water"
  | "steps"
  | "shelter"
  | "viewpoint"
  | "park"
  | "water"
  | "wood"
  | "street";

export type LatLon = { lat: number; lon: number };
export type Place = LatLon & { kind: Kind; osm_id: string; name: string | null; tags: Record<string, string> };

/** Pack v2 on disk: apps/web/static/maps/{area}.json. v1 is lab spike 05's format. */
export type MapPack = {
  v: 2;
  area: string;
  center: [number, number];
  radius_m: number;
  osm_base: string; // timestamp_osm_base; the build fails when older than 7 days (SRS-IF-4)
  attribution: string;
  kinds: Record<string, Kind>;
  /** [kind code, lat, lon, osm id, tags or 0]; streets as one point per 25 m along the way */
  items: [string, number, number, string, Record<string, string> | 0][];
};

export type AccessLine = {
  benches: { count: number; nearest_m: number | null };
  restrooms: { count: number; nearest_m: number | null };
  water: { count: number; nearest_m: number | null };
  steps_mapped: boolean; // "Steps mapped" or "No steps mapped", never "step-free" (BR-A-4)
};

export type Needs = { avoid_steps: boolean; rest_gap_m: 100 | 200 | 400 | null; restroom_300m: boolean };

export interface Maps {
  load(area: string): Promise<MapPack>;
  /** SRS-CRE-3: nearest named feature within 150 m, else the nearest street name, else null. */
  nameSpot(pack: MapPack, at: LatLon): { name: string; key: string } | null;
  /** BR-E-1: benches and picnic tables within 400 m, nearest first, at most 12. */
  emberCandidates(pack: MapPack, spot: LatLon): Place[];
  /** BR-A-2 for one person and one place. `from` is the person's own position, never sent. */
  checkNeeds(pack: MapPack, needs: Needs, from: LatLon | null, place: LatLon): boolean;
  /** BR-C-7: straight-line distance × 1.3 at 4.8 km/h. */
  walkMinutes(from: LatLon, to: LatLon): number;
  accessLine(pack: MapPack, place: LatLon): AccessLine; // SRS-ACC-2, within 200 m
  /** SRS-NAT-1: sunset (NOAA), a named natural feature within 200 m, or the season. Never a model. */
  natureLine(pack: MapPack, place: LatLon, when: Date, tz: string): string;
  sunset(at: LatLon, day: Date): Date;
  /** Words for the typed six-word chips when the hub is out (ADR-0007). */
  placeWords(pack: MapPack, place: LatLon): string[];
}
