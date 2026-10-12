// The real sky for the illustrated scene: which part of the day it is on this phone right now,
// from the sun (NOAA sunset, #lib/map/sun.ts) at the phone's rough position, or, without one,
// at a position guessed from the time zone. Plus the weather the screen already has.
// Pure and small: it ships with every screen that draws the scene.
import type { LatLon } from "@flare/shared/icd/map";
import { sunset } from "#lib/map/sun.ts";

export type Phase = "night" | "dawn" | "day" | "golden" | "dusk";

/** What a screen knows: all optional. `hour` (0 to 24, local) fixes the clock for catalogs and tests. */
export type SkyInput = { hour?: number; rain?: boolean; wind?: number | null; at?: LatLon | null };

/** `sun`: 0 at sunrise, 1 at sunset, outside 0..1 when the sun is down. */
export type Sky = { phase: Phase; sun: number; rain: boolean; windy: boolean };

/** Wind from this speed (mph) sways the trees. */
export const WINDY_MPH = 15;
const MIN = 60_000;

/**
 * A rough position from the time zone alone: 15° of longitude per hour of standard offset
 * (the larger of January's and July's, so summer time does not shift it), latitude 40° N.
 * Good to about half an hour of sunset in the lower 48, which is all a drawing needs.
 */
export function guessAt(now: Date): LatLon {
  const y = now.getFullYear();
  const std = Math.max(new Date(y, 0, 1).getTimezoneOffset(), new Date(y, 6, 1).getTimezoneOffset());
  return { lat: 40, lon: -std / 4 };
}

/** The phase of the day at `now`, with the sun's place on its arc. */
export function skyAt(now: Date, input: SkyInput = {}): Sky {
  const at = input.at ?? guessAt(now);
  let t = now;
  if (input.hour !== undefined && Number.isFinite(input.hour)) {
    t = new Date(now);
    t.setHours(0, 0, 0, 0);
    t = new Date(t.getTime() + input.hour * 3_600_000);
  }
  const set = sunset(at, t).getTime();
  const rain = !!input.rain;
  const windy = (input.wind ?? 0) >= WINDY_MPH;
  if (!Number.isFinite(set)) {
    // Polar day or night: go by the clock.
    const h = t.getHours();
    return { phase: h >= 7 && h < 18 ? "day" : "night", sun: (h - 6) / 12, rain, windy };
  }
  // Solar noon of the same solar day; sunrise mirrors sunset around it (within a few minutes).
  const solar = new Date(t.getTime() + (at.lon / 15) * 3_600_000);
  const noon = Date.UTC(solar.getUTCFullYear(), solar.getUTCMonth(), solar.getUTCDate()) + (720 - 4 * at.lon) * MIN;
  const rise = 2 * noon - set;
  const now_ = t.getTime();
  const sun = (now_ - rise) / (set - rise);
  const phase: Phase =
    now_ < rise - 40 * MIN
      ? "night"
      : now_ < rise + 40 * MIN
        ? "dawn"
        : now_ < set - 60 * MIN
          ? "day"
          : now_ < set + 10 * MIN
            ? "golden"
            : now_ < set + 45 * MIN
              ? "dusk"
              : "night";
  return { phase, sun, rain, windy };
}
