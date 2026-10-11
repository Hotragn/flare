// The talking compass (SRS-CMP-1 to -3, -7). No map screen: an arrow angle, a distance and a
// voice. Works offline from the target saved at Lit; it never makes a network request.
//
// iOS rule from spike E3: DeviceOrientationEvent.requestPermission() must be the first call in
// the tap handler, before any await, or Safari refuses it. So `start()` must be called
// synchronously from the tap; it asks for orientation first and location second.
//
// Platform pieces are injected (CompassEnv) so the logic runs in Node tests; `browserEnv()`
// builds the real one.
import type { LatLon } from "@flare/shared/icd/map";
import { angleDiff, bearingDeg, distanceM } from "../map/geo.ts";
import { FACING_DEG, phrase, type Spoken, shouldSpeak } from "./speech.ts";

export type Permission = "granted" | "denied" | "unsupported" | "error";

export type CompassState = {
  /** Metres to the target, null until the first location fix. */
  distance_m: number | null;
  /** Arrow angle: target bearing relative to where the phone points; null without a heading. */
  rel_deg: number | null;
  /** Absolute bearing to the target, null until the first fix. */
  bearing_deg: number | null;
  facing: boolean;
  accuracy_m: number | null;
  orientation: Permission | "pending";
  location: "pending" | "granted" | "denied" | "unavailable";
  /** The last sentence spoken (or that would be spoken when speech is off). */
  line: string | null;
  talking: boolean;
};

export type OrientationReading = { webkitCompassHeading?: number; alpha: number | null; absolute?: boolean };

export interface CompassEnv {
  /** Present only where the platform needs a prompt (iOS Safari). */
  requestOrientationPermission?: () => Promise<string>;
  /** Subscribe to orientation events; returns an unsubscribe. */
  onOrientation(cb: (r: OrientationReading) => void): () => void;
  /** Watch position; returns an unsubscribe. */
  watchPosition(ok: (p: LatLon & { accuracy: number }) => void, err: (code: number) => void): () => void;
  speak(text: string): void;
  stopSpeaking(): void;
  /** Haptic tick; false when the platform has no vibration (iOS Safari). */
  vibrate(ms: number): boolean;
  tone(): void;
  now(): number;
}

/** Heading in degrees from one orientation event, or null when it carries none. */
export function headingOf(r: OrientationReading): number | null {
  if (typeof r.webkitCompassHeading === "number" && Number.isFinite(r.webkitCompassHeading))
    return ((r.webkitCompassHeading % 360) + 360) % 360;
  if (r.absolute && typeof r.alpha === "number") return (360 - r.alpha) % 360;
  return null;
}

/** Circular low-pass so the arrow and the voice don't jitter. k = weight of the new reading. */
export function smoothHeading(prev: number | null, next: number, k = 0.35): number {
  if (prev === null) return next;
  return (prev + angleDiff(prev, next) * k + 360) % 360;
}

export type Compass = {
  /** Call synchronously from the tap. Asks orientation first, location second. */
  start(): Promise<void>;
  stop(): void;
  setTalking(on: boolean): void;
  subscribe(cb: (s: CompassState) => void): () => void;
  state(): CompassState;
};

export function createCompass(opts: { target: LatLon; name: string; env: CompassEnv; talking?: boolean }): Compass {
  const { target, name, env } = opts;
  let s: CompassState = {
    distance_m: null,
    rel_deg: null,
    bearing_deg: null,
    facing: false,
    accuracy_m: null,
    orientation: "pending",
    location: "pending",
    line: null,
    talking: opts.talking ?? true,
  };
  let here: LatLon | null = null;
  let heading: number | null = null;
  let last: Spoken | null = null;
  const subs = new Set<(s: CompassState) => void>();
  const offs: (() => void)[] = [];

  const emit = () => {
    for (const cb of subs) cb(s);
  };

  const update = () => {
    if (!here) return emit();
    const d = distanceM(here, target);
    const b = bearingDeg(here, target);
    const rel = heading === null ? null : (b - heading + 360) % 360;
    const facing = rel !== null && Math.abs(angleDiff(0, rel)) <= FACING_DEG;
    if (facing && !s.facing) {
      // SRS-CMP-3: haptic tick where supported, else a short tone.
      if (!env.vibrate(30)) env.tone();
    }
    const line = phrase(name, d, rel);
    const now = env.now();
    let spoken = s.line;
    if (shouldSpeak(last, now, rel, d)) {
      last = { at: now, angle: rel, distanceM: d };
      spoken = line;
      if (s.talking) env.speak(line);
    }
    s = { ...s, distance_m: d, bearing_deg: b, rel_deg: rel, facing, line: spoken };
    emit();
  };

  return {
    start() {
      // 1. Orientation, first and synchronous inside the tap (spike E3).
      const ask = env.requestOrientationPermission
        ? env.requestOrientationPermission()
        : Promise.resolve("unsupported-no-prompt");
      // 2. Location second. watchPosition only registers here; the prompt shows after.
      offs.push(
        env.watchPosition(
          (p) => {
            here = { lat: p.lat, lon: p.lon };
            s = { ...s, location: "granted", accuracy_m: p.accuracy };
            update();
          },
          (code) => {
            s = { ...s, location: code === 1 ? "denied" : "unavailable" };
            emit();
          },
        ),
      );
      return ask
        .then((answer) => {
          const granted = answer === "granted" || answer === "unsupported-no-prompt";
          s = { ...s, orientation: answer === "granted" ? "granted" : granted ? "unsupported" : "denied" };
          if (granted)
            offs.push(
              env.onOrientation((r) => {
                const h = headingOf(r);
                if (h === null) return;
                heading = smoothHeading(heading, h);
                update();
              }),
            );
          emit();
        })
        .catch(() => {
          s = { ...s, orientation: "error" };
          emit();
        });
    },
    stop() {
      for (const off of offs.splice(0)) off();
      env.stopSpeaking();
    },
    setTalking(on) {
      s = { ...s, talking: on };
      if (!on) env.stopSpeaking();
      else if (s.line) {
        env.speak(s.line);
        last = last ? { ...last, at: env.now() } : last;
      }
      emit();
    },
    subscribe(cb) {
      subs.add(cb);
      cb(s);
      return () => subs.delete(cb);
    },
    state: () => s,
  };
}
