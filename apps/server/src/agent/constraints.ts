// User constraints beat weather (ADR-0025). When the ask names an activity ("kite flying") or
// a condition ("if windy"), step 1 stays that activity. Weather may move steps 2 to 4 and add a
// short note to step 1, never replace it. Labels come from this fixed list or the ask itself,
// so the guard's invented-name check still holds.
import { cleanAsk, type LadderT } from "@flare/shared";

/** Activity words and the step-1 label they keep. Walks and sits are not on the list: weather may change those. */
const ACTIVITIES: [RegExp, string][] = [
  [/\bkites?\b/i, "Kite flying"],
  [/\bfrisbee\b/i, "Frisbee"],
  [/\b(bike|biking|cycling|cycle)\b/i, "Bike ride"],
  [/\b(hike|hiking)\b/i, "Hike"],
  [/\bpicnic\b/i, "Picnic"],
  [/\b(swim|swimming)\b/i, "Swim"],
  [/\b(run|running|jog|jogging)\b/i, "Run"],
  [/\b(fish|fishing)\b/i, "Fishing"],
  [/\b(skate|skating)\b/i, "Skating"],
  [/\b(sled|sledding)\b/i, "Sledding"],
  [/\bstargaz/i, "Stargazing"],
  [/\b(bbq|barbecue|grill)\b/i, "Barbecue"],
  [/\b(soccer|football|basketball|tennis|volleyball|baseball)\b/i, ""], // label: the word itself
];

const CONDITION =
  /\b(?:if|when|unless)\s+(?:it'?s\s+|it\s+is\s+)?(windy|sunny|dry|clear|warm|cold|calm|raining|rains|snowing|snows)\b|\brain or shine\b|\beven if it rains\b/i;

export type Asked = { label: string; stem: string; condition: string | null };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

/** The activity (and condition) the ask insists on, or null when it names none. */
export function askedActivity(ask: string): Asked | null {
  const a = cleanAsk(ask);
  for (const [re, label] of ACTIVITIES) {
    const m = a.match(re);
    if (!m) continue;
    const base = label || cap(m[0]);
    const c = a.match(CONDITION)?.[0]?.toLowerCase() ?? null;
    const withCond = c && words(base) + words(c) <= 4 ? `${base} ${c}` : base;
    return { label: withCond, stem: m[0].toLowerCase().slice(0, 4), condition: c };
  }
  return null;
}

/**
 * Keep the asked activity on step 1. A step-1 label that already names it stays (even
 * "Kite flying, covered"); otherwise it becomes the asked label. When rain is likely and the
 * ask set no condition, a short "if dry" note is added if the label stays at 4 words or fewer.
 * Returns the ladder unchanged when the ask names no activity.
 */
export function keepAsked(ladder: LadderT, ask: string, rainLikely: boolean): { ladder: LadderT; changed: boolean } {
  const asked = askedActivity(ask);
  const first = ladder[0];
  if (!asked || !first) return { ladder, changed: false };
  let label = first.label.toLowerCase().includes(asked.stem) ? first.label : asked.label;
  if (rainLikely && !asked.condition && !/\b(rain|dry|covered|indoor|inside)\b/i.test(label) && words(label) <= 2)
    label = `${label} if dry`;
  if (label === first.label) return { ladder, changed: false };
  return { ladder: [{ ...first, label }, ...ladder.slice(1)] as LadderT, changed: true };
}
