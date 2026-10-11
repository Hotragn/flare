// OD5 (P1): rest-loop request parser (SRS-REST-1, E16-S1). Plain words to loop constraints,
// read back for confirmation. Phone only, no model; the words never leave the phone.
//   "Knee's bad, 40 minutes, want trees" -> 40 min, a bench every 200 m, under trees.
import { t } from "../ai/copy.ts";

export type RestGap = 100 | 200 | 400;
/** BR-A-1 needs profile, read from the phone. */
export type Needs = { avoidSteps: boolean; maxRestGap: RestGap | null; restroomNear: boolean };
export type Prefer = "trees" | "water" | "restrooms";
export type LoopRequest = { minutes: number; restGapM: RestGap; prefer: Prefer[]; avoidSteps: boolean };

export const DEFAULT_MINUTES = 30;
export const DEFAULT_GAP: RestGap = 200; // E16-S1 AC1: "rest gap from needs (or 200 m)"
const MIN_MINUTES = 10;
const MAX_MINUTES = 180;
const GAPS: RestGap[] = [100, 200, 400];

const WORD_NUM: Record<string, number> = {
  ten: 10,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
};

function minutesFrom(low: string): number | null {
  if (/\bhalf (an )?hour\b/.test(low)) return 30;
  if (/\b(an|one) hour\b/.test(low)) return 60;
  const h = low.match(/\b(\d(?:\.\d)?)\s*(?:h|hrs?|hours?)\b/);
  if (h?.[1]) return Math.round(Number(h[1]) * 60);
  const m = low.match(/\b(\d{1,3})\s*(?:mins?|minutes?)\b/);
  if (m?.[1]) return Number(m[1]);
  const w = low.match(/\b(ten|fifteen|twenty|thirty|forty|fifty|sixty)\s*min/);
  return w?.[1] ? (WORD_NUM[w[1]] ?? null) : null;
}

/** The largest allowed gap that is not longer than asked (never more walking than they said). */
const snapGap = (m: number): RestGap => GAPS.filter((g) => g <= m).at(-1) ?? 100;

/** Request text plus the phone's needs profile to loop constraints. */
export function parseRest(
  text: string,
  needs: Needs | null = null,
): { ok: true; request: LoopRequest } | { ok: false } {
  const low = text.trim().toLowerCase();
  if (!low) return { ok: false };
  const gapWords = low.match(/\b(?:bench|rest|sit|stop)s?\s+every\s+(\d{2,3})\s*m(?:eters?|etres?)?\b/);
  const minutes = minutesFrom(gapWords ? low.replace(gapWords[0], " ") : low);
  const tired =
    /\b(knees?|knee's|hips?|back's|sore|tired|achy|bad leg|cane|walker|can'?t walk far|rest (a lot|often)|slow)\b/.test(
      low,
    );
  const prefer: Prefer[] = [];
  if (/\b(trees?|shade|shady|woods?|green)\b/.test(low)) prefer.push("trees");
  if (/\b(water|pond|lake|river|creek)\b/.test(low)) prefer.push("water");
  if (needs?.restroomNear || /\b(restrooms?|bathrooms?|toilets?|loo)\b/.test(low)) prefer.push("restrooms");
  const noSteps = /\b(no|avoid|without)\s+(steps|stairs)\b|\b(wheelchair|stroller|pram|walker)\b/.test(low);
  if (minutes === null && !gapWords && !tired && !prefer.length && !noSteps) return { ok: false };
  const restGapM: RestGap = gapWords?.[1] ? snapGap(Number(gapWords[1])) : (needs?.maxRestGap ?? DEFAULT_GAP);
  return {
    ok: true,
    request: {
      minutes: Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, minutes ?? DEFAULT_MINUTES)),
      restGapM,
      prefer,
      avoidSteps: noSteps || needs?.avoidSteps === true,
    },
  };
}

const words = (s: string) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

/**
 * "Got it: 40 min, a bench every 200 m, under trees. Right?" (loop.readback), at most 12 words.
 * When every preference doesn't fit, the line keeps time, gap and steps; the chips list all.
 */
export function restReadBack(r: LoopRequest): { line: string; chips: string[] } {
  const core = [t("loop.frag.min", { min: r.minutes }), t("loop.frag.gap", { m: r.restGapM })];
  const prefs = r.prefer.map((p) => t(`loop.frag.${p}`));
  const steps = r.avoidSteps ? [t("loop.frag.noSteps")] : [];
  const make = (parts: string[]) => t("loop.readback", { summary: `${parts.join(", ")}.` });
  const full = make([...core, ...prefs, ...steps]);
  return { line: words(full) <= 12 ? full : make([...core, ...steps]), chips: [...core, ...prefs, ...steps] };
}
