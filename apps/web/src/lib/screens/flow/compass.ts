// Compass math and sensors for I7 (FE4). The direction logic lives in lib/compass/guide.ts. Patterns from spike E3 (docs/engineering/03-spikes.md):
// DeviceOrientationEvent.requestPermission() is the first call in the tap handler, before any
// await; location is second. iOS gives webkitCompassHeading (degrees from north, clockwise);
// elsewhere deviceorientationabsolute's alpha is counter-clockwise, so heading = 360 - alpha.
// Positions stay on the phone (SRS-PRIV): nothing here sends anything.
import type { LatLon } from "@flare/shared/icd/map";
import type { Guide, GuideState } from "#lib/compass/guide.ts";

const R = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in metres. */
export function distanceM(a: LatLon, b: LatLon): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial bearing from a to b, degrees clockwise from north, 0 to 360. */
export function bearingDeg(a: LatLon, b: LatLon): number {
  const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat));
  const x =
    Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) -
    Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Target bearing relative to where the phone points, -180 to 180 (negative = left). */
export function relative(target: number, heading: number): number {
  return ((((target - heading) % 360) + 540) % 360) - 180;
}

/** Rounds for speech and display: 10 m steps under 1 km. */
export const roundMeters = (m: number): number =>
  m < 100 ? Math.max(5, Math.round(m / 5) * 5) : Math.round(m / 10) * 10;

type OrientationCtor = { requestPermission?: () => Promise<"granted" | "denied"> };
type HeadingEvent = DeviceOrientationEvent & { webkitCompassHeading?: number; webkitCompassAccuracy?: number };

export type SensorState = "asking" | "on" | "orientation-denied" | "no-orientation" | "gps-denied" | "no-gps";

/** screen.orientation.angle, with the old iOS window.orientation as a fallback. */
function screenAngle(): number {
  const a = (globalThis as { screen?: { orientation?: { angle?: number } } }).screen?.orientation?.angle;
  if (typeof a === "number") return a;
  const w = (globalThis as { orientation?: number }).orientation;
  return typeof w === "number" ? (w + 360) % 360 : 0;
}

/**
 * Starts both sensors and feeds the raw samples to the guide (lib/compass/guide.ts), which
 * smooths, gates and decides. Call straight from the tap handler: the orientation permission
 * prompt must be the first thing it does (spike E3). Returns a stop function.
 */
export function startSensors(
  guide: Guide,
  onGuide: (s: GuideState) => void,
  onState: (s: SensorState) => void,
  onFix?: (p: LatLon) => void,
): () => void {
  const stops: (() => void)[] = [];
  const Ctor = (globalThis as { DeviceOrientationEvent?: OrientationCtor }).DeviceOrientationEvent;
  const ask = Ctor?.requestPermission?.(); // first call in the gesture, before any await
  const now = () => performance.now();

  const onOrient = (e: Event) => {
    const ev = e as HeadingEvent;
    let h: number | null = null;
    if (typeof ev.webkitCompassHeading === "number") h = ev.webkitCompassHeading;
    else if (ev.absolute && typeof ev.alpha === "number") h = (360 - ev.alpha) % 360;
    if (h === null) return;
    onGuide(
      guide.orientation({
        t: now(),
        heading: h,
        accuracy: typeof ev.webkitCompassAccuracy === "number" ? ev.webkitCompassAccuracy : null,
        beta: ev.beta,
        gamma: ev.gamma,
        screen: screenAngle(),
      }),
    );
  };
  let stopped = false;
  const listen = () => {
    if (stopped) return; // the person left before the prompt was answered
    // Both: iOS sends webkitCompassHeading on deviceorientation; Chrome sends absolute alpha on
    // deviceorientationabsolute (onOrient ignores relative-only events).
    for (const name of ["deviceorientation", "deviceorientationabsolute"]) {
      globalThis.addEventListener(name, onOrient);
      stops.push(() => globalThis.removeEventListener(name, onOrient));
    }
  };
  if (!Ctor) onState("no-orientation");
  else if (ask) {
    ask.then(
      (p) => (p === "granted" ? listen() : onState("orientation-denied")),
      () => onState("orientation-denied"),
    );
  } else listen();

  if (typeof navigator !== "undefined" && navigator.geolocation) {
    const id = navigator.geolocation.watchPosition(
      (p) => {
        onState("on");
        onFix?.({ lat: p.coords.latitude, lon: p.coords.longitude });
        onGuide(
          guide.position({
            t: now(),
            lat: p.coords.latitude,
            lon: p.coords.longitude,
            accuracy: p.coords.accuracy,
            speed: p.coords.speed,
            course: p.coords.heading,
          }),
        );
      },
      // A timeout is not a refusal: keep watching, the next fix clears it.
      (err) => onState(err.code === err.PERMISSION_DENIED ? "gps-denied" : "no-gps"),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
    );
    stops.push(() => navigator.geolocation.clearWatch(id));
  } else onState("no-gps");
  // Marks a dropped fix as stale even when no sensor event arrives.
  const tick = setInterval(() => onGuide(guide.tick(now())), 2000);
  stops.push(() => clearInterval(tick));

  return () => {
    stopped = true;
    for (const s of stops) s();
  };
}
