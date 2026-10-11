// Fix the map: photo to OSM tag draft (FR-MAP-2, SRS-MAP-1, BR-AI-4, E17-S1).
// Output is a draft only. A person reviews every tag (FR-MAP-3) and nothing is sent to
// OpenStreetMap from the app (FR-MAP-4). Location comes from the phone, never the model.
import { z } from "zod";
import { extractJson, type PromptSpec } from "./guard.ts";

export const OSM_PROMPT_VERSION = 1;

const YES_NO = ["yes", "no"] as const;

/** The allow-list (E17-S1 AC1) with the values each key may take. */
export const OSM_ALLOW = {
  amenity: ["bench", "drinking_water", "toilets", "shelter", "waste_basket", "bicycle_parking", "fountain"],
  backrest: YES_NO,
  material: ["wood", "metal", "stone", "concrete", "plastic", "brick"],
  seats: "int",
  wheelchair: ["yes", "no", "limited"],
  fee: YES_NO,
  access: ["yes", "no", "private", "permissive", "customers"],
  opening_hours: "hours",
  drinking_water: YES_NO,
  step_count: "int",
  handrail: YES_NO,
  covered: YES_NO,
  lit: YES_NO,
} as const;
export type OsmKey = keyof typeof OSM_ALLOW;
export const OSM_KEYS = Object.keys(OSM_ALLOW) as OsmKey[];

/** "24/7", "Mo-Fr 08:00-20:00", "Mo-Su 06:00-22:00; Sa off" style, kept simple on purpose. */
const HOURS =
  /^(24\/7|((Mo|Tu|We|Th|Fr|Sa|Su)(-(Mo|Tu|We|Th|Fr|Sa|Su))?(,(Mo|Tu|We|Th|Fr|Sa|Su))*\s+(\d\d:\d\d-\d\d:\d\d|off)(;\s*)?)+)$/;

export const OSM_SYSTEM = [
  "You draft OpenStreetMap tags for one street feature in a photo, for a person to review.",
  "Reply with one JSON object only. No code fences, no other text.",
  '{"tags": {"amenity": "bench", "backrest": "yes", "material": "wood"}}',
  `Use only these keys: ${OSM_KEYS.join(", ")}.`,
  "Allowed values: amenity = bench, drinking_water, toilets, shelter, waste_basket, bicycle_parking or fountain. backrest, fee, drinking_water, handrail, covered, lit = yes or no. material = wood, metal, stone, concrete, plastic or brick. wheelchair = yes, no or limited. seats and step_count = whole numbers.",
  'Tag only what is clearly visible. Leave a key out when unsure. If no allowed feature is visible, reply {"tags": {}}.',
  "Never add names, addresses, people, faces or opening hours you cannot read on a sign.",
].join("\n");

export const OSM_USER = "Here is the photo. Reply with the JSON.";

export const OSM_PROMPT: PromptSpec & { user: string } = {
  id: "osm-tags",
  version: OSM_PROMPT_VERSION,
  system: OSM_SYSTEM,
  user: OSM_USER,
  budgetMs: 8000,
  numPredict: 96,
};

export const OsmTags = z
  .record(z.string(), z.string())
  .refine((t) => Object.entries(t).every(([k, v]) => validTag(k, v)), "tag outside the allow-list");

export function validTag(key: string, value: string): boolean {
  if (!Object.hasOwn(OSM_ALLOW, key)) return false;
  const rule = OSM_ALLOW[key as OsmKey];
  if (rule === "int") return /^[1-9]\d{0,2}$/.test(value);
  if (rule === "hours") return HOURS.test(value);
  return (rule as readonly string[]).includes(value);
}

export type OsmDraft = { tags: Record<string, string>; dropped: string[] };

/**
 * Guard a tag answer (BR-AI-4). Keeps only allow-listed keys with allowed values, lower-cases
 * enum values, and records every dropped key so the eval can count them. Returns null when the
 * answer is not JSON; an empty tags object is a valid "nothing to tag" answer.
 */
export function enforceOsmTags(text: string): OsmDraft | null {
  const raw = extractJson(text) as { tags?: unknown } | null;
  const tags = raw && typeof raw === "object" && "tags" in raw ? raw.tags : raw;
  if (!tags || typeof tags !== "object" || Array.isArray(tags)) return null;
  const out: Record<string, string> = {};
  const dropped: string[] = [];
  for (const [k0, v0] of Object.entries(tags as Record<string, unknown>)) {
    const k = k0.trim().toLowerCase();
    const v = typeof v0 === "number" ? String(v0) : typeof v0 === "boolean" ? (v0 ? "yes" : "no") : String(v0 ?? "");
    const rule = Object.hasOwn(OSM_ALLOW, k) ? OSM_ALLOW[k as OsmKey] : null;
    const val = rule === "hours" ? v.trim() : v.trim().toLowerCase();
    if (validTag(k, val)) out[k] = val;
    else dropped.push(k);
  }
  return { tags: out, dropped };
}
