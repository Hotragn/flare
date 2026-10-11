// Talking compass for the Lit screen (FE4). Usage, inside the tap handler and before any await:
//   const c = createCompass({ target, name: host, env: browserEnv() });
//   unlockAudio(); void c.start();
// Spec: docs/maps/04-compass.md.
export { browserEnv, tone, unlockAudio } from "./browser.ts";
export {
  type Compass,
  type CompassEnv,
  type CompassState,
  createCompass,
  headingOf,
  type OrientationReading,
  smoothHeading,
} from "./compass.ts";
export { type Direction, direction, phrase, shouldSpeak, spokenMeters } from "./speech.ts";
