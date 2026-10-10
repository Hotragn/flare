// Motion core: tokens for JS, easing curves, and the reduced-motion check.
// Durations and curves come from design/system/tokens.json (copied in by
// scripts/sync-assets.mjs), so CSS and JS motion share one source.
import tokens from "#lib/generated/tokens.json";

const ms = (v: string) => parseFloat(v);
export const DUR = Object.fromEntries(Object.entries(tokens.motion.dur).map(([k, v]) => [k, ms(v)])) as Record<
  keyof typeof tokens.motion.dur,
  number
>;

/** Cubic bezier easing, same math as CSS cubic-bezier(). */
export function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i++) {
      const e = sx(t) - x, d = dx(t);
      if (Math.abs(e) < 1e-5 || Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    return sy(Math.min(1, Math.max(0, t)));
  };
}

const parse = (css: string) => {
  const m = css.match(/cubic-bezier\(([^)]+)\)/);
  if (!m) return (x: number) => x;
  const [a, b, c, d] = m[1].split(",").map(Number);
  return bezier(a, b, c, d);
};
export type EaseName = keyof typeof tokens.motion.ease;
export const EASE = Object.fromEntries(Object.entries(tokens.motion.ease).map(([k, v]) => [k, parse(v)])) as Record<
  EaseName,
  (x: number) => number
>;

/** Damped spring position at time t (seconds), from 0 to 1. */
export function spring(name: keyof typeof tokens.motion.spring) {
  const { stiffness, damping, mass } = tokens.motion.spring[name];
  const w0 = Math.sqrt(stiffness / mass), z = damping / (2 * Math.sqrt(stiffness * mass));
  const wd = w0 * Math.sqrt(Math.max(0, 1 - z * z));
  return (t: number) =>
    z < 1 ? 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + ((z * w0) / wd) * Math.sin(wd * t)) : 1 - Math.exp(-w0 * t) * (1 + w0 * t);
}
export const SPRING = tokens.motion.spring;

/**
 * Reduced motion is on when the OS asks for it, or when the element (or the page)
 * sits inside [data-reduce-motion] (used by exports, tests and the in-app setting).
 */
export function reducedMotion(el?: Element | null): boolean {
  if (typeof window === "undefined") return true;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return true;
  if (el?.closest?.("[data-reduce-motion]")) return true;
  return document.documentElement.hasAttribute("data-reduce-motion");
}

/**
 * Kindling size step per yes (docs/design/motion.md 3.1). The host's own yes is 55%,
 * the last yes before quorum is 90%, Lit is 100%. Returns Flame `progress` (0..1).
 */
export function kindlingProgress(have: number, quorum: number) {
  if (quorum <= 2) return 0;
  return Math.min(1, Math.max(0, (have - 1) / (quorum - 2)));
}

/** Calls fn whenever the OS reduced-motion setting changes. Returns an unsubscribe. */
export function onReducedMotionChange(fn: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", fn);
  return () => mq.removeEventListener("change", fn);
}
