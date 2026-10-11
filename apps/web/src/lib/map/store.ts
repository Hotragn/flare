// Loading packs: the bundled Fairlane pack first, then a pack built on the phone from
// Overpass for anywhere else, cached on the phone for 7 days (SRS-IF-4, FR-OFF-4).
// Spec: docs/maps/02-pack-format.md ("Refresh and versioning").
import type { LatLon, MapPack } from "@flare/shared/icd/map";
import { distanceM } from "./geo.ts";
import { extraQuery, type FetchLike, MIN_SPACING_MS, pinnedQuery, runQuery } from "./overpass.ts";
import { buildPack, isFresh, PACK_VERSION, PackError, validatePack } from "./pack.ts";

/** Bundled packs, served as static files (PWA precaches them). */
export const BUNDLED: Record<string, { center: LatLon; radius_m: number }> = {
  fairlane: { center: { lat: 42.3169092, lon: -83.2229394 }, radius_m: 3000 },
};
/** Packs built on the phone: smaller than Fairlane's, centred on a 0.01° grid (about 1 km). */
export const LIVE_RADIUS_M = 2000;
export const GRID_DEG = 0.01;
/** A pack is used for a point only when the point is this far inside its edge. */
export const EDGE_MARGIN_M = 500;

export interface PackStore {
  get(key: string): Promise<MapPack | null>;
  put(key: string, pack: MapPack): Promise<void>;
}

/** In-memory store, for tests and for browsers without the Cache API. */
export function memoryStore(): PackStore {
  const m = new Map<string, MapPack>();
  return {
    get: async (k) => m.get(k) ?? null,
    put: async (k, p) => {
      m.set(k, p);
    },
  };
}

/** Cache API store ("flare-maps-v2"). Lives only on the phone; never synced. */
export function cacheStore(name = `flare-maps-v${PACK_VERSION}`): PackStore {
  const url = (k: string) => `/maps/live/${encodeURIComponent(k)}.json`;
  return {
    async get(k) {
      const c = await caches.open(name);
      const r = await c.match(url(k));
      if (!r) return null;
      try {
        return validatePack(await r.json());
      } catch {
        await c.delete(url(k));
        return null;
      }
    },
    async put(k, p) {
      const c = await caches.open(name);
      await c.put(url(k), new Response(JSON.stringify(p), { headers: { "content-type": "application/json" } }));
    },
  };
}

export type LoadDeps = {
  fetch?: FetchLike;
  store?: PackStore;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
  /** Base URL for bundled packs; default "/maps/". */
  base?: string;
};

/** Load a bundled pack by area name. Throws PackError when missing or malformed. */
export async function load(area: string, deps: LoadDeps = {}): Promise<MapPack> {
  const f = deps.fetch ?? ((i, init) => fetch(i, init));
  const res = await f(`${deps.base ?? "/maps/"}${encodeURIComponent(area)}.json`, {});
  if (!res.ok) throw new PackError(`Pack ${area} not found (HTTP ${res.status})`);
  return validatePack(await res.json());
}

function covers(pack: { center: [number, number]; radius_m: number }, at: LatLon): boolean {
  return distanceM({ lat: pack.center[0], lon: pack.center[1] }, at) <= pack.radius_m - EDGE_MARGIN_M;
}

/** Grid cell key for a live pack. Coarse on purpose: about 1 km. */
export function cellKey(at: LatLon): { key: string; center: LatLon } {
  const lat = Math.round(at.lat / GRID_DEG) * GRID_DEG;
  const lon = Math.round(at.lon / GRID_DEG) * GRID_DEG;
  return {
    key: `${lat.toFixed(2)}_${lon.toFixed(2)}`,
    center: { lat: Number(lat.toFixed(2)), lon: Number(lon.toFixed(2)) },
  };
}

export type Loaded = { pack: MapPack; source: "bundled" | "cache" | "live" | "stale" };

/**
 * The pack for a point. Order: a fresh bundled pack that covers it; a fresh cached live pack;
 * a new live pack from Overpass (two queries, 2.5 s apart); else any stale pack that covers
 * it (offline beats nothing; the UI can say the map may be out of date). Throws PackError
 * when there is nothing at all.
 */
export async function loadNear(at: LatLon, deps: LoadDeps = {}): Promise<Loaded> {
  const now = deps.now?.() ?? new Date();
  const store = deps.store ?? memoryStore();
  let stale: MapPack | null = null;

  for (const [area, b] of Object.entries(BUNDLED)) {
    if (!covers({ center: [b.center.lat, b.center.lon], radius_m: b.radius_m }, at)) continue;
    try {
      const p = await load(area, deps);
      if (isFresh(p, now)) return { pack: p, source: "bundled" };
      stale = p;
    } catch {
      // Fall through to the cache and the live build.
    }
  }

  const { key, center } = cellKey(at);
  const cached = await store.get(key).catch(() => null);
  if (cached && cached.v === PACK_VERSION && covers(cached, at)) {
    if (isFresh(cached, now)) return { pack: cached, source: "cache" };
    stale ??= cached;
  }

  try {
    const area = { lat: center.lat, lon: center.lon, radius_m: LIVE_RADIUS_M };
    const q = { ...(deps.fetch ? { fetch: deps.fetch } : {}), ...(deps.sleep ? { sleep: deps.sleep } : {}) };
    const pinned = await runQuery(pinnedQuery(area), q);
    await (deps.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms))))(MIN_SPACING_MS);
    const extra = await runQuery(extraQuery(area), q);
    const pack = buildPack({
      area: `live-${key}`,
      center: [center.lat, center.lon],
      radius_m: LIVE_RADIUS_M,
      pinned,
      extra,
      now,
    });
    await store.put(key, pack).catch(() => {});
    return { pack, source: "live" };
  } catch (e) {
    if (stale) return { pack: stale, source: "stale" };
    throw e instanceof PackError
      ? e
      : new PackError(`No map data here yet (${e instanceof Error ? e.message : "offline"})`);
  }
}
