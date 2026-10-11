// @flare/engine: the pure core engine (ICD-1, packages/shared/src/icd/engine.ts).
// Usage and the effect contract: docs/engine/02-api.md.
import type { Engine } from "@flare/shared/icd/engine";
import { solve } from "./solve.ts";
import { transition } from "./transition.ts";
import { view } from "./view.ts";

export const engine: Engine = { solve, transition, view };

export type { Created, CreateError, FlareInput, PlanInput } from "./create.ts";
export { createFlare, createPlan, ladderOk, MAX_GROUP, planTimesOk } from "./create.ts";
export type { HotSpot, SparkError } from "./sparks.ts";
export { mergeHotSpots, recordLit, sparkAllowed } from "./sparks.ts";
export { pickEmber, yesCount } from "./transition.ts";
export { nextChangeAt } from "./view.ts";
