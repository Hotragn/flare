// Real sunset time on the home page without asking for location (brief item 5): the browser's
// time zone (Intl) names a city, the tz database gives that city's coordinates, and sun.ts works
// out sunset on this page. "Use my location" swaps in the phone's own position, also computed
// here. Nothing is sent anywhere.
import type { LatLon } from "@flare/shared/icd/map";
import { sunset } from "#lib/map/sun.ts";

/** Old zone names some browsers still report, mapped to the names in zone.tab. */
const ALIAS: Record<string, string> = {
  "Asia/Calcutta": "Asia/Kolkata",
  "Asia/Saigon": "Asia/Ho_Chi_Minh",
  "Asia/Katmandu": "Asia/Kathmandu",
  "Asia/Rangoon": "Asia/Yangon",
  "Europe/Kiev": "Europe/Kyiv",
  "America/Buenos_Aires": "America/Argentina/Buenos_Aires",
  "America/Indianapolis": "America/Indiana/Indianapolis",
  "America/Louisville": "America/Kentucky/Louisville",
  "Pacific/Truk": "Pacific/Chuuk",
  "Atlantic/Faeroe": "Atlantic/Faroe",
  "US/Eastern": "America/New_York",
  "US/Central": "America/Chicago",
  "US/Mountain": "America/Denver",
  "US/Pacific": "America/Los_Angeles",
  "US/Michigan": "America/Detroit",
};

export type Place = LatLon & { city: string };

/** "America/Indiana/Indianapolis" -> "Indianapolis"; "America/Port_of_Spain" -> "Port of Spain". */
export const cityOf = (zone: string) => (zone.split("/").pop() ?? zone).replace(/_/g, " ");

/** The zone's city and coordinates from the packed table ("zone lat lon|..."), or null. */
export function placeFor(zone: string, table: string): Place | null {
  const z = ALIAS[zone] ?? zone;
  const row = table.split("|").find((r) => r.startsWith(`${z} `));
  if (!row) return null;
  const [, lat, lon] = row.split(" ");
  const p = { lat: Number(lat), lon: Number(lon) };
  return Number.isFinite(p.lat) && Number.isFinite(p.lon) ? { ...p, city: cityOf(z) } : null;
}

export type Sun = { kind: "soon"; min: number } | { kind: "later"; at: Date } | { kind: "down"; next: Date };

/** Today's sunset relative to now: within 2 h counts in minutes; after it, tomorrow's time. */
export function sunFor(at: LatLon, now: Date): Sun | null {
  const today = sunset(at, now);
  if (Number.isNaN(today.getTime())) return null; // polar day or night
  const ms = today.getTime() - now.getTime();
  if (ms > 0)
    return ms <= 2 * 3_600_000
      ? { kind: "soon", min: Math.max(1, Math.round(ms / 60_000)) }
      : { kind: "later", at: today };
  const next = sunset(at, new Date(now.getTime() + 86_400_000));
  if (Number.isNaN(next.getTime())) return null;
  // After midnight the next sunset is later today, not "tomorrow" (final review, 12:30 AM).
  if (next.toDateString() === now.toDateString()) {
    const left = next.getTime() - now.getTime();
    return left <= 2 * 3_600_000
      ? { kind: "soon", min: Math.max(1, Math.round(left / 60_000)) }
      : { kind: "later", at: next };
  }
  return { kind: "down", next };
}

export const clock = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
