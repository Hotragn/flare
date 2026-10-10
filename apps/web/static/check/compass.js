// Compass check (spike E3, device checklist step 5).
// The iOS rule this page proves: DeviceOrientationEvent.requestPermission() must be called
// from the tap itself, before any other await, or Safari refuses it. So the tap handler asks
// for orientation first and location second. Heading: webkitCompassHeading (iOS), else
// alpha from deviceorientationabsolute (Android Chrome), else no direction.
// Haptics can't fire without a tap on iOS, so "facing" plays a short tone instead (SRS-CMP-3).
// Coordinates stay on this phone; results carry distances and angles only.
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
  spoken: 0,
  errors: [],
};
let heading = null;
let here = null;
let target = null;
let events = 0;
let lastSpoken = { at: 0, bearing: null, dist: null };
let audio = null;

function show() {
  $("out").textContent = JSON.stringify(R, null, 2);
}

export function bearingDeg(a, b) {
  const r = Math.PI / 180;
  const y = Math.sin((b.lon - a.lon) * r) * Math.cos(b.lat * r);
  const x =
    Math.cos(a.lat * r) * Math.sin(b.lat * r) -
    Math.sin(a.lat * r) * Math.cos(b.lat * r) * Math.cos((b.lon - a.lon) * r);
  return (Math.atan2(y, x) / r + 360) % 360;
}
export function distanceM(a, b) {
  const r = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * r) / 2) ** 2 +
    Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lon - a.lon) * r) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}
export function direction(rel) {
  const d = ((rel + 540) % 360) - 180; // -180..180, 0 = straight ahead
  if (Math.abs(d) <= 15) return "straight ahead";
  if (Math.abs(d) > 135) return "behind you";
  return d < 0 ? "to your left" : "to your right";
}

function onOrientation(e) {
  events++;
  if (typeof e.webkitCompassHeading === "number") {
    heading = e.webkitCompassHeading;
    R.headingSource = "webkitCompassHeading";
    if (typeof e.webkitCompassAccuracy === "number" && R.compassAccuracy.length < 50)
      R.compassAccuracy.push(Math.round(e.webkitCompassAccuracy));
  } else if (e.absolute && typeof e.alpha === "number") {
    heading = (360 - e.alpha) % 360;
    R.headingSource = "alpha (absolute)";
  }
  render();
}

function tone() {
  try {
    audio ??= new AudioContext();
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

let wasFacing = false;
function render() {
  if (!here || !target) return;
  const b = bearingDeg(here, target);
  const d = distanceM(here, target);
  const rel = heading === null ? null : (b - heading + 360) % 360;
  $("arrow").style.transform = `rotate(${rel ?? 0}deg)`;
  const meters = Math.round(d);
  const words =
    rel === null
      ? `Target, ${meters} meters. Hold your phone flat to get a direction.`
      : `Target, ${meters} meters, ${direction(rel)}.`;
  $("spoken").textContent = words;
  const facing = rel !== null && Math.abs(((rel + 540) % 360) - 180) <= 15;
  $("facing").textContent = facing ? "Facing it." : "";
  if (facing && !wasFacing) {
    R.facingTicks++;
    tone();
  }
  wasFacing = facing;
  // SRS-CMP-2: speak again when the bearing moves 30 degrees, the distance halves, or 60 s pass.
  const now = Date.now();
  const turned =
    lastSpoken.bearing !== null && rel !== null && Math.abs(((rel - lastSpoken.bearing + 540) % 360) - 180) >= 30;
  const halved = lastSpoken.dist !== null && d <= lastSpoken.dist / 2;
  if (lastSpoken.at === 0 || turned || halved || now - lastSpoken.at >= 60000) {
    speak(words);
    lastSpoken = { at: now, bearing: rel, dist: d };
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
    const t = setInterval(() => {
      R.eventsPerSecond = events;
      events = 0;
      show();
    }, 1000);
    setTimeout(() => clearInterval(t), 60000);
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
  const t0 = performance.now();
  navigator.geolocation.watchPosition(
    (p) => {
      R.location = "granted";
      if (R.firstFixMs === null) R.firstFixMs = Math.round(performance.now() - t0);
      R.bestAccuracyM = Math.round(Math.min(R.bestAccuracyM ?? Infinity, p.coords.accuracy));
      here = { lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy };
      $("mark").disabled = false;
      $("perm").textContent = `Ready. Location within ${Math.round(p.coords.accuracy)} m.`;
      render();
      show();
    },
    (err) => {
      R.location = `error ${err.code}: ${err.message}`;
      $("perm").textContent = "Can't find you yet. Check Location Services for Safari.";
      show();
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
  );
  show();
});

$("mark").addEventListener("click", () => {
  if (!here) return;
  target = { ...here };
  tone(); // unlocks audio on iOS while we still have a tap
  $("target").textContent = `Marked (accuracy ${Math.round(here.acc)} m). Walk away and watch the arrow.`;
  lastSpoken = { at: 0, bearing: null, dist: null };
  render();
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
window.__compass = { R, bearingDeg, distanceM, direction };
show();
