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

const PLAIN_YES =
  /^(ok(ay)?|yes|yep|yeah|sure|sure thing|in|i'?m in|im in|count me in|down|i'?m down|let'?s go|sounds good|for sure|bet|absolutely|totally|yes please)[.!]*$/i;
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
  // "quarter past 5" 17:15, "half past 4" 16:30, "quarter to 5" 16:45 (bare-hour convention on the hour said).
  const qp = s.match(/^(quarter|half) (past|after|to) (\w+)$/);
  if (qp?.[1] && qp[3]) {
    const n = WORD_NUM[qp[3]] ?? Number(qp[3]);
    if (!Number.isInteger(n) || n < 1 || n > 12) return null;
    const base = parseTime(String(n));
    if (!base) return null;
    const mins =
      Number(base.slice(0, 2)) * 60 + (qp[2] === "to" ? (qp[1] === "half" ? -30 : -15) : qp[1] === "half" ? 30 : 15);
    return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
  }
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

const TIME = String.raw`(noon|midday|(?:quarter|half) (?:past|after|to) \w+|half \w+|\d{1,2}(?::\d{2})?\s*(?:am|pm|o'?clock)?)`;
const AFTER = [
  new RegExp(String.raw`\b(?:after|not before|earliest|from)\s+${TIME}`, "gi"),
  new RegExp(String.raw`\bafter my\s+${TIME}`, "gi"),
  // Family A1 (fine-tune, ml/tinker): busy until T means free after T. "stuck at work until 5", "can't do anything til 3".
  new RegExp(
    String.raw`\b(?:busy|stuck(?: at \w+)?|tied up|at work|working|i work|work|can'?t do anything|can'?t do it|not free)\s+(?:(?:till?|until|'til)\s+)${TIME}`,
    "gi",
  ),
  // A2: "2:45 at the earliest", "once it's past 1:30".
  new RegExp(String.raw`${TIME}\s+at the earliest\b`, "gi"),
  new RegExp(String.raw`\b(?:it'?s|its)\s+past\s+${TIME}`, "gi"),
  // A3: "once I'm done with lunch around 1", "when I'm off work at 5".
  new RegExp(
    String.raw`\b(?:once|when|after)\s+(?:i'?m|im|i am|i get)\s+(?:done|finished|off|out)\b[^,.;]{0,30}?\b(?:around|at|about)\s+${TIME}`,
    "gi",
  ),
];
const BACK_BY = [
  new RegExp(
    String.raw`\b(?:back by|home by|leave by|be back by|no later than|done by|out by|wrap(?:ped)? up by|finish(?:ed)? by|gone by|head (?:out|home|back) by)\s+${TIME}`,
    "gi",
  ),
  // General rule 2 (lab 07): "home for dinner at 6", "be home at 6".
  new RegExp(String.raw`\bhome (?:for \w+ )?at\s+${TIME}`, "gi"),
  // B1 (fine-tune): "curfew is 5:30", "5 at the latest", "free until 6", "can stay till 4".
  new RegExp(String.raw`\bcurfew(?:'s| is| at)?\s+${TIME}`, "gi"),
  new RegExp(String.raw`${TIME}\s+at the latest\b`, "gi"),
  new RegExp(String.raw`\b(?:free|stay|around|here|out|available)\s+(?:till?|until|'til)\s+${TIME}`, "gi"),
];
// B2 (fine-tune): an event at T the person must be back for. "got a thing at 3, need to be back for it",
// "my shift starts at 6 so i gotta be back before then". Needs a back/leave word and no "after".
const EVENT_AT = new RegExp(String.raw`\b(?:a|an|my|the)\s+(?:\w+\s+){0,2}?(?:starts?\s+|is\s+)?at\s+${TIME}`, "i");
const EVENT_BACK =
  /\b(?:be back|get back|back for|back before|before then|before that|have to leave|gotta leave|need to leave)\b/;
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
// Cues that are always followed by a person: an unknown capitalised name here is "not in group".
const NAME_RE =
  /\b(?:[Ww]ith|[Ii]f|[Oo]nly if|[Oo]nly with|[Aa]s long as|[Aa]ssuming|[Pp]rovided(?: that)?)\s+(?:both\s+)?([A-Z][a-z]+|[a-z]+)(?:'s)?(?:\s+and\s+([A-Z][a-z]+|[a-z]+))?/g;
// Family W1 (fine-tune): softer cues, matched only for names already in the group.
// "can't go without Shilp", "tell Ammo to come", "need Amor there", "Fuego has to come", "when Amor comes".
const softName = (n: string) =>
  new RegExp(
    String.raw`\b(?:without|tell|need|when)\s+${n}\b|\b${n}(?:'s)?\s+(?:has to|needs to|must|should|gotta)\s+(?:come|be there|join|show)`,
    "i",
  );

// Step words that need no Plan context (fixture core_40 and hard_20).
// S1 (fine-tune): sitting or saying hi is the smallest step ("sit somewhere close", "just wanna say hi").
const SMALLEST = /\b(porch|smallest|tiniest|only the small one|the small one|say (?:hi|hello)|sit(?:ting)?)\b/;
const SHORT = /\b(short one|quick (one|version|lap)|shortest|short (?:lap|version))\b/;
const LONGEST = /\b(long one|longest|full walk|full loop|whole (walk|loop|thing)|biggest|big one)\b/;

const MIN_WORD: Record<string, number> = { five: 5, ten: 10, fifteen: 15, twenty: 20, thirty: 30 };

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function stepRules(low: string, steps: StepName[]): RawRule[] {
  const out: RawRule[] = [];
  const num = (s: string) => Number(s) as 1 | 2 | 3 | 4;
  // Numbered steps.
  let m =
    low.match(/\bstep\s+([1-4])\s+or\s+(?:less|smaller|shorter)\b/) ??
    low.match(/\b(?:at most|(?:nothing|no) (?:bigger|longer|more) than) step\s+([1-4])\b/);
  if (m?.[1]) out.push({ type: "max_step", value: num(m[1]) });
  m =
    low.match(/\bstep\s+([1-4])\s+or\s+(?:more|bigger|longer)\b/) ??
    low.match(/\b(?:at least|(?:nothing|no) (?:smaller|shorter|less) than) step\s+([1-4])\b/);
  if (m?.[1]) out.push({ type: "min_step", value: num(m[1]) });
  if (out.length) return out;
  // Named steps from this Plan's ladder ("at least the park loop").
  for (const s of steps) {
    const n = escapeRe(s.name.trim().toLowerCase());
    if (!n || !new RegExp(String.raw`\b${n}\b`).test(low)) continue;
    if (
      new RegExp(
        String.raw`\b(?:at least|(?:nothing|no) (?:smaller|shorter|less) than) (?:the )?${n}\b|\b${n}\s+or\s+(?:more|bigger|longer|nothing)\b`,
      ).test(low)
    )
      return [{ type: "min_step", value: s.step }];
    // S2 (fine-tune): "nothing bigger than the park loop".
    if (
      new RegExp(
        String.raw`\b(?:at most|(?:nothing|no) (?:bigger|longer|more) than) (?:the )?${n}\b|\b${n}\s+or\s+(?:less|smaller|shorter)\b`,
      ).test(low)
    )
      return [{ type: "max_step", value: s.step }];
    // S3 (fine-tune): "a quick lap is all i've got in me".
    if (new RegExp(String.raw`\b(?:only|just) (?:the )?${n}\b|\b${n}\s+is all\b`).test(low))
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
  // M0 (fine-tune): spoken durations to minutes before anything else, so "half hour" never reads as a time.
  const t = text
    .trim()
    .replace(/\bhalf(?:\s+an|\s+a|-|\s+)\s*hour\b/gi, "30 min")
    .replace(/\b(?:an|one) hour\b/gi, "60 min")
    .replace(/\b(five|ten|fifteen|twenty|thirty)(?:\s+|-)min/gi, (_, w: string) => `${MIN_WORD[w.toLowerCase()]} min`);
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
  for (const name of members) if (softName(escapeRe(name)).test(t)) add({ type: "with", value: name });

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
  if (!out.some((r) => r.type === "back_by") && EVENT_BACK.test(low) && !/\bafter\b/.test(low)) {
    const m = t.match(EVENT_AT);
    const v = m?.[1] ? parseTime(m[1]) : null;
    if (v) add({ type: "back_by", value: v });
  }

  // max_walk(M)
  const walk =
    low.match(
      /\b(?:max(?:imum)?|no more than|nothing more than|not more than|at most|under)\s+(?:a\s+)?(\d{1,3})\s*(?:min(?:ute)?s?)\b/,
    ) ??
    // M1 (fine-tune): limit word after the minutes. "15 mins walking tops", "20 min walk at most",
    // "30 min walk max", "i can walk 25 minutes, no more".
    low.match(
      /\b(\d{1,3})\s*(?:min(?:ute)?s?)\s+(?:walk(?:ing)?|on foot)\s*,?\s*(?:max|tops|at most|or less|no more)\b/,
    ) ??
    low.match(/\bwalk\s+(\d{1,3})\s*(?:min(?:ute)?s?)\s*,?\s*(?:max|tops|at most|or less|no more)\b/);
  // General rule 1 (lab 07): "far" with a negation, "not too far", "can't walk far". M2: "nothing far".
  const notFar =
    /\b(?:not (?:too |that |very )?far|nothing (?:too |that )?far|(?:can'?t|cannot|won'?t|don'?t want to) walk (?:too |that |very )?far)\b/.test(
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
