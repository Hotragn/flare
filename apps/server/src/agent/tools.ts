// The Plan agent's tools (ADR-0025). Pure and local, except the weather window, which asks
// api.weather.gov for the pack's area rounded to 0.1° and skips on any failure. Tools return
// labels, times and counts only: never coordinates, never the ask line.
import { readFileSync } from "node:fs";
import { cleanAsk, type LadderT, templateLadder } from "@flare/shared";
import { sunset } from "./sun.ts";

type LatLon = { lat: number; lon: number };
type PackItem = [string, number, number, string, Record<string, string> | 0];
type Pack = { area: string; center: [number, number]; items: PackItem[] };

export const PACK_URL = new URL("../../../web/static/maps/fairlane.json", import.meta.url);
export const PACK_TZ = "America/Detroit"; // the Fairlane field-test area

/** Kinds that read as a place to go (pack v2 codes): park, water, wood, viewpoint, shelter. */
const PLACE_KINDS = new Set(["k", "w", "f", "v", "h"]);

export type Place = { label: string; kind: string; at: LatLon };
export type Places = { area: string; center: LatLon; places: Place[]; shelters: number; benches: number };

let cached: Places | null | undefined;

/** Read the Fairlane pack once; null when the file is missing or odd (the tool then returns nothing). */
export function loadPlaces(url: URL = PACK_URL): Places | null {
  if (cached !== undefined && url === PACK_URL) return cached;
  let out: Places | null = null;
  try {
    const p = JSON.parse(readFileSync(url, "utf8")) as Pack;
    const seen = new Map<string, Place>();
    let shelters = 0;
    let benches = 0;
    const ids = new Set<string>();
    for (const [code, lat, lon, id, tags] of p.items) {
      if (ids.has(id)) continue;
      ids.add(id);
      if (code === "h") shelters++;
      if (code === "b") benches++;
      const name = tags && typeof tags.name === "string" ? tags.name.trim() : "";
      if (!name || !PLACE_KINDS.has(code) || seen.has(name.toLowerCase())) continue;
      seen.set(name.toLowerCase(), { label: name, kind: code, at: { lat, lon } });
    }
    out = {
      area: p.area,
      center: { lat: p.center[0], lon: p.center[1] },
      places: [...seen.values()],
      shelters,
      benches,
    };
  } catch {
    out = null;
  }
  if (url === PACK_URL) cached = out;
  return out;
}

const km = (a: LatLon, b: LatLon) => {
  const x = (b.lon - a.lon) * Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
  return Math.hypot(x, b.lat - a.lat) * 111.2;
};

export type NearbyOut = { area: string; named: string[]; nearby: string[]; shelters: number; benches: number };

/**
 * Pack places the ask names (the pack's spelling), plus the closest named places to the pack
 * centre. The server never learns the phone's position, so "nearby" means near the field-test area.
 */
export function nearbyPlaces(ask: string, places: Places | null = loadPlaces(), limit = 5): NearbyOut {
  if (!places) return { area: "", named: [], nearby: [], shelters: 0, benches: 0 };
  const a = ` ${cleanAsk(ask).toLowerCase()} `;
  const named = places.places.filter((p) => a.includes(` ${p.label.toLowerCase()} `)).map((p) => p.label);
  const nearby = [...places.places]
    .sort((x, y) => km(places.center, x.at) - km(places.center, y.at))
    .slice(0, limit)
    .map((p) => p.label);
  return { area: places.area, named, nearby, shelters: places.shelters, benches: places.benches };
}

/** Swap the ask's spelling of each named place for the pack's (so "rouge river" reads "Rouge River"). */
export function withPackSpelling(ask: string, named: string[]): string {
  let out = cleanAsk(ask);
  for (const label of named) {
    const esc = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(`(^|\\s)${esc}(?=\\s|$|[,.?!])`, "i"), (_m, pre: string) => `${pre}${label}`);
  }
  return out;
}

/**
 * The area a request names: a pack place label, or the pack name, or nothing (the pack
 * centre). `cell` is the 0.1° cell, used for weather, sunset and cache keys and never returned
 * by a tool. Unknown labels fall back to the pack centre with `known: false`.
 */
export type Area = { label: string; cell: LatLon; known: boolean };

export function resolveArea(area: string | undefined, places: Places | null = loadPlaces()): Area | null {
  if (!places) return null;
  const centre = { label: places.area, cell: coarse(places.center), known: true };
  const a = area?.trim().toLowerCase();
  if (!a || a === places.area.toLowerCase()) return centre;
  const p = places.places.find((x) => x.label.toLowerCase() === a);
  return p ? { label: p.label, cell: coarse(p.at), known: true } : { ...centre, known: false };
}

// Caches (ADR-0025): sunset per (cell, 15-minute bucket of the start), the hourly forecast per
// (cell, 15-minute bucket of the clock). Only failures are not cached. Both stay small.
export const BUCKET_MS = 15 * 60_000;
const MAX_ENTRIES = 64;
const sunsetCache = new Map<string, Date>();
const forecastCache = new Map<string, Promise<Period[] | null>>();
const stats = { sunset_hits: 0, sunset_misses: 0, weather_hits: 0, weather_misses: 0 };
const cellKey = (c: LatLon, ms: number) => `${c.lat.toFixed(1)},${c.lon.toFixed(1)}|${Math.floor(ms / BUCKET_MS)}`;
function remember<V>(m: Map<string, V>, k: string, v: V): V {
  if (m.size >= MAX_ENTRIES) m.delete(m.keys().next().value as string);
  m.set(k, v);
  return v;
}
export const toolCacheStats = () => ({ ...stats });
export function clearToolCaches(): void {
  sunsetCache.clear();
  forecastCache.clear();
  for (const k of Object.keys(stats)) stats[k as keyof typeof stats] = 0;
}

export type SunsetOut = {
  sunset_local: string | null; // "18:58" in the area's time zone
  minutes_to_sunset: number | null; // from the plan's start
  ends_after_dark: boolean;
};

/** Sunset on the plan's day in its area, and whether a plan from `start` ends after it. */
export function sunsetWindow(
  totalMinutes: number,
  start: Date,
  at: LatLon | null = loadPlaces()?.center ?? null,
): SunsetOut {
  if (!at) return { sunset_local: null, minutes_to_sunset: null, ends_after_dark: false };
  const cell = coarse(at);
  const key = cellKey(cell, start.getTime());
  let s = sunsetCache.get(key);
  if (s) stats.sunset_hits++;
  else {
    stats.sunset_misses++;
    s = remember(sunsetCache, key, sunset(cell, start));
  }
  if (Number.isNaN(s.getTime())) return { sunset_local: null, minutes_to_sunset: null, ends_after_dark: false };
  const left = Math.round((s.getTime() - start.getTime()) / 60_000);
  const local = new Intl.DateTimeFormat("en-GB", { timeZone: PACK_TZ, hour: "2-digit", minute: "2-digit" }).format(s);
  return { sunset_local: local, minutes_to_sunset: left, ends_after_dark: left < totalMinutes };
}

// Weather: the same coarse rounding and reduction as apps/web/src/lib/map/weather.ts.
export const NWS = "https://api.weather.gov";
export const RAIN_PCT = 50;
export type PlanWeather = { rain_likely: boolean; temp_f: number };
type Period = {
  startTime: string;
  endTime: string;
  temperature: number;
  temperatureUnit: "F" | "C";
  probabilityOfPrecipitation?: { value: number | null };
};

export const coarse = (at: LatLon): LatLon => ({
  lat: Math.round(at.lat * 10) / 10,
  lon: Math.round(at.lon * 10) / 10,
});

export function reduceWeather(periods: Period[], start: Date, end: Date): PlanWeather | null {
  const s = start.getTime();
  const e = end.getTime();
  const hit = periods.filter((p) => Date.parse(p.startTime) < e && Date.parse(p.endTime) > s);
  if (hit.length === 0) return null;
  const temps = hit.map((p) => (p.temperatureUnit === "C" ? (p.temperature * 9) / 5 + 32 : p.temperature));
  const rain = hit.some((p) => (p.probabilityOfPrecipitation?.value ?? 0) >= RAIN_PCT);
  const temp = Math.round(temps.reduce((a, b) => a + b, 0) / temps.length);
  return { rain_likely: rain, temp_f: Math.max(-40, Math.min(130, temp)) };
}

async function fetchHourly(cell: LatLon, f: typeof fetch, timeoutMs: number): Promise<Period[] | null> {
  const init: RequestInit = {
    headers: { accept: "application/geo+json", "user-agent": "flare-server (plan weather)" },
    signal: AbortSignal.timeout(timeoutMs),
  };
  try {
    const pts = await f(`${NWS}/points/${cell.lat.toFixed(1)},${cell.lon.toFixed(1)}`, init);
    if (!pts.ok) return null;
    const hourly = ((await pts.json()) as { properties?: { forecastHourly?: string } }).properties?.forecastHourly;
    if (typeof hourly !== "string" || new URL(hourly).origin !== NWS) return null;
    const fc = await f(hourly, init);
    if (!fc.ok) return null;
    const periods = ((await fc.json()) as { properties?: { periods?: Period[] } }).properties?.periods;
    return Array.isArray(periods) ? periods : null;
  } catch {
    return null;
  }
}

/**
 * Hourly forecast reduced for [start, start + minutes) in the area's 0.1° cell; null on any
 * failure, timeout, or a window the forecast does not cover. `now` keys the forecast cache.
 */
export async function weatherWindow(
  totalMinutes: number,
  start: Date,
  deps: { fetch?: typeof fetch; timeoutMs?: number; at?: LatLon | null; now?: Date } = {},
): Promise<PlanWeather | null> {
  const at = deps.at === undefined ? (loadPlaces()?.center ?? null) : deps.at;
  if (!at) return null;
  const cell = coarse(at);
  const key = cellKey(cell, (deps.now ?? new Date()).getTime());
  let p = forecastCache.get(key);
  if (p) stats.weather_hits++;
  else {
    stats.weather_misses++;
    p = remember(forecastCache, key, fetchHourly(cell, deps.fetch ?? fetch, deps.timeoutMs ?? 2500));
    p.then((v) => {
      if (!v && forecastCache.get(key) === p) forecastCache.delete(key); // retry next time
    });
  }
  const periods = await p;
  return periods ? reduceWeather(periods, start, new Date(start.getTime() + totalMinutes * 60_000)) : null;
}

/** The template ladder for these minutes: the floor the agent falls back to. */
export const stepTemplates = (totalMinutes: number): LadderT => templateLadder(totalMinutes);
