# Talking compass

Wayfinding without a map screen (SRS-CMP-1 to -3, -7). Code: `apps/web/src/lib/compass/`. Used by FE's Lit screen (FE4).

## Use

```ts
import { browserEnv, createCompass, unlockAudio } from "#lib/compass/index.ts";

button.onclick = () => {
  const c = createCompass({ target, name: hostName, env: browserEnv() }); // target saved at Lit
  void c.start();   // first call in the tap: asks motion, then location
  unlockAudio();    // same tap: lets iOS play the tone and speech later
  c.subscribe((s) => render(s)); // s.rel_deg for the arrow, s.distance_m, s.line, s.facing
};
```

`stop()` ends the sensors and speech; `setTalking(false)` silences speech but keeps updating `line`.

## Rules

| Rule | Implementation |
| --- | --- |
| iOS permission (spike E3) | `start()` calls `DeviceOrientationEvent.requestPermission()` synchronously before anything else, then registers `watchPosition`. Where the API has no prompt (Android, desktop), orientation is `"unsupported"` and listening starts at once. |
| Heading | `webkitCompassHeading` (iOS), else `360 - alpha` from absolute events (Android Chrome), else none. Low-pass across north (k = 0.35) so the arrow doesn't jitter. |
| Speech (SRS-CMP-1) | Copy deck: "{name}, {meters} meters, {direction}." / "{name}, {km} kilometers, {direction}." at 1 km or more / "{name}, {meters} meters." without a heading / "{name} is straight ahead." Metres rounded: under 20 m to 1 m, under 100 m to 5 m, else to 10 m. |
| Directions | Relative bearing: ≤ 15° straight ahead; ≤ 45° slightly left or right; ≤ 135° to your left or right; else behind you. |
| Repeat (SRS-CMP-2) | Speak again when the relative angle moved 30° or more since the last sentence, the distance halved, 60 s passed, or a heading appeared. |
| Facing (SRS-CMP-3) | Entering ±15°: `navigator.vibrate(30)`; where that doesn't exist (iOS Safari), a 120 ms 880 Hz tone. Once per entry. |
| Offline (SRS-CMP-7) | The target is a saved `LatLon`; the module makes no network request. Motion denied still gives distance and speech. |
| Screen locked | iOS pauses Web Speech when the screen locks; speech resumes on unlock. This is the "where iOS allows audio" limit. |
| Privacy | Positions stay in memory on the phone; nothing is logged or sent. |

Accuracy (SRS-CMP-4) depends on the phone's GPS and magnetometer; `accuracy_m` is exposed so the UI can say so. Field proof is the device checklist's compass step (`/check/compass.html`).

Tests: `scripts/test/map-compass.test.ts` (11 tests, fake platform): permission order, speech text, the four repeat triggers, tone vs vibration, denied motion, stop.
