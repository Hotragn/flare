// Warm voice for the compass (ADR-0027). Short clips recorded once with ElevenLabs
// (scripts/gen-voice.ts) and shipped in /voice/: no name, no place, nothing anyone typed, so
// nothing of yours is sent. Opt-in on this phone ("flare.voice" = "warm"); when it is off, a
// clip is missing or audio can't play, the compass uses the phone's own voice as before.
// Turning it on saves the clips on this phone (Cache API) so it works with no signal.

export const METERS = [
  ...Array.from({ length: 19 }, (_, i) => (i + 1) * 5),
  ...Array.from({ length: 18 }, (_, i) => 100 + i * 50),
];
export const KM = [1, 1.5, 2, 2.5, 3, 4, 5];
const CACHE = "flare-voice-1";
const KEY = "flare.voice";

export type VoiceStatus = "pointing" | "facing" | "near" | "no-orientation" | "no-gps";

const nearest = (list: number[], v: number) => list.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));

/** The clips for one compass line, in order. Mirrors the device-voice line without the name. */
export function clipsFor(status: VoiceStatus, meters: number, bearing: number, facing: boolean): string[] {
  if (status === "no-gps") return ["nogps"];
  if (status === "near") return ["close"];
  const dist =
    meters >= 1000 ? `km-${String(nearest(KM, meters / 1000)).replace(".", "_")}` : `m-${nearest(METERS, meters)}`;
  if (status === "no-orientation") return [dist, "flat"];
  if (facing && meters < 1000) return ["ahead"];
  const a = Math.abs(bearing);
  if (a < 15) return meters >= 1000 ? [dist, "ahead"] : ["ahead"];
  const dir =
    a > 135 ? "behind" : a < 45 ? (bearing < 0 ? "slightLeft" : "slightRight") : bearing < 0 ? "left" : "right";
  return [dist, `dir-${dir}`];
}

export const allClips = (): string[] => [
  "ahead",
  "close",
  "flat",
  "nogps",
  "figure8",
  ...["slightLeft", "slightRight", "left", "right", "behind"].map((d) => `dir-${d}`),
  ...METERS.map((m) => `m-${m}`),
  ...KM.map((k) => `km-${String(k).replace(".", "_")}`),
];
const url = (id: string) => `/voice/${id}.mp3`;

export function warmOn(): boolean {
  try {
    return localStorage.getItem(KEY) === "warm";
  } catch {
    return false;
  }
}

/** Turns the warm voice on or off; on saves every clip (about 680 KB) for use with no signal. */
export async function setWarm(on: boolean): Promise<void> {
  try {
    if (on) localStorage.setItem(KEY, "warm");
    else localStorage.removeItem(KEY);
  } catch {}
  if (typeof caches === "undefined") return;
  if (!on) {
    await caches.delete(CACHE).catch(() => false);
    return;
  }
  const c = await caches.open(CACHE);
  await c.addAll(allClips().map(url)).catch(() => {});
}

let current: HTMLAudioElement | null = null;
let run = 0;

export function stopWarm(): void {
  run++;
  current?.pause();
  current = null;
}

async function src(id: string): Promise<string> {
  if (typeof caches === "undefined") return url(id);
  const hit = await caches.match(url(id)).catch(() => undefined);
  return hit ? URL.createObjectURL(await hit.blob()) : url(id);
}

/** Plays the clips in order. Resolves false if any clip fails, so the caller can fall back. */
export async function playWarm(ids: string[]): Promise<boolean> {
  stopWarm();
  const mine = run;
  for (const id of ids) {
    if (mine !== run) return true; // a newer line took over
    const s = await src(id);
    const ok = await new Promise<boolean>((resolve) => {
      const a = new Audio(s);
      current = a;
      a.onended = () => resolve(true);
      a.onerror = () => resolve(false);
      a.play().catch(() => resolve(false));
    });
    if (s.startsWith("blob:")) URL.revokeObjectURL(s);
    if (!ok) return false;
  }
  return true;
}
