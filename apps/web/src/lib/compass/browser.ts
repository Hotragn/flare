// The real CompassEnv for browsers. Coordinates never leave the phone: nothing here sends
// anything anywhere. Speech uses the Web Speech API; the tone uses Web Audio.
import type { CompassEnv, OrientationReading } from "./compass.ts";

type IOSOrientation = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> };

let audio: AudioContext | null = null;

/** A 120 ms 880 Hz blip. Call once inside a tap first (primeAudio) so iOS lets it play later. */
export function tone(): void {
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
  } catch {
    // No Web Audio: the arrow and the voice still work.
  }
}

/** iOS only plays audio started from a tap; call this in the same tap as start(). */
export function primeAudio(): void {
  try {
    audio ??= new AudioContext();
    void audio.resume();
    if ("speechSynthesis" in globalThis) speechSynthesis.speak(new SpeechSynthesisUtterance(""));
  } catch {
    // No audio APIs: nothing to prime.
  }
}

export function browserEnv(): CompassEnv {
  const DOE = (globalThis as { DeviceOrientationEvent?: IOSOrientation }).DeviceOrientationEvent;
  const ask = typeof DOE?.requestPermission === "function" ? DOE.requestPermission.bind(DOE) : undefined;
  const env: CompassEnv = {
    onOrientation(cb) {
      const h = (e: Event) => cb(e as unknown as OrientationReading);
      window.addEventListener("deviceorientation", h);
      window.addEventListener("deviceorientationabsolute", h);
      return () => {
        window.removeEventListener("deviceorientation", h);
        window.removeEventListener("deviceorientationabsolute", h);
      };
    },
    watchPosition(ok, err) {
      if (!("geolocation" in navigator)) {
        err(2);
        return () => {};
      }
      const id = navigator.geolocation.watchPosition(
        (p) => ok({ lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy }),
        (e) => err(e.code),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
      );
      return () => navigator.geolocation.clearWatch(id);
    },
    speak(text) {
      if (!("speechSynthesis" in globalThis)) return;
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-US";
      speechSynthesis.speak(u);
    },
    stopSpeaking() {
      if ("speechSynthesis" in globalThis) speechSynthesis.cancel();
    },
    vibrate(ms) {
      return typeof navigator.vibrate === "function" ? navigator.vibrate(ms) : false;
    },
    tone,
    now: () => Date.now(),
  };
  if (ask) env.requestOrientationPermission = ask;
  return env;
}
