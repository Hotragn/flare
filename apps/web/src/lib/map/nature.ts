// SRS-NAT-1: one real line about the place, from sunset (NOAA), a named natural feature in
// OSM within 200 m, or the season. Never from a model. Order:
//   1. Sunset, when it falls within the 3 hours after `when` (the evening cue matters most).
//   2. The nearest named water or woods within 200 m.
//   3. The astronomical season and its week ("Week 3 of fall").
// The sunset is also always available from `sunset()` for BR-P-9 ("Ends after sunset").
import type { Kind, LatLon, MapPack } from "@flare/shared/icd/map";
import { fmt } from "./copy.ts";
import { near } from "./places.ts";
import { sunset } from "./sun.ts";

export const NATURE_RADIUS_M = 200;
export const SUNSET_WINDOW_MS = 3 * 3600 * 1000;
const NATURE_KINDS: ReadonlySet<Kind> = new Set<Kind>(["water", "wood"]);

/** "6:57 PM" in the given IANA time zone. */
export function clockTime(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz }).format(d);
}

type Season = "spring" | "summer" | "fall" | "winter";

/** Local calendar date (y, m 1-12, d) in `tz`. */
function localDate(when: Date, tz: string): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "numeric", day: "numeric", timeZone: tz })
    .formatToParts(when)
    .reduce<Record<string, string>>((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});
  return { y: Number(parts.year), m: Number(parts.month), d: Number(parts.day) };
}

/**
 * Astronomical season and its 1-based week. Season starts use the usual civil dates
 * (Mar 20, Jun 21, Sep 22, Dec 21); they move by at most a day between years.
 * Southern latitudes get the opposite season.
 */
export function season(when: Date, tz: string, lat: number): { season: Season; week: number } {
  const { y, m, d } = localDate(when, tz);
  const day = Date.UTC(y, m - 1, d);
  const starts: [Season, number][] = [
    ["winter", Date.UTC(y - 1, 11, 21)],
    ["spring", Date.UTC(y, 2, 20)],
    ["summer", Date.UTC(y, 5, 21)],
    ["fall", Date.UTC(y, 8, 22)],
    ["winter", Date.UTC(y, 11, 21)],
  ];
  let cur = starts[0] as [Season, number];
  for (const s of starts) if (day >= s[1]) cur = s;
  const week = Math.floor((day - cur[1]) / (7 * 86_400_000)) + 1;
  const flip: Record<Season, Season> = { spring: "fall", summer: "winter", fall: "spring", winter: "summer" };
  return { season: lat < 0 ? flip[cur[0]] : cur[0], week };
}

export function natureLine(pack: MapPack, place: LatLon, when: Date, tz: string): string {
  const set = sunset(place, when);
  const ahead = set.getTime() - when.getTime();
  if (!Number.isNaN(ahead) && ahead >= 0 && ahead <= SUNSET_WINDOW_MS)
    return fmt("nature.sunset", { time: clockTime(set, tz) });
  const feature = near(pack, place, NATURE_KINDS, NATURE_RADIUS_M).find(({ place: p }) => p.name);
  if (feature?.place.name) return fmt("nature.feature", { name: feature.place.name });
  const s = season(when, tz, place.lat);
  return fmt("nature.season", { n: s.week, season: fmt(`nature.season.${s.season}`) });
}

/** BR-P-9: true when a step ending at `end` ends after that day's sunset at `place`. */
export function endsAfterSunset(place: LatLon, end: Date): boolean {
  const set = sunset(place, end);
  return !Number.isNaN(set.getTime()) && end.getTime() > set.getTime();
}
