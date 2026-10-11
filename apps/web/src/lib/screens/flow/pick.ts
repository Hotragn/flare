// Picks the object that implements an ICD interface out of a module's exports.
import type { DepName } from "./deps.ts";

/** Methods each ICD interface must have (packages/shared/src/icd). */
export const REQUIRED: Record<DepName, string[]> = {
  crypto: ["newGroupKey", "importFragment", "seal", "open", "sealJson", "openJson", "placeHash"],
  store: ["group", "saveGroup", "forget", "saveLit", "lit", "needs", "saveNeeds"],
  outbox: ["send", "flush", "size"],
  live: ["follow"],
  conditions: ["parse", "readBack"],
  caps: ["detect", "shaderOk"],
  maps: ["load", "nameSpot", "emberCandidates", "checkNeeds", "walkMinutes", "accessLine", "natureLine", "sunset"],
};

const fits = (v: unknown, methods: string[]): boolean =>
  typeof v === "object" && v !== null && methods.every((m) => typeof (v as Record<string, unknown>)[m] === "function");

/** Default export first, then named objects, then no-argument create* factories. */
export function pickImpl(mod: Record<string, unknown>, methods: string[]): unknown {
  if (fits(mod.default, methods)) return mod.default;
  for (const v of Object.values(mod)) if (fits(v, methods)) return v;
  for (const [k, v] of Object.entries(mod)) {
    if (!/^create[A-Z]/.test(k) || typeof v !== "function" || v.length !== 0) continue;
    try {
      const made = (v as () => unknown)();
      if (fits(made, methods)) return made;
    } catch {
      // A factory that needs arguments or a browser API we lack is not the one we want.
    }
  }
  return null;
}
