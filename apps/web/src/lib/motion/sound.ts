// Flare's four sounds, played with Web Audio for low latency.
// Rules (docs/design/motion.md, section 5):
// - Nothing plays before the first user gesture. installAudioStart() waits for the
//   first tap or key, then creates and resumes the AudioContext inside that gesture
//   and plays one silent sample (how iOS lets a page start audio).
// - The audio session is "ambient", so the iPhone silent switch mutes Flare
//   (WebKit default; set explicitly where navigator.audioSession exists).
// - The in-app mute is remembered on this phone (localStorage "flare.sound" = "off").
// - Never while the page is hidden; never the same sound twice within 120 ms.
// Sounds are synthesized by design/motion/make-sounds.mjs. Gone is silent on purpose.
export type SoundName = "yes" | "lit" | "ember" | "facing";
const FILES: Record<SoundName, { m4a?: string; wav: string; gain: number }> = {
  yes: { wav: "/sounds/yes.wav", gain: 0.9 },
  lit: { m4a: "/sounds/lit.m4a", wav: "/sounds/lit.wav", gain: 0.85 },
  ember: { m4a: "/sounds/ember.m4a", wav: "/sounds/ember.wav", gain: 0.9 },
  facing: { wav: "/sounds/facing.wav", gain: 0.9 },
};
const KEY = "flare.sound";

type AC = AudioContext;
let ctx: AC | null = null;
let master: GainNode | null = null;
const buffers = new Map<SoundName, AudioBuffer>();
const lastPlay = new Map<SoundName, number>();
let muted = read();
const listeners = new Set<(m: boolean) => void>();
export const log: string[] = [];

function read() {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(KEY) === "off";
  } catch {
    return false;
  }
}
export const isMuted = () => muted;
export const isAudioRunning = () => !!ctx && ctx.state === "running";
export function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem(KEY, m ? "off" : "on");
  } catch {
    /* private mode: keep in memory */
  }
  for (const f of listeners) f(m);
}
export function onMuteChange(f: (m: boolean) => void) {
  listeners.add(f);
  return () => listeners.delete(f);
}

function pickUrl(n: SoundName) {
  const f = FILES[n];
  const a = typeof Audio !== "undefined" ? new Audio() : null;
  return f.m4a && a?.canPlayType('audio/mp4; codecs="mp4a.40.2"') ? f.m4a : f.wav;
}

async function load(n: SoundName) {
  if (!ctx || buffers.has(n)) return;
  const url = pickUrl(n);
  try {
    const data = await (await fetch(url)).arrayBuffer();
    buffers.set(n, await ctx.decodeAudioData(data));
    log.push(`loaded ${url}`);
  } catch (e) {
    log.push(`load failed ${url}: ${(e as Error).message}`);
  }
}

/** Must run inside a user gesture handler (tap or key). Safe to call many times. */
export function startAudio() {
  if (typeof window === "undefined") return;
  try {
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    if (nav.audioSession && nav.audioSession.type !== "ambient") nav.audioSession.type = "ambient";
    if (!ctx) {
      const C =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!C) return;
      ctx = new C({ latencyHint: "interactive" });
      master = ctx.createGain();
      master.gain.value = 0.8;
      master.connect(ctx.destination);
    }
    if (ctx.state !== "running") ctx.resume();
    // iOS: start one silent sample inside the gesture.
    const b = ctx.createBuffer(1, 1, ctx.sampleRate);
    const s = ctx.createBufferSource();
    s.buffer = b;
    s.connect(ctx.destination);
    s.start(0);
    (Object.keys(FILES) as SoundName[]).forEach(load);
  } catch (e) {
    log.push(`audio start failed: ${(e as Error).message}`);
  }
}

let installed = false;
/** Arms startAudio() for the first real gesture on the page. Call once from the root layout. */
export function installAudioStart() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const go = () => {
    startAudio();
    if (isAudioRunning()) {
      window.removeEventListener("pointerdown", go, true);
      window.removeEventListener("keydown", go, true);
    }
  };
  window.addEventListener("pointerdown", go, true);
  window.addEventListener("keydown", go, true);
}

/** Plays a sound if allowed. Returns true if it played. */
export function play(n: SoundName): boolean {
  if (muted || !ctx || !master || document.hidden) return false;
  if (ctx.state !== "running") {
    ctx.resume();
    return false;
  }
  const b = buffers.get(n);
  if (!b) {
    load(n);
    return false;
  }
  const now = performance.now();
  if (now - (lastPlay.get(n) ?? -1e9) < 120) return false;
  lastPlay.set(n, now);
  const src = ctx.createBufferSource();
  const g = ctx.createGain();
  g.gain.value = FILES[n].gain;
  src.buffer = b;
  src.connect(g).connect(master);
  src.start();
  return true;
}

/** Like play(), but if the sound is still loading it waits up to maxWaitMs, then gives up. */
export async function playWhenReady(n: SoundName, maxWaitMs = 400): Promise<boolean> {
  if (play(n)) return true;
  if (muted || !ctx) return false;
  const t0 = performance.now();
  await load(n);
  if (ctx.state !== "running") await ctx.resume().catch(() => {});
  return performance.now() - t0 <= maxWaitMs ? play(n) : false;
}

export function audioInfo() {
  const nav = navigator as Navigator & { audioSession?: { type: string } };
  return {
    context: ctx ? ctx.state : "not created (waits for a tap)",
    sampleRate: ctx?.sampleRate ?? 0,
    baseLatencyMs: ctx?.baseLatency ? +(ctx.baseLatency * 1000).toFixed(1) : null,
    outputLatencyMs: ctx && "outputLatency" in ctx && ctx.outputLatency ? +(ctx.outputLatency * 1000).toFixed(1) : null,
    audioSession: nav.audioSession ? nav.audioSession.type : "not available",
    loaded: [...buffers.keys()],
    muted,
  };
}
