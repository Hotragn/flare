// Rest-loop request to constraints (FR-AI-10, SRS-REST-1, E16-S1).
// Requests never leave the phone (SRS-PRIV-1, architecture 07 table: hub "Never"), and no
// phone model ships (ADR-0007), so this job has no model prompt: it is a deterministic
// extractor with a strict schema. OD5 (on-device AI) wraps it with the read-back screen.
import { z } from "zod";
import { countWords } from "./guard.ts";

export const REST_EXTRACTOR_VERSION = 1;

export const PREFERENCES = ["trees", "water", "shade", "quiet", "flat", "restrooms"] as const;
export type Preference = (typeof PREFERENCES)[number];

/** Default rest gap when neither the request nor the needs profile sets one (E16-S1 AC1). */
export const DEFAULT_REST_GAP_M = 200;
/** Walking speed for the rest-loop builder (SRS-REST-3): 3 km/h = 50 m per minute. */
export const WALK_M_PER_MIN = 50;

export const RestRequest = z.object({
  /** Loop length in minutes, 10 to 240. null = not said; the form asks. */
  minutes: z.number().int().min(10).max(240).nullable(),
  /** Max metres between benches, 50 to 1000. null = from needs, else DEFAULT_REST_GAP_M. */
  rest_gap_m: z.number().int().min(50).max(1000).nullable(),
  prefer: z.array(z.enum(PREFERENCES)).max(PREFERENCES.length),
  /** true when the request says to avoid stairs; null = from needs. */
  avoid_steps: z.boolean().nullable(),
  /** The request mentions a mobility reason (knee, hip, cane...). Used only to word the read-back. */
  mobility_hint: z.boolean(),
});
export type RestRequestT = z.infer<typeof RestRequest>;

const NUM_WORDS: Record<string, number> = {
  two: 2,
  three: 3,
  four: 4,
  ten: 10,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  forty: 40,
  "forty-five": 45,
  fifty: 50,
  sixty: 60,
  ninety: 90,
};
const num = (s: string): number => NUM_WORDS[s.toLowerCase()] ?? Number(s);
const NUM = String.raw`(\d{1,4}(?:\.\d)?|two|three|four|ten|fifteen|twenty|thirty|forty-five|forty|fifty|sixty|ninety)`;

function minutesOf(t: string): number | null {
  if (/\b(an?|one) hour and a half\b|\b(1\.5|one and a half) hours?\b/.test(t)) return 90;
  if (/\bhalf (an )?hour\b/.test(t)) return 30;
  if (/\bquarter (of an )?hour\b/.test(t)) return 15;
  const m = t.match(new RegExp(String.raw`\b${NUM}\s*(?:-\s*)?(?:hours?|hrs?|h)\b`));
  if (m?.[1]) return Math.round(num(m[1]) * 60);
  if (/\b(an|one) hour\b/.test(t)) return 60;
  for (const x of t.matchAll(
    new RegExp(String.raw`\b${NUM}\s*(?:-\s*)?(?:minutes?|mins?)\b(?!\s*(?:apart|between))`, "g"),
  )) {
    const before = t.slice(Math.max(0, (x.index ?? 0) - 16), x.index ?? 0);
    if (x[1] && !/\b(every|each|within|at most|no more than|max(imum)?)\s*$/.test(before)) return Math.round(num(x[1]));
  }
  return null;
}

function restGapOf(t: string): number | null {
  const m = t.match(
    new RegExp(
      String.raw`\b(?:every|each|at most|no more than|max(?:imum)?|within)\s+${NUM}\s*(m|meters?|metres?|feet|ft|yards?|yds?|min(?:ute)?s?)\b`,
    ),
  );
  if (m?.[1] && m[2] && /\b(bench|benches|rest|sit|seat|break|stop)/.test(t)) {
    const n = num(m[1]);
    const unit = m[2];
    const metres = /^(f|ft)/.test(unit)
      ? n * 0.3048
      : /^y/.test(unit)
        ? n * 0.9144
        : /^min/.test(unit)
          ? n * WALK_M_PER_MIN
          : n;
    return Math.round(metres / 10) * 10;
  }
  if (/\b(sit|rest|bench(es)?|break)s?\b.*\b(often|a lot|lots|frequent(ly)?)\b|\blots of benches\b/.test(t)) return 100;
  return null;
}

const PREFER_RE: [Preference, RegExp][] = [
  ["trees", /\b(trees?|woods?|forest|leaves|green)\b/],
  ["water", /\b(water|pond|lake|river|creek|stream)\b/],
  ["shade", /\b(shade|shady|out of the sun)\b/],
  ["quiet", /\b(quiet|calm|peaceful|away from (traffic|cars|roads?))\b/],
  ["flat", /\b(flat|no hills?|level|not hilly|avoid hills?)\b/],
  ["restrooms", /\b(restrooms?|bathrooms?|toilets?|washrooms?|loo)\b/],
];

/**
 * Extract constraints from a plain request (SRS-REST-1). Returns null when nothing usable
 * was found, so the app shows the pickers (FR-AI-10 floor). Never throws.
 */
export function parseRestRequest(text: string): RestRequestT | null {
  const t = text.toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, " ").trim().slice(0, 200);
  if (!t) return null;
  const negPrefer = (re: RegExp) => {
    const m = t.match(re);
    if (!m) return false;
    const before = t.slice(Math.max(0, (m.index ?? 0) - 12), m.index ?? 0);
    return !/\b(no|not|without|avoid|hate)\s+(the\s+)?$/.test(before);
  };
  const prefer = PREFER_RE.filter(([k, re]) => (k === "flat" ? re.test(t) : negPrefer(re))).map(([k]) => k);
  const avoid = /\b(no|avoid|without|can'?t (do|climb|manage)|not|hate)\s+(any\s+)?(stairs|steps)\b/.test(t)
    ? true
    : /\b(wheelchair|walker|rollator|stroller|pram|scooter)\b/.test(t)
      ? true
      : /\bstairs (are )?(ok|fine)\b|\bsteps (are )?(ok|fine)\b/.test(t)
        ? false
        : null;
  const r: RestRequestT = {
    minutes: minutesOf(t),
    rest_gap_m: restGapOf(t),
    prefer,
    avoid_steps: avoid,
    mobility_hint:
      /\b(knees?|hips?|back|ankles?|legs?|cane|walker|rollator|wheelchair|tired|sore|bad foot|feet hurt)\b/.test(t),
  };
  if (r.minutes !== null && (r.minutes < 10 || r.minutes > 240)) r.minutes = null;
  if (r.rest_gap_m !== null && (r.rest_gap_m < 50 || r.rest_gap_m > 1000)) r.rest_gap_m = null;
  if (r.minutes === null && r.rest_gap_m === null && !r.prefer.length && r.avoid_steps === null) return null;
  const ok = RestRequest.safeParse(r);
  return ok.success ? ok.data : null;
}

/**
 * Read-back for confirmation, ≤ 12 words (same limit as SRS-COND-5).
 * Example: "40 min, bench every 200 m, trees, no steps."
 */
export function restReadBack(r: RestRequestT, needsGapM?: number | null): string {
  const parts: string[] = [];
  if (r.minutes !== null) parts.push(`${r.minutes} min`);
  parts.push(`bench every ${r.rest_gap_m ?? needsGapM ?? DEFAULT_REST_GAP_M} m`);
  if (r.prefer.length) parts.push(r.prefer.slice(0, 3).join(", "));
  if (r.avoid_steps) parts.push("no steps");
  let s = `${parts.join(", ")}.`;
  while (countWords(s) > 12 && parts.length > 2) {
    parts.splice(2, 1);
    s = `${parts.join(", ")}.`;
  }
  return s.charAt(0).toUpperCase() + s.slice(1);
}
