// Compass check (spike E3, device checklist step 6).
// The iOS rule this page proves: DeviceOrientationEvent.requestPermission() must be called
// from the tap itself, before any other await, or Safari refuses it. So the tap handler asks
// for orientation first and location second.
// Direction logic is the app's own guide (guide.js, generated from src/lib/compass/guide.ts):
// circular smoothing, screen rotation, tilt gate, GPS course when walking, the accuracy gate
// near the spot, last good bearing, facing hysteresis, and the flat / figure 8 hints.
// Haptics can't fire without a tap on iOS, so "facing" plays a short tone (SRS-CMP-3).
// Coordinates stay on this phone: the report records positions only as metres north and east
// of the marked spot, so a run can be replayed in tests without saying where it happened.
import { angleDiff, createGuide, unwrapAngle } from "./guide.js";

const $ = (id) => document.getElementById(id);
const R = {
  ua: navigator.userAgent,
  secure: window.isSecureContext,
  orientationApi: typeof DeviceOrientationEvent !== "undefined",
  needsPermission: typeof DeviceOrientationEvent?.requestPermission === "function",
  orientation: "not asked",
  location: "not asked",
  headingSource: "none",
  eventsPerSecond: 0,
  compassAccuracy: [],
  firstFixMs: null,
  bestAccuracyM: null,
  facingTicks: 0,
  nearCount: 0,
  hints: { flat: 0, figure8: 0 },
  spoken: 0,
  errors: [],
  // Replay streams (capped): headings at up to 10 per second, every fix as relative metres.
  stream: { headings: [], fixes: [] },
};
const MAX_HEADINGS = 3000;
const MAX_FIXES = 600;
const guide = createGuide(null);
let target = null;
let here = null;
let events = 0;
let lastHeadingAt = -1;
let shown = 0;
let lastSpoken = { at: 0, rel: null, dist: null };
let audio = null;
const t0 = performance.now();
const ms = () => Math.round(performance.now() - t0);

function show() {
  const brief = { ...R, stream: { headings: R.stream.headings.length, fixes: R.stream.fixes.length } };
  $("out").textContent = JSON.stringify(brief, null, 2);
}

function screenAngle() {
  const a = screen.orientation?.angle;
  if (typeof a === "number") return a;
  return typeof window.orientation === "number" ? (window.orientation + 360) % 360 : 0;
}
/** Metres north and east of the marked spot (no coordinates in the report). */
function relative(p) {
  if (!target) return null;
  const north = (p.lat - target.lat) * 111_320;
  const east = (p.lon - target.lon) * 111_320 * Math.cos((target.lat * Math.PI) / 180);
  return { n: Math.round(north * 10) / 10, e: Math.round(east * 10) / 10 };
}

function onOrientation(e) {
  events++;
  let h = null;
  if (typeof e.webkitCompassHeading === "number") {
    h = e.webkitCompassHeading;
    R.headingSource = "webkitCompassHeading";
    if (typeof e.webkitCompassAccuracy === "number" && R.compassAccuracy.length < 50)
      R.compassAccuracy.push(Math.round(e.webkitCompassAccuracy));
  } else if (e.absolute && typeof e.alpha === "number") {
    h = (360 - e.alpha) % 360;
    R.headingSource = "alpha (absolute)";
  }
  if (h === null) return;
  const sample = {
    t: ms(),
    heading: h,
    accuracy: typeof e.webkitCompassAccuracy === "number" ? e.webkitCompassAccuracy : null,
    beta: e.beta,
    gamma: e.gamma,
    screen: screenAngle(),
  };
  if (target && R.stream.headings.length < MAX_HEADINGS && sample.t - lastHeadingAt >= 100) {
    lastHeadingAt = sample.t;
    R.stream.headings.push({
      t: sample.t,
      h: Math.round(h),
      a: sample.accuracy === null ? null : Math.round(sample.accuracy),
      b: Math.round(e.beta ?? 0),
      g: Math.round(e.gamma ?? 0),
      s: sample.screen,
    });
  }
  render(guide.orientation(sample));
}

function tone() {
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume();
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.15, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.12);
    o.connect(g).connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + 0.12);
  } catch (err) {
    R.errors.push(`tone: ${err.message}`);
  }
}

function speak(text) {
  if (!$("speak").checked || !("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  R.spoken++;
}

function direction(rel) {
  const a = Math.abs(rel);
  if (a <= 15) return "straight ahead";
  if (a > 135) return "behind you";
  if (a <= 45) return rel < 0 ? "slightly left" : "slightly right";
  return rel < 0 ? "to your left" : "to your right";
}

let wasFacing = false;
let lastHint = null;
function render(s) {
  if (s.hint !== lastHint && s.hint) R.hints[s.hint]++;
  lastHint = s.hint;
  $("hint").textContent =
    s.hint === "flat"
      ? "Hold your phone flat to get a direction."
      : s.hint === "figure8"
        ? "Move your phone in a figure 8 to fix the compass."
        : "";
  if (!target || s.distance_m === null) return;
  const meters = Math.round(s.distance_m);
  let words;
  if (s.near) {
    words = `You're close: within about ${Math.max(2, Math.round(2 * (s.accuracy_m ?? 3)))} meters. Look around.`;
  } else if (s.rel_deg === null) {
    words = String(R.orientation).startsWith("granted")
      ? `Target, ${meters} meters. Waiting for a direction.`
      : `Target, ${meters} meters. Motion is off, so no direction.`;
  } else {
    words = `Target, ${meters} meters, ${direction(s.rel_deg)}.`;
    shown = unwrapAngle(shown, s.rel_deg);
    $("arrow").style.transform = `rotate(${shown}deg)`;
  }
  $("arrow").style.opacity = s.near || s.rel_deg === null ? "0.3" : "1";
  if (s.stale) words += " (last known)";
  $("spoken").textContent = words;
  $("facing").textContent = s.near
    ? ""
    : s.facing
      ? "Facing it."
      : s.source === "course"
        ? "Using your walking direction."
        : "";
  if (s.facing && !wasFacing) {
    R.facingTicks++;
    tone();
  }
  wasFacing = s.facing;
  // SRS-CMP-2: speak again when the direction turns 30 degrees, the distance halves, or 60 s pass.
  const now = Date.now();
  const rel = s.near ? null : s.rel_deg;
  const turned = lastSpoken.rel !== null && rel !== null && Math.abs(angleDiff(lastSpoken.rel, rel)) >= 30;
  const halved = lastSpoken.dist !== null && s.distance_m <= lastSpoken.dist / 2;
  const nearNow = s.near && lastSpoken.rel !== "near";
  if (lastSpoken.at === 0 || turned || halved || nearNow || now - lastSpoken.at >= 60000) {
    speak(words);
    if (s.near) R.nearCount++;
    lastSpoken = { at: now, rel: s.near ? "near" : rel, dist: s.distance_m };
  }
}

$("start").addEventListener("click", async () => {
  // 1. Orientation first, inside the tap, before any await.
  const ask = R.needsPermission
    ? DeviceOrientationEvent.requestPermission()
    : Promise.resolve("granted (no prompt on this browser)");
  try {
    R.orientation = await ask;
  } catch (err) {
    R.orientation = `error: ${err.name}`;
  }
  if (String(R.orientation).startsWith("granted")) {
    window.addEventListener("deviceorientation", onOrientation);
    window.addEventListener("deviceorientationabsolute", onOrientation);
    setInterval(() => {
      R.eventsPerSecond = events;
      events = 0;
      render(guide.tick(ms()));
      show();
    }, 1000);
  }
  $("perm").textContent = String(R.orientation).startsWith("granted")
    ? "Motion allowed. Asking for location…"
    : "Motion is off. Settings, Safari, Motion & Orientation Access. Distance still works.";
  // 2. Location second.
  if (!("geolocation" in navigator)) {
    R.location = "no API";
    show();
    return;
  }
  navigator.geolocation.watchPosition(
    (p) => {
      R.location = "granted";
      if (R.firstFixMs === null) R.firstFixMs = ms();
      R.bestAccuracyM = Math.round(Math.min(R.bestAccuracyM ?? Infinity, p.coords.accuracy));
      here = { lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy };
      const fix = {
        t: ms(),
        lat: here.lat,
        lon: here.lon,
        accuracy: p.coords.accuracy,
        speed: p.coords.speed,
        course: p.coords.heading,
      };
      const rel = relative(here);
      if (rel && R.stream.fixes.length < MAX_FIXES)
        R.stream.fixes.push({ t: fix.t, ...rel, acc: Math.round(fix.accuracy * 10) / 10, v: fix.speed, c: fix.course });
      $("mark").disabled = false;
      $("perm").textContent = `Ready. Location within ${Math.round(p.coords.accuracy)} m.`;
      render(guide.position(fix));
      show();
    },
    (err) => {
      R.location = `error ${err.code}: ${err.message}`;
      if (err.code === 1) $("perm").textContent = "Location is off. Check Location Services for Safari.";
      show();
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
  );
  show();
});

$("mark").addEventListener("click", () => {
  if (!here) return;
  // Wait for a good fix before marking: a coarse first fix puts the spot in the wrong place.
  if (here.acc > 15) {
    $("target").textContent =
      `Location is within ${Math.round(here.acc)} m. Wait a few seconds for under 15 m, then mark.`;
    return;
  }
  target = { lat: here.lat, lon: here.lon };
  tone(); // unlocks audio on iOS while we still have a tap
  $("target").textContent =
    `Marked (within ${Math.round(here.acc)} m). Walk about 30 m away and follow the arrow back.`;
  lastSpoken = { at: 0, rel: null, dist: null };
  R.stream = { headings: [], fixes: [] };
  render(guide.setTarget(target));
});

$("copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(JSON.stringify(R, null, 2));
    $("copy").textContent = "Copied";
  } catch {
    $("copy").textContent = "Select the text above";
  }
});
$("send").addEventListener("click", async () => {
  try {
    const r = await fetch("/api/device-check", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "compass", report: R }),
    });
    $("send").textContent = r.ok ? "Sent" : `HTTP ${r.status}`;
  } catch {
    $("send").textContent = "Laptop not reachable";
  }
});
window.__compass = { R, guide };
show();
