// The compass guide (SRS-CMP-1 to -3; device check fix, Sun 2026-10-11). Pure: raw sensor
// samples in, a steady direction out. Used by the app's Find them screen and, as a generated
// plain-JS copy (static/check/guide.js, `npm run gen:guide`), by the device-check compass page.
// No imports, so the copy needs nothing else.
//
// What it fixes from the iPhone 16 Pro Max run (iOS 26.6.1, 20 to 50 events/s, compass
// accuracy about 14°, GPS 2.5 to 3 m):
// - Heading is smoothed on the circle (shortest arc, time-based), so 359° and 1° average to 0°.
// - The screen's rotation is added, so the arrow points right in landscape too.
// - Tilted past 65° (phone held up like a camera), the magnetometer heading is unreliable:
//   the last good heading is kept and the hint says to hold the phone flat.
// - Walking at 1 m/s or more, the GPS course (direction of travel) replaces the compass.
// - The bearing to the target only updates while the distance is more than twice the fix's
//   accuracy; closer than that, the direction is noise, so the guide says you're close. It
//   leaves "close" only past 2.5x, so a fix wobbling at the edge doesn't flicker it.
// - Worse fixes (over 50 m) and dropped fixes keep the last good bearing.
// - "Facing" locks at 15° and lets go at 25°, so a shaky hand doesn't flicker it.
// - A poor compass (accuracy over 25°, or -1 = uncalibrated) asks for a figure 8.

export type LatLon = { lat: number; lon: number };
export type HeadingSample = {
  t: number;
  /** webkitCompassHeading (iOS), or 360 - alpha from deviceorientationabsolute. */
  heading: number;
  /** webkitCompassAccuracy in degrees; -1 means uncalibrated. */
  accuracy?: number | null;
  /** Front-back tilt: 0 flat, 90 upright. */
  beta?: number | null;
  /** Left-right tilt. */
  gamma?: number | null;
  /** screen.orientation.angle: 0 portrait, 90 or 270 landscape. */
  screen?: number;
};
export type Fix = LatLon & { t: number; accuracy: number; speed?: number | null; course?: number | null };
export type Hint = "flat" | "figure8" | null;
export type GuideState = {
  heading: number | null;
  source: "compass" | "course" | null;
  distance_m: number | null;
  /** Absolute bearing to the target, held while too close or without a good fix. */
  bearing_deg: number | null;
  /** Bearing relative to where the phone points, -180 to 180 (negative = left). */
  rel_deg: number | null;
  facing: boolean;
  /** Closer than twice the fix's accuracy: no direction, just "you're close". */
  near: boolean;
  hint: Hint;
  accuracy_m: number | null;
  /** No fix for 10 s: the distance and bearing are the last good ones. */
  stale: boolean;
};

export const SMOOTH_MS = 250;
export const TILT_MAX_DEG = 65;
export const POOR_COMPASS_DEG = 25;
export const WALK_ON_MPS = 1.0;
export const WALK_OFF_MPS = 0.6;
export const MAX_FIX_M = 50;
export const NEAR_FACTOR = 2;
/** Leave "near" only past 2.5x accuracy, so a fix wobbling at the edge doesn't flicker it. */
export const NEAR_EXIT_FACTOR = 2.5;
export const FACE_IN_DEG = 15;
export const FACE_OUT_DEG = 25;
export const STALE_MS = 10_000;

const RAD = Math.PI / 180;
const norm = (d: number) => ((d % 360) + 360) % 360;
/** Signed difference b - a, -180 to 180. */
export const angleDiff = (a: number, b: number) => ((((b - a) % 360) + 540) % 360) - 180;

export function distanceM(a: LatLon, b: LatLon): number {
  const h =
    Math.sin(((b.lat - a.lat) * RAD) / 2) ** 2 +
    Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(((b.lon - a.lon) * RAD) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}
export function bearingDeg(a: LatLon, b: LatLon): number {
  const y = Math.sin((b.lon - a.lon) * RAD) * Math.cos(b.lat * RAD);
  const x =
    Math.cos(a.lat * RAD) * Math.sin(b.lat * RAD) -
    Math.sin(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.cos((b.lon - a.lon) * RAD);
  return norm(Math.atan2(y, x) / RAD);
}

/**
 * Time-based circular low-pass along the shortest arc, so 359° and 1° average to 0° and a
 * turn never takes the long way. (Blending unit vectors and re-normalising each step looked
 * right but froze on an exact 180° turn: the vector shrinks and never flips.)
 */
export function circularSmooth(prev: number | null, next: number, dtMs: number, tauMs = SMOOTH_MS): number {
  if (prev === null || !Number.isFinite(dtMs) || dtMs <= 0) return norm(next);
  const k = 1 - Math.exp(-dtMs / tauMs);
  return norm(prev + k * angleDiff(prev, next));
}

export type Guide = {
  orientation(s: HeadingSample): GuideState;
  position(f: Fix): GuideState;
  /** Advance time with no new fix (marks stale fixes). */
  tick(t: number): GuideState;
  setTarget(target: LatLon | null): GuideState;
  state(): GuideState;
};

export function createGuide(initialTarget: LatLon | null = null): Guide {
  let target = initialTarget;
  let compass: number | null = null;
  let compassAt = -Infinity;
  let course: number | null = null;
  let courseAt = -Infinity;
  let walking = false;
  let tilted = false;
  let poor = false;
  let fix: Fix | null = null;
  let lastFixAt = -Infinity;
  let now = 0;
  let s: GuideState = {
    heading: null,
    source: null,
    distance_m: null,
    bearing_deg: null,
    rel_deg: null,
    facing: false,
    near: false,
    hint: null,
    accuracy_m: null,
    stale: false,
  };

  const recompute = (): GuideState => {
    const source: GuideState["source"] = walking && course !== null ? "course" : compass !== null ? "compass" : null;
    const heading = source === "course" ? course : compass;
    let { distance_m, bearing_deg } = s;
    let near = s.near;
    if (fix && target) {
      distance_m = distanceM(fix, target);
      near = distance_m <= (s.near ? NEAR_EXIT_FACTOR : NEAR_FACTOR) * fix.accuracy;
      if (!near) bearing_deg = bearingDeg(fix, target); // else keep the last good bearing
    }
    const rel = heading === null || bearing_deg === null || near ? null : angleDiff(heading, bearing_deg);
    const facing = rel !== null && Math.abs(rel) <= (s.facing ? FACE_OUT_DEG : FACE_IN_DEG);
    const hint: Hint = source === "course" ? null : tilted ? "flat" : poor ? "figure8" : null;
    s = {
      heading,
      source,
      distance_m,
      bearing_deg,
      rel_deg: rel,
      facing,
      near,
      hint,
      accuracy_m: fix?.accuracy ?? null,
      stale: now - lastFixAt > STALE_MS,
    };
    return s;
  };

  return {
    orientation(x) {
      now = Math.max(now, x.t);
      const beta = Math.abs(x.beta ?? 0);
      const gamma = Math.abs(x.gamma ?? 0);
      tilted = beta > TILT_MAX_DEG || gamma > TILT_MAX_DEG;
      poor = typeof x.accuracy === "number" && (x.accuracy < 0 || x.accuracy > POOR_COMPASS_DEG);
      if (!tilted && Number.isFinite(x.heading)) {
        const h = norm(x.heading + (x.screen ?? 0));
        compass = circularSmooth(compass, h, x.t - compassAt);
        compassAt = x.t;
      }
      return recompute();
    },
    position(f) {
      now = Math.max(now, f.t);
      const speed = f.speed ?? null;
      if (speed !== null && Number.isFinite(speed)) walking = walking ? speed >= WALK_OFF_MPS : speed >= WALK_ON_MPS;
      if (walking && typeof f.course === "number" && Number.isFinite(f.course) && f.course >= 0) {
        course = circularSmooth(course, f.course, f.t - courseAt, 1000);
        courseAt = f.t;
      }
      if (f.accuracy <= MAX_FIX_M || !fix) {
        fix = f;
        lastFixAt = f.t;
      }
      return recompute();
    },
    tick(t) {
      now = Math.max(now, t);
      return recompute();
    },
    setTarget(next) {
      target = next;
      s = { ...s, bearing_deg: null, distance_m: null, near: false, facing: false };
      return recompute();
    },
    state: () => s,
  };
}

/** The arrow's on-screen angle without the long-way spin: follow the shortest turn. */
export function unwrapAngle(prevShown: number, next: number): number {
  return prevShown + angleDiff(prevShown, next);
}
