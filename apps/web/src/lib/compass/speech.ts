// What the compass says and when (SRS-CMP-1, SRS-CMP-2). Pure functions; the controller
// in compass.ts calls them. Strings come from the copy deck (lib/map/copy.ts).

import { fmt } from "../map/copy.ts";
import { angleDiff } from "../map/geo.ts";

export type Direction = "ahead" | "slightLeft" | "slightRight" | "left" | "right" | "behind";

export const FACING_DEG = 15; // SRS-CMP-3
export const REPEAT_TURN_DEG = 30; // SRS-CMP-2
export const REPEAT_MS = 60_000; // SRS-CMP-2

/** Relative bearing (target bearing minus heading) to a spoken direction. */
export function direction(rel: number): Direction {
  const d = angleDiff(0, rel); // -180..180, negative = left
  const a = Math.abs(d);
  if (a <= FACING_DEG) return "ahead";
  if (a > 135) return "behind";
  if (a <= 45) return d < 0 ? "slightLeft" : "slightRight";
  return d < 0 ? "left" : "right";
}

/** Rounds speech distances so the voice doesn't count every metre. */
export function spokenMeters(m: number): number {
  if (m < 20) return Math.max(1, Math.round(m));
  if (m < 100) return Math.round(m / 5) * 5;
  return Math.round(m / 10) * 10;
}

/** "Amor, 400 meters, slightly left." / "Amor is straight ahead." / "Amor, 1.2 kilometers, behind you." */
export function phrase(name: string, distanceM: number, rel: number | null): string {
  if (rel === null) return fmt("compass.spokenNoDir", { name, meters: spokenMeters(distanceM) });
  const dir = direction(rel);
  if (dir === "ahead" && distanceM < 1000) return fmt("compass.ahead", { name });
  const words = fmt(`compass.dir.${dir}`);
  if (distanceM >= 1000) return fmt("compass.spokenKm", { name, km: (distanceM / 1000).toFixed(1), direction: words });
  return fmt("compass.spoken", { name, meters: spokenMeters(distanceM), direction: words });
}

export type Spoken = { at: number; angle: number | null; distanceM: number };

/**
 * SRS-CMP-2: speak again when the angle changed by 30° or more, the distance halved, or 60 s
 * passed. `angle` is the relative bearing when a heading exists, else the absolute bearing.
 */
export function shouldSpeak(last: Spoken | null, now: number, angle: number | null, distanceM: number): boolean {
  if (!last) return true;
  if (now - last.at >= REPEAT_MS) return true;
  if (distanceM <= last.distanceM / 2) return true;
  if (angle !== null && last.angle !== null && Math.abs(angleDiff(last.angle, angle)) >= REPEAT_TURN_DEG) return true;
  // A direction appearing for the first time (heading arrived) is news too.
  return angle !== null && last.angle === null;
}
