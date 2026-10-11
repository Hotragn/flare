// ICD-6 entry point: `maps` implements the frozen Maps interface. Extras the ICD doesn't
// list (loadNear, failedNeeds, weather, loops, card, Fix the map export) are exported too.
import type { Maps } from "@flare/shared/icd/map";
import { natureLine } from "./nature.ts";
import { accessLine, checkNeeds, emberCandidates, nameSpot, placeWords, walkMinutes } from "./places.ts";
import { load } from "./store.ts";
import { sunset } from "./sun.ts";

export const maps: Maps = {
  load: (area) => load(area),
  nameSpot,
  emberCandidates,
  checkNeeds,
  walkMinutes,
  accessLine,
  natureLine,
  sunset,
  placeWords,
};

export { CARD_COLORS, cardLines, cardPdf } from "./card.ts";
export { MAP_COPY } from "./copy.ts";
export * as fixmap from "./fixmap.ts";
export { bearingDeg, distanceM } from "./geo.ts";
export { buildLoop, type Loop, type LoopRequest, type LoopResult, speakTurns, type Turn } from "./loop.ts";
export { endsAfterSunset, natureLine, season } from "./nature.ts";
export { ATTRIBUTION, countByKind, isFresh, PackError, places, validatePack } from "./pack.ts";
export { type PathsPack, validatePaths } from "./paths.ts";
export { failedNeeds, isUsable, nearestSeatM, stepsNear } from "./places.ts";
export { cacheStore, type Loaded, load, loadNear, loadPathsNear, memoryStore, type PackStore } from "./store.ts";
export { sunset } from "./sun.ts";
export { type PlanWeather, planWeather } from "./weather.ts";
