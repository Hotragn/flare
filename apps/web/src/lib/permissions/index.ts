// Permission flows (PW6) for camera, location, motion (compass) and the order iOS needs.
// Each ask is meant to run inside a tap. Feature checks only, never device names
// (SRS-COMP-2). A "no" always has a next step the screen can show (the deck's perm.* keys).

export type MotionResult = "granted" | "denied" | "not-needed" | "unavailable";
export type Coords = { lat: number; lon: number; accuracy: number };
export type LocationResult = { ok: true; coords: Coords } | { ok: false; reason: "denied" | "unavailable" | "timeout" };
export type CameraResult = { ok: true; stream: MediaStream } | { ok: false; reason: "denied" | "unavailable" };

type OrientationCtor = { requestPermission?: () => Promise<"granted" | "denied"> };

/**
 * Motion and orientation for the compass. iOS only prompts if requestPermission() is the
 * first call in the tap handler, before any await (spike E3, ICD section 5). This function
 * makes that call synchronously, so call it first and await it later.
 */
export function askMotion(): Promise<MotionResult> {
  const Ctor = (globalThis as { DeviceOrientationEvent?: OrientationCtor }).DeviceOrientationEvent;
  if (!Ctor) return Promise.resolve("unavailable");
  if (typeof Ctor.requestPermission !== "function") return Promise.resolve("not-needed");
  let pending: Promise<"granted" | "denied">;
  try {
    pending = Ctor.requestPermission();
  } catch {
    return Promise.resolve("denied");
  }
  return pending.then(
    (r) => (r === "granted" ? "granted" : "denied"),
    () => "denied",
  );
}

/** One position fix. Asks for permission the first time (on iOS, inside a tap). */
export function askLocation(opts: { timeoutMs?: number; highAccuracy?: boolean } = {}): Promise<LocationResult> {
  const geo = (globalThis.navigator as Navigator | undefined)?.geolocation;
  if (!geo) return Promise.resolve({ ok: false, reason: "unavailable" });
  return new Promise((resolve) => {
    geo.getCurrentPosition(
      (p) =>
        resolve({ ok: true, coords: { lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy } }),
      (e) => resolve({ ok: false, reason: e.code === 1 ? "denied" : e.code === 3 ? "timeout" : "unavailable" }),
      { enableHighAccuracy: opts.highAccuracy ?? true, timeout: opts.timeoutMs ?? 15_000, maximumAge: 10_000 },
    );
  });
}

/**
 * The compass tap: orientation first (synchronously), location second (spike E3).
 * Denied motion still gives distance; denied location gives "No location" copy.
 */
export function askCompass(opts?: { timeoutMs?: number }): {
  motion: Promise<MotionResult>;
  location: Promise<LocationResult>;
} {
  const motion = askMotion();
  const location = motion.then(() => askLocation(opts));
  return { motion, location };
}

/** Back camera for the Flare photo. On "no", the screen offers "Pick a photo" (file input). */
export async function askCamera(): Promise<CameraResult> {
  const media = (globalThis.navigator as Navigator | undefined)?.mediaDevices;
  if (!media?.getUserMedia) return { ok: false, reason: "unavailable" };
  try {
    const stream = await media.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
    return { ok: true, stream };
  } catch (e) {
    const name = (e as { name?: string }).name;
    return { ok: false, reason: name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unavailable" };
  }
}

/** Passive state for a permission, without prompting. "unknown" where the API is missing. */
export async function permissionState(
  name: "geolocation" | "camera" | "notifications",
): Promise<PermissionState | "unknown"> {
  const perms = (globalThis.navigator as Navigator | undefined)?.permissions;
  if (!perms?.query) return "unknown";
  try {
    return (await perms.query({ name: name as PermissionName })).state;
  } catch {
    return "unknown";
  }
}
