// Rules-tier condition parser (OD1, ICD-7). Phone only, no model, no network.
// Ported from lab spike 07 (rules.mjs: core_40 40/40, hard_20 15/20, under 1 ms) and extended with
// the report's two general rules (negated "far" and "home ... at T") and min_step (CR-A1, ADR-0016).
// Fixture conventions (docs/requirements/fixtures/conditions-60.json): bare hours 1 to 7 are PM,
// 8 to 11 are AM, 12 is noon; "close by" and "not far" are max_walk 10; OR is unsupported.

export type RawRule =
  | { type: "with"; value: string } // canonical member name as the group knows it
  | { type: "after" | "back_by"; value: string } // "HH:MM", 24 h, group time zone
  | { type: "max_walk"; value: number }
  | { type: "max_step" | "min_step"; value: 1 | 2 | 3 | 4 };

export type RawResult =
  | { ok: true; rules: RawRule[] }
  | { ok: false; reason: "didnt_catch" | "too_many" }
  | { ok: false; reason: "not_in_group"; name: string };

export type StepName = { step: 1 | 2 | 3 | 4; name: string };

const PLAIN_YES = /^(ok(ay)?|yes|yep|yeah|sure|in|i'?m in|count me in|down|let'?s go)[.!]*$/i;
const WORD_NUM: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

/** One spoken time to "HH:MM" (24 h), or null if it isn't a real time. */
export function parseTime(raw: string): string | null {
  const s = raw.trim().toLowerCase().replace(/\./g, "");
  if (s === "noon" || s === "midday") return "12:00";
  const half = s.match(/^half (\w+)$/);
  if (half?.[1]) {
    const n = WORD_NUM[half[1]] ?? Number(half[1]);
    return Number.isInteger(n) ? parseTime(`${n}:30`) : null;
  }
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm|o'?clock)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  const ap = m[3];
  if (h > 23 || min > 59) return null;
  if (ap === "pm" && h < 12) h += 12;
  else if (ap === "am" && h === 12) h = 0;
  else if ((!ap || ap.includes("clock")) && h >= 1 && h <= 7) h += 12;
  if (h > 23) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

const TIME = String.raw`(noon|midday|half \w+|\d{1,2}(?::\d{2})?\s*(?:am|pm|o'?clock)?)`;
const AFTER = [
  new RegExp(String.raw`\b(?:after|not before|earliest|from)\s+${TIME}`, "gi"),
  new RegExp(String.raw`\bafter my\s+${TIME}`, "gi"),
];
const BACK_BY = [
  new RegExp(String.raw`\b(?:back by|home by|leave by|be back by|no later than|done by|out by)\s+${TIME}`, "gi"),
  // General rule 2 (lab 07): "home for dinner at 6", "be home at 6".
  new RegExp(String.raw`\bhome (?:for \w+ )?at\s+${TIME}`, "gi"),
];
// OR joins alternatives, which the engine can't hold (BR-C-2 is AND only). These "or" phrases
// are not alternatives: "step 2 or less", "the full walk or nothing".
const OR_ALTERNATIVE = /\bor\b(?!\s+(less|smaller|shorter|fewer|under|below|more|bigger|longer|nothing|bust)\b)/i;
const NOT_NAMES = new Set([
  "i",
  "it",
  "its",
  "the",
  "we",
  "you",
  "they",
  "my",
  "me",
  "possible",
  "needed",
  "so",
  "that",
  "there",
  "not",
]);
const NAME_RE =
  /\b(?:[Ww]ith|[Ii]f|[Oo]nly if|[Oo]nly with)\s+([A-Z][a-z]+|[a-z]+)(?:'s)?(?:\s+and\s+([A-Z][a-z]+|[a-z]+))?/g;

// Step words that need no Plan context (fixture core_40 and hard_20).
const SMALLEST = /\b(porch|smallest|tiniest|only the small one|the small one)\b/;
const SHORT = /\b(short one|quick (one|version)|shortest)\b/;
const LONGEST = /\b(long one|longest|full walk|full loop|whole (walk|loop|thing)|biggest|big one)\b/;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function stepRules(low: string, steps: StepName[]): RawRule[] {
  const out: RawRule[] = [];
  const num = (s: string) => Number(s) as 1 | 2 | 3 | 4;
  // Numbered steps.
  let m = low.match(/\bstep\s+([1-4])\s+or\s+(?:less|smaller|shorter)\b/) ?? low.match(/\bat most step\s+([1-4])\b/);
  if (m?.[1]) out.push({ type: "max_step", value: num(m[1]) });
  m = low.match(/\bstep\s+([1-4])\s+or\s+(?:more|bigger|longer)\b/) ?? low.match(/\bat least step\s+([1-4])\b/);
  if (m?.[1]) out.push({ type: "min_step", value: num(m[1]) });
  if (out.length) return out;
  // Named steps from this Plan's ladder ("at least the park loop").
  for (const s of steps) {
    const n = escapeRe(s.name.trim().toLowerCase());
    if (!n || !new RegExp(String.raw`\b${n}\b`).test(low)) continue;
    if (new RegExp(String.raw`\bat least (?:the )?${n}\b|\b${n}\s+or\s+(?:more|bigger|longer|nothing)\b`).test(low))
      return [{ type: "min_step", value: s.step }];
    if (new RegExp(String.raw`\bat most (?:the )?${n}\b|\b${n}\s+or\s+(?:less|smaller|shorter)\b`).test(low))
      return [{ type: "max_step", value: s.step }];
    if (new RegExp(String.raw`\b(?:only|just) (?:the )?${n}\b`).test(low))
      return [s.step === 1 ? { type: "min_step", value: 1 } : { type: "max_step", value: s.step }];
  }
  if (LONGEST.test(low)) return [{ type: "min_step", value: 1 }];
  if (SMALLEST.test(low)) return [{ type: "max_step", value: 4 }];
  if (SHORT.test(low)) return [{ type: "max_step", value: 3 }];
  return out;
}

/**
 * Text to raw rules. `members` are display names already decrypted on this phone (BR-C-3).
 * Returns [] for a plain yes, didnt_catch for anything it can't read (SRS-COND-8).
 */
export function parseRaw(text: string, members: string[], steps: StepName[] = []): RawResult {
  const t = text.trim();
  if (!t) return { ok: false, reason: "didnt_catch" };
  if (PLAIN_YES.test(t)) return { ok: true, rules: [] };
  if (OR_ALTERNATIVE.test(t)) return { ok: false, reason: "didnt_catch" };
  const out: RawRule[] = [];
  const low = t.toLowerCase();
  const add = (r: RawRule) => {
    if (!out.some((x) => x.type === r.type && x.value === r.value)) out.push(r);
  };

  // with(X): names after with / if / only if, joined by "and".
  const byLower = new Map(members.map((n) => [n.toLowerCase(), n]));
  for (const m of t.matchAll(NAME_RE)) {
    for (const cand of [m[1], m[2]]) {
      if (!cand) continue;
      const k = cand.toLowerCase();
      const name = byLower.get(k);
      if (name) add({ type: "with", value: name });
      else if (/^[A-Z]/.test(cand) && !NOT_NAMES.has(k)) return { ok: false, reason: "not_in_group", name: cand };
    }
  }

  for (const re of AFTER)
    for (const m of t.matchAll(re)) {
      const v = parseTime(m[1] ?? "");
      if (!v) return { ok: false, reason: "didnt_catch" };
      add({ type: "after", value: v });
    }
  for (const re of BACK_BY)
    for (const m of t.matchAll(re)) {
      const v = parseTime(m[1] ?? "");
      if (!v) return { ok: false, reason: "didnt_catch" };
      add({ type: "back_by", value: v });
    }

  // max_walk(M)
  const walk =
    low.match(/\b(?:max(?:imum)?|no more than|at most|under)\s+(\d{1,3})\s*(?:min(?:ute)?s?)\b/) ??
    low.match(/\b(\d{1,3})\s*(?:min(?:ute)?s?)\s+walk(?:ing)?\s+max\b/);
  // General rule 1 (lab 07): "far" with a negation, "not too far", "can't walk far".
  const notFar =
    /\b(?:not (?:too |that |very )?far|(?:can'?t|cannot|won'?t|don'?t want to) walk (?:too |that |very )?far)\b/.test(
      low,
    );
  if (walk?.[1]) add({ type: "max_walk", value: Number(walk[1]) });
  else if (notFar) {
    const n = low.match(/\b(\d{1,3})\s*min(?:ute)?s?\b/);
    add({ type: "max_walk", value: n?.[1] ? Number(n[1]) : 10 });
  } else if (/\b(close by|nearby|close)\b/.test(low)) add({ type: "max_walk", value: 10 });

  for (const r of stepRules(low, steps)) add(r);

  if (!out.length) return { ok: false, reason: "didnt_catch" };
  if (out.length > 4) return { ok: false, reason: "too_many" };
  return { ok: true, rules: out };
}
