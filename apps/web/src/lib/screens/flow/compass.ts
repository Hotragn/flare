// Compass math and sensors for I7 (FE4). Patterns from spike E3 (docs/engineering/03-spikes.md):
// DeviceOrientationEvent.requestPermission() is the first call in the tap handler, before any
// await; location is second. iOS gives webkitCompassHeading (degrees from north, clockwise);
// elsewhere deviceorientationabsolute's alpha is counter-clockwise, so heading = 360 - alpha.
// Positions stay on the phone (SRS-PRIV): nothing here sends anything.
import type { LatLon } from "@flare/shared/icd/map";

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
type HeadingEvent = DeviceOrientationEvent & { webkitCompassHeading?: number };

export type Reading = { heading: number | null; position: LatLon | null; accuracy: number | null };
export type SensorState = "asking" | "on" | "orientation-denied" | "no-orientation" | "gps-denied" | "no-gps";

/**
 * Starts both sensors. Call straight from the tap handler: the orientation permission prompt
 * must be the first thing it does (spike E3). Returns a stop function.
 */
export function startSensors(onReading: (r: Reading) => void, onState: (s: SensorState) => void): () => void {
  const r: Reading = { heading: null, position: null, accuracy: null };
  const stops: (() => void)[] = [];
  const Ctor = (globalThis as { DeviceOrientationEvent?: OrientationCtor }).DeviceOrientationEvent;
  const ask = Ctor?.requestPermission?.(); // first call in the gesture, before any await

  const onOrient = (e: Event) => {
    const ev = e as HeadingEvent;
    let h: number | null = null;
    if (typeof ev.webkitCompassHeading === "number") h = ev.webkitCompassHeading;
    else if (ev.absolute && typeof ev.alpha === "number") h = (360 - ev.alpha) % 360;
    if (h === null) return;
    r.heading = h;
    onReading({ ...r });
  };
  let stopped = false;
  const listen = () => {
    if (stopped) return; // the person left before the prompt was answered
    const name = "ondeviceorientationabsolute" in globalThis ? "deviceorientationabsolute" : "deviceorientation";
    globalThis.addEventListener(name, onOrient);
    stops.push(() => globalThis.removeEventListener(name, onOrient));
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
        r.position = { lat: p.coords.latitude, lon: p.coords.longitude };
        r.accuracy = p.coords.accuracy;
        onState("on");
        onReading({ ...r });
      },
      (err) => onState(err.code === err.PERMISSION_DENIED ? "gps-denied" : "no-gps"),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20_000 },
    );
    stops.push(() => navigator.geolocation.clearWatch(id));
  } else onState("no-gps");

  return () => {
    stopped = true;
    for (const s of stops) s();
  };
}
