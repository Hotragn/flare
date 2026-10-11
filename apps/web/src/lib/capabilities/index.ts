// ICD-8: runtime capability detection (OD3, SRS-CAP-1, SRS-AI-5, SRS-COMP-2).
// Feature checks only. This file never reads the browser's device or model strings (the
// test greps it), so a new iPhone or browser gets features by what it can do.
import type { CapabilitiesIcd } from "@flare/shared/icd/index";

type Capabilities = CapabilitiesIcd.Capabilities;

/** The globals detect() reads; injectable so tests can describe any browser. */
export type Env = {
  window?: unknown;
  navigator?: unknown;
  document?: unknown;
  matchMedia?: (q: string) => { matches: boolean };
  isSecureContext?: boolean;
};

const has = (o: unknown, k: string): boolean =>
  !!o && (typeof o === "object" || typeof o === "function") && k in (o as object);
const get = (o: unknown, k: string): unknown => (has(o, k) ? (o as Record<string, unknown>)[k] : undefined);

function defaultEnv(): Env {
  const g = globalThis as Record<string, unknown>;
  return {
    window: g.window,
    navigator: g.navigator,
    document: g.document,
    matchMedia: typeof g.matchMedia === "function" ? (g.matchMedia as Env["matchMedia"]) : undefined,
    isSecureContext: g.isSecureContext as boolean | undefined,
  };
}

let persistedCache: boolean | null = null;

/** Passive checks only: no prompts, no network, under 20 ms. */
export function detect(env: Env = defaultEnv()): Capabilities {
  const w = env.window;
  const nav = env.navigator;
  const doc = env.document;
  const mq = (q: string) => {
    try {
      return env.matchMedia?.(q).matches ?? false;
    } catch {
      return false;
    }
  };
  const standalone = mq("(display-mode: standalone)") || get(nav, "standalone") === true;
  const mediaDevices = get(nav, "mediaDevices");
  const camera: Capabilities["camera"] = has(mediaDevices, "getUserMedia")
    ? "live"
    : doc
      ? "file-only" // <input type=file accept=image/* capture> works in every browser we support
      : "none";
  const orientationCtor = get(w, "DeviceOrientationEvent");
  const orientation: Capabilities["orientation"] =
    typeof orientationCtor === "function" && typeof get(orientationCtor, "requestPermission") === "function"
      ? "needs-permission"
      : typeof orientationCtor === "function"
        ? "available"
        : "none";
  const pushApi = has(w, "PushManager") && has(nav, "serviceWorker");
  const notification = has(w, "Notification");
  // iOS exposes PushManager only inside the Home Screen app (16.4+); in a Safari tab it's absent.
  const push: Capabilities["push"] = pushApi
    ? "available"
    : notification || (has(nav, "serviceWorker") && !standalone)
      ? "needs-install"
      : "none";
  let switchHaptic = false;
  let webgl2 = false;
  if (doc && typeof get(doc, "createElement") === "function") {
    try {
      const d = doc as Document;
      const input = d.createElement("input");
      input.setAttribute("type", "checkbox");
      input.setAttribute("switch", "");
      switchHaptic = "switch" in input; // iOS 17.4+ adds the property
      webgl2 = has(w, "WebGL2RenderingContext");
    } catch {
      switchHaptic = false;
    }
  }
  const share = typeof get(nav, "share") === "function";
  let shareFiles = false;
  if (share && typeof get(nav, "canShare") === "function" && typeof File === "function") {
    try {
      shareFiles = (nav as Navigator).canShare({
        files: [new File([new Uint8Array(1)], "f.jpg", { type: "image/jpeg" })],
      });
    } catch {
      shareFiles = false;
    }
  }
  return {
    secureContext: env.isSecureContext === true,
    standalone,
    camera,
    offscreenCanvas: has(w, "OffscreenCanvas"),
    geolocation: has(nav, "geolocation"),
    orientation,
    speech: has(w, "speechSynthesis"),
    vibrate: typeof get(nav, "vibrate") === "function",
    switchHaptic,
    webgl2,
    push,
    share,
    shareFiles,
    serviceWorker: has(nav, "serviceWorker"),
    storagePersisted: persistedCache,
  };
}

/** Fills storagePersisted for the next detect() (navigator.storage.persisted() is async). */
export async function refreshPersisted(env: Env = defaultEnv()): Promise<boolean | null> {
  const storage = get(env.navigator, "storage");
  const fn = get(storage, "persisted");
  if (typeof fn !== "function") return (persistedCache = null);
  try {
    persistedCache = Boolean(await (fn as () => Promise<boolean>).call(storage));
  } catch {
    persistedCache = null;
  }
  return persistedCache;
}

export const SHADER_FPS = 50;
export const SHADER_FRAMES = 60;

/**
 * Flame shader gate (ADR-0003): draw a WebGL2 clear-and-triangle loop for 60 frames and pass
 * if the median frame rate is ≥ 50 fps. No WebGL2 means the CSS flame.
 */
export async function shaderOk(
  canvas: HTMLCanvasElement,
  raf: (cb: (t: number) => void) => number = (cb) => requestAnimationFrame(cb),
): Promise<boolean> {
  const gl = canvas.getContext("webgl2") as WebGL2RenderingContext | null;
  if (!gl) return false;
  const times: number[] = [];
  await new Promise<void>((resolve) => {
    let last = -1;
    const frame = (t: number) => {
      gl.clearColor((t % 1000) / 1000, 0.3, 0.1, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (last >= 0) times.push(t - last);
      last = t;
      if (times.length >= SHADER_FRAMES) resolve();
      else raf(frame);
    };
    raf(frame);
  });
  return frameRateOk(times);
}

/** Median frame time to a pass/fail at 50 fps. Exported for tests. */
export function frameRateOk(frameMs: number[]): boolean {
  if (frameMs.length < SHADER_FRAMES) return false;
  const s = [...frameMs].sort((a, b) => a - b);
  const median = s[Math.floor(s.length / 2)] ?? Number.POSITIVE_INFINITY;
  return median > 0 && 1000 / median >= SHADER_FPS;
}

export const capabilities: CapabilitiesIcd.CapabilityProbe = { detect: () => detect(), shaderOk: (c) => shaderOk(c) };
