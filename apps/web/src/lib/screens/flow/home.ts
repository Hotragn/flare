// The Touch Grass home (docs/design/09-2026-direction.md, B): what's good outside right now,
// from the phone's own map pack and the sun. Pure; the weather call is the only network and
// it is optional (api.weather.gov, coarse 0.1° area).
import type { LatLon, MapPack } from "@flare/shared/icd/map";
import { natureLine } from "#lib/map/nature.ts";
import { near } from "#lib/map/places.ts";
import { sunset } from "#lib/map/sun.ts";

export const GOLDEN_MIN = 60; // golden hour: the last hour before sunset
export const GREEN_RADIUS_M = 1500;
const WALK_M_PER_MIN = 80;

export type Golden = { kind: "soon"; minutes: number } | { kind: "now"; minutes: number } | { kind: "after" };
export type Green = { name: string; walkMin: number; line: string };

/** "Golden hour in 47 min", "Golden hour now" (minutes to sunset), or after sunset. */
export function golden(at: LatLon, now: Date): Golden {
  const set = sunset(at, now).getTime();
  const toSet = Math.round((set - now.getTime()) / 60_000);
  if (toSet <= 0) return { kind: "after" };
  if (toSet <= GOLDEN_MIN) return { kind: "now", minutes: toSet };
  return { kind: "soon", minutes: toSet - GOLDEN_MIN };
}

/** The nearest named park or water from the pack, with its one-thing-worth-noticing line. */
export function nearestGreen(pack: MapPack, at: LatLon, now: Date, tz: string): Green | null {
  const hit = near(pack, at, new Set(["park", "water"]), GREEN_RADIUS_M).find(({ place }) => place.name);
  if (!hit?.place.name) return null;
  return {
    name: hit.place.name,
    walkMin: Math.max(1, Math.round((hit.m * 1.3) / WALK_M_PER_MIN)),
    line: natureLine(pack, hit.place, now, tz),
  };
}
