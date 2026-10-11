// Time helpers. The engine never reads the clock: every "now" is an argument (BR-TIME-1).
import type { Iso } from "@flare/shared/icd/engine";

export const SECOND = 1000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;

/** Kindling ends at t0 + 30:00 (BR-F-1). */
export const KINDLING_MS = 30 * MINUTE;
/** Ember ends at t0 + 60:00 (BR-F-4). */
export const EMBER_END_MS = 60 * MINUTE;
/** A Lit Flare ends at t0 + 4:00:00 at the latest (BR-F-5). */
export const LIT_CAP_MS = 4 * HOUR;
/** Missing Ember checks count as pass after 60 s (BR-E-4). */
export const EMBER_PICK_MS = 60 * SECOND;
/** Flare duration for back_by (BR-C-6). */
export const FLARE_DURATION_MS = 60 * MINUTE;
/** A Lit Plan ends at S + step minutes + 60 min (BR-P-8). */
export const PLAN_TAIL_MS = 60 * MINUTE;
/** The delete job runs 60 s after Gone (F14). */
export const DELETE_AFTER_MS = 60 * SECOND;

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;

/** Parse an ISO 8601 time to epoch ms. Throws on anything that is not a full UTC-offset time. */
export function ms(t: Iso): number {
  if (!ISO_RE.test(t)) throw new RangeError("engine: time is not ISO 8601 with an offset");
  const v = Date.parse(t);
  if (Number.isNaN(v)) throw new RangeError("engine: time is not a real date");
  return v;
}

/** Epoch ms to UTC ISO 8601 with milliseconds (ICD rule "Time"). */
export function iso(v: number): Iso {
  return new Date(v).toISOString();
}
