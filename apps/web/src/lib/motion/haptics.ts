// Haptics with honest fallbacks (research and sources: docs/design/motion.md, section 6).
//
// 1. navigator.vibrate: Chrome on Android. Not in any Safari (caniuse "Vibration API").
// 2. iPhone Safari, iOS 17.4+: <input type="checkbox" switch> plays the system haptic
//    when it toggles from a trusted tap. Two ways in:
//    a) hapticTap (Svelte action): a transparent <label> for a hidden switch is laid
//       over the button, so the user's own finger toggles the switch. Reported to work
//       on iOS 26.5+ (tappt PR #5, ios-haptics 3.x). One tick per tap.
//    b) a script click on a hidden switch during a tap handler. Reported to work on
//       iOS 17.4 to 26.4 only; WebKit made it untrusted in 26.5 (ios-haptics README).
// 3. Otherwise no haptic. Callers always pair a haptic with a sound or a visual change,
//    so nothing depends on it.
// Rules: only as feedback for a real user action or a state the user is watching;
// at most one haptic per 400 ms; off when the user turns haptics off in Flare.
export type HapticKind = "tap" | "success" | "facing";
const PATTERN: Record<HapticKind, number | number[]> = { tap: 12, success: [18, 70, 28], facing: 10 };
const KEY = "flare.haptics";
let last = -1e9;
export const hlog: string[] = [];

export function hapticsEnabled() {
  try {
    return typeof localStorage === "undefined" || localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}
export function setHapticsEnabled(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    /* memory only */
  }
}

export function support() {
  if (typeof window === "undefined") return { vibrate: false, switchInput: false, userActivation: false };
  return {
    vibrate: typeof navigator.vibrate === "function",
    switchInput: typeof HTMLInputElement !== "undefined" && "switch" in HTMLInputElement.prototype,
    userActivation: "userActivation" in navigator,
  };
}

/** iOS major.minor from Safari's "Version/26.6.1", or null elsewhere. */
export function iosSafariVersion(ua = typeof navigator === "undefined" ? "" : navigator.userAgent): number | null {
  if (!/iPhone|iPad|iPod/.test(ua)) return null;
  const m = ua.match(/Version\/(\d+)\.(\d+)/);
  return m ? Number(m[1]) + Number(m[2]) / 100 : null;
}
/** WebKit made script clicks on a switch untrusted in 26.5: they toggle but never buzz. */
export function scriptSwitchWorks(ua?: string): boolean {
  const v = iosSafariVersion(ua);
  return v === null || v < 26.05;
}

function activeGesture() {
  const ua = (navigator as Navigator & { userActivation?: { isActive: boolean } }).userActivation;
  return ua ? ua.isActive : true;
}
function stickyGesture() {
  const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
  return ua ? ua.hasBeenActive : true;
}

let hidden: HTMLLabelElement | null = null;
function hiddenSwitch() {
  if (hidden) return hidden;
  const label = document.createElement("label");
  label.setAttribute("aria-hidden", "true");
  label.style.cssText =
    "position:fixed;left:-100px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", "");
  input.tabIndex = -1;
  label.append(input);
  document.body.append(label);
  hidden = label;
  return label;
}

/**
 * Plays a haptic if this phone can. Returns what it used: "vibrate", "switch",
 * or "none" (then rely on the sound and the visual change you already show).
 */
export function haptic(kind: HapticKind): "vibrate" | "switch" | "none" {
  if (typeof window === "undefined" || !hapticsEnabled()) return "none";
  const now = performance.now();
  if (now - last < 400) return "none";
  const s = support();
  if (s.vibrate && stickyGesture()) {
    if (navigator.vibrate(PATTERN[kind])) {
      last = now;
      hlog.push(`vibrate ${kind}`);
      return "vibrate";
    }
  }
  if (s.switchInput && activeGesture() && scriptSwitchWorks()) {
    hiddenSwitch().click(); // iOS 17.4 to 26.4 only; skipped on 26.5+ where it is untrusted
    last = now;
    hlog.push(`switch click ${kind}`);
    return "switch";
  }
  return "none";
}

/**
 * Svelte action for a button whose tap should tick (the yes, "I'm here").
 * On Safari with the switch input it lays a transparent label over the button,
 * so the finger's own tap toggles a hidden switch (works on iOS 26.5+, one tick).
 * Elsewhere it calls haptic("tap") on click (navigator.vibrate on Android).
 * The click still reaches the button once; the switch's own click is stopped.
 */
export function hapticTap(node: HTMLElement, kind: HapticKind = "tap") {
  const s = support();
  if (!s.switchInput) {
    const onClick = () => haptic(kind);
    node.addEventListener("click", onClick);
    return { destroy: () => node.removeEventListener("click", onClick) };
  }
  if (getComputedStyle(node).position === "static") node.style.position = "relative";
  const label = document.createElement("label");
  label.setAttribute("aria-hidden", "true");
  label.dataset.haptic = kind;
  label.style.cssText =
    "position:absolute;inset:0;z-index:1;border-radius:inherit;cursor:inherit;-webkit-tap-highlight-color:transparent";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", "");
  input.tabIndex = -1;
  input.setAttribute("aria-hidden", "true");
  input.style.cssText = "position:absolute;opacity:0;width:1px;height:1px;pointer-events:none;margin:0";
  input.addEventListener("click", (e) => {
    e.stopPropagation();
    hlog.push(`switch tap ${kind}`);
  });
  label.append(input);
  const sync = () => {
    label.style.pointerEvents = hapticsEnabled() ? "auto" : "none";
  };
  sync();
  node.append(label);
  const onClick = () => {
    last = performance.now();
    sync();
  };
  node.addEventListener("click", onClick);
  return {
    destroy: () => {
      label.remove();
      node.removeEventListener("click", onClick);
    },
  };
}
