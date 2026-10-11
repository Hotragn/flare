// Overpass queries for map pack v2 (docs/maps/02-pack-format.md). Used by the Node
// builder (scripts/build-map-pack.ts) and by the phone for on-demand packs elsewhere.
// Endpoint: overpass-api.de only. Never any openstreetmap.org host (SRS-MAP-3).

export const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
/** Sent by the Node builder. Browsers forbid setting User-Agent; they send their own plus Referer. */
export const USER_AGENT =
  "FlareMapPack/2.0 (+https://github.com/Hotragn/flare; group meetup app, a few queries per pack)";
/** Minimum spacing between our requests to the public server. */
export const MIN_SPACING_MS = 2_500;

export type OverpassGeom = { lat: number; lon: number };
export type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: OverpassGeom;
  geometry?: (OverpassGeom | null)[];
  members?: { type: string; ref: number; role: string; geometry?: (OverpassGeom | null)[] }[];
  tags?: Record<string, string>;
};
export type OverpassResult = {
  osm3s?: { timestamp_osm_base?: string; copyright?: string };
  elements: OverpassElement[];
};

export type Area = { lat: number; lon: number; radius_m: number };

const around = (a: Area) => `around:${Math.round(a.radius_m)},${a.lat},${a.lon}`;

/**
 * Query 1: the analyst's pinned query (docs/requirements/evidence/fairlane-pinned.overpassql),
 * byte-for-byte the same statements, so the counts can be checked against the evidence.
 */
export function pinnedQuery(a: Area): string {
  const r = around(a);
  return `[out:json][timeout:90];
(
  nwr(${r})["amenity"="bench"];
  nwr(${r})["leisure"="picnic_table"];
  nwr(${r})["amenity"="toilets"];
  nwr(${r})["amenity"="drinking_water"];
  nwr(${r})["leisure"="park"];
  nwr(${r})["highway"="steps"];
);
out tags center;`;
}

/** Query 2: shelters and viewpoints (points), then named nature, parks and streets with geometry. */
export function extraQuery(a: Area): string {
  const r = around(a);
  return `[out:json][timeout:90];
(
  nwr(${r})["amenity"="shelter"];
  nwr(${r})["tourism"="viewpoint"];
);
out tags center;
(
  nwr(${r})["natural"="water"]["name"];
  nwr(${r})["natural"="wood"]["name"];
  nwr(${r})["landuse"="forest"]["name"];
  way(${r})["waterway"~"^(river|stream|canal)$"]["name"];
  nwr(${r})["leisure"="park"]["name"];
  way(${r})["highway"~"^(trunk|primary|secondary|tertiary|unclassified|residential|living_street|pedestrian|service|footway|path|cycleway|track)$"]["name"];
);
out tags geom;`;
}

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export class OverpassError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "OverpassError";
    this.status = status;
  }
}

/**
 * Run one query. `userAgent` is only set where the platform allows it (Node).
 * Retries "too busy" (429/504) up to `retries` times with growing waits (BUG-004).
 */
export async function runQuery(
  query: string,
  opts: {
    fetch?: FetchLike;
    userAgent?: string;
    retries?: number;
    sleep?: (ms: number) => Promise<void>;
    timeoutMs?: number;
  } = {},
): Promise<OverpassResult> {
  const f = opts.fetch ?? ((i, init) => fetch(i, init));
  const sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const retries = opts.retries ?? 3;
  const headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded" };
  if (opts.userAgent) headers["user-agent"] = opts.userAgent;
  let last: OverpassError | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(MIN_SPACING_MS * 2 ** attempt);
    const res = await f(OVERPASS_URL, {
      method: "POST",
      headers,
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(opts.timeoutMs ?? 120_000),
    });
    if (res.ok) {
      const json = (await res.json()) as OverpassResult;
      if (!Array.isArray(json.elements)) throw new OverpassError("Overpass returned no elements array", res.status);
      return json;
    }
    last = new OverpassError(`Overpass HTTP ${res.status}`, res.status);
    if (res.status !== 429 && res.status !== 504) break;
  }
  throw last ?? new OverpassError("Overpass failed", 0);
}
