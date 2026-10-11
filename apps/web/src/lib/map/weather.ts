// Plan weather (MP5, SRS-PLAN-2, ADR-0007): ask api.weather.gov for the hourly forecast at the
// host's position rounded to 0.1° (about 11 km), and reduce it on the phone to
// { rain_likely, temp_f } for the Plan's time window. Only that pair leaves the phone.
// Fails soft: any error, timeout or odd payload returns null and the ladder drafts without it.
import type { LatLon } from "@flare/shared/icd/map";
import type { FetchLike } from "./overpass.ts";

export const NWS = "https://api.weather.gov";
export const RAIN_PCT = 50; // "rain likely" at a 50% chance of precipitation or more in the window
export const TIMEOUT_MS = 5_000;

export type PlanWeather = { rain_likely: boolean; temp_f: number };

type Period = {
  startTime: string;
  endTime: string;
  temperature: number;
  temperatureUnit: "F" | "C";
  probabilityOfPrecipitation?: { value: number | null };
};

/** Round to 0.1° so the weather service learns the area, not the spot. */
export function coarse(at: LatLon): LatLon {
  return { lat: Math.round(at.lat * 10) / 10, lon: Math.round(at.lon * 10) / 10 };
}

/** Reduce hourly periods overlapping [start, end) to the contract shape; null when none overlap. */
export function reduce(periods: Period[], start: Date, end: Date): PlanWeather | null {
  const s = start.getTime();
  const e = end.getTime();
  const hit = periods.filter((p) => Date.parse(p.startTime) < e && Date.parse(p.endTime) > s);
  if (hit.length === 0) return null;
  const temps = hit.map((p) => (p.temperatureUnit === "C" ? (p.temperature * 9) / 5 + 32 : p.temperature));
  const rain = hit.some((p) => (p.probabilityOfPrecipitation?.value ?? 0) >= RAIN_PCT);
  const temp = Math.round(temps.reduce((a, b) => a + b, 0) / temps.length);
  return { rain_likely: rain, temp_f: Math.max(-40, Math.min(130, temp)) };
}

/**
 * Two requests: /points/{lat},{lon} for the grid, then its forecastHourly URL (checked to be
 * on api.weather.gov). Returns null on any failure.
 */
export async function planWeather(
  at: LatLon,
  start: Date,
  end: Date,
  deps: { fetch?: FetchLike; timeoutMs?: number } = {},
): Promise<PlanWeather | null> {
  const f = deps.fetch ?? ((i, init) => fetch(i, init));
  const c = coarse(at);
  const init: RequestInit = {
    headers: { accept: "application/geo+json" },
    signal: AbortSignal.timeout(deps.timeoutMs ?? TIMEOUT_MS),
  };
  try {
    const pts = await f(`${NWS}/points/${c.lat.toFixed(1)},${c.lon.toFixed(1)}`, init);
    if (!pts.ok) return null;
    const hourly = ((await pts.json()) as { properties?: { forecastHourly?: string } }).properties?.forecastHourly;
    if (typeof hourly !== "string" || new URL(hourly).origin !== NWS) return null;
    const fc = await f(hourly, init);
    if (!fc.ok) return null;
    const periods = ((await fc.json()) as { properties?: { periods?: Period[] } }).properties?.periods;
    return Array.isArray(periods) ? reduce(periods, start, end) : null;
  } catch {
    return null;
  }
}
