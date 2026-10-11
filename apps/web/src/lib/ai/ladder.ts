// Plan ladder (SRS-PLAN-2, BR-P-4): hub tier through POST /api/v1/drafts/ladder, else the
// template ladder made on the phone (docs/architecture/07-offline-sync-and-ai.md B1):
// minutes = total x 1, 0.5, 0.25, 0.125 rounded to 5 (60 -> 60, 30, 15, 10), labels from the deck.
import { countWords, enforce } from "@flare/shared";
import { z } from "zod";
import { t } from "./copy.ts";
import { callHub, type FallbackWhy, PHONE_TIMEOUT_MS, type Tier, type TierDeps, tierLabel } from "./tier.ts";

export type LadderStep = { step: 1 | 2 | 3 | 4; label: string; minutes: number };
export type LadderRequest = { ask: string; total_minutes: number; weather?: { rain_likely: boolean; temp_f: number } };

export const MIN_TOTAL = 40;
export const MAX_TOTAL = 600;
export const MIN_STEP_MINUTES = 5;
export const MAX_LABEL_WORDS = 4;
export const MAX_ASK_CHARS = 80;
const FRACTIONS = [1, 0.5, 0.25, 0.125] as const;

const round5 = (n: number) => Math.round(n / 5) * 5;

/** Template ladder: always valid for totals 40 to 600. */
export function templateLadder(total: number): LadderStep[] {
  const steps: LadderStep[] = [];
  let prev = Number.POSITIVE_INFINITY;
  FRACTIONS.forEach((f, i) => {
    let m = Math.max(MIN_STEP_MINUTES, i === 0 ? total : round5(total * f));
    if (m >= prev) m = prev - MIN_STEP_MINUTES; // only reachable below 40; kept strictly decreasing
    prev = m;
    steps.push({ step: (i + 1) as LadderStep["step"], label: t(`ladder.tpl.${i + 1}`), minutes: m });
  });
  return steps;
}

/** The labels pass the same person filter as photo drafts (B2). */
const personFree = (label: string): boolean => enforce(JSON.stringify({ invite: label, alt: label })) !== null;

export type LadderError = "order" | "minutes" | "total" | "name";

/** BR-P-4 plus B2: exactly 4 steps, 1..4 in order, strictly decreasing, each ≥ 5, labels ≤ 4 words. */
export function checkLadder(steps: LadderStep[]): { ok: true } | { ok: false; error: LadderError; message: string } {
  const fail = (error: LadderError) => ({ ok: false as const, error, message: t(`ladder.err.${error}`) });
  if (steps.length !== 4 || steps.some((s, i) => s.step !== i + 1)) return fail("order");
  const first = steps[0]?.minutes ?? 0;
  if (!Number.isInteger(first) || first < MIN_TOTAL || first > MAX_TOTAL) return fail("total");
  for (const [i, s] of steps.entries()) {
    if (!Number.isInteger(s.minutes) || s.minutes < MIN_STEP_MINUTES) return fail("minutes");
    if (i > 0 && s.minutes >= (steps[i - 1]?.minutes ?? 0)) return fail("order");
    const w = countWords(s.label);
    if (w < 1 || w > MAX_LABEL_WORDS || s.label.length > 40 || !personFree(s.label)) return fail("name");
  }
  return { ok: true };
}

/** Edit one step (P2). Returns the new ladder, or the first rule it breaks. */
export function editStep(
  steps: LadderStep[],
  k: LadderStep["step"],
  change: { label?: string; minutes?: number },
): { ok: true; steps: LadderStep[] } | { ok: false; error: LadderError; message: string } {
  const next = steps.map((s) =>
    s.step === k
      ? {
          ...s,
          label: change.label === undefined ? s.label : change.label.replace(/\s+/g, " ").trim(),
          minutes: change.minutes ?? s.minutes,
        }
      : s,
  );
  const c = checkLadder(next);
  return c.ok ? { ok: true, steps: next } : c;
}

/** The parser's Plan context: step names for "at least the park loop" (ICD-7 ParseContext.steps). */
export const stepNames = (steps: LadderStep[]) => steps.map((s) => ({ step: s.step, name: s.label }));

const LadderResponse = z.object({
  steps: z.array(z.object({ step: z.number().int(), label: z.string(), minutes: z.number().int() })).length(4),
  tier: z.enum(["hub", "rules"]),
  ms: z.number().int().nonnegative(),
});

export type LadderOutcome = {
  tier: Tier;
  steps: LadderStep[];
  ms: number;
  label: string; // "Made on our laptop" / "Made from a template"
  note: string; // ladder.madeHub / ladder.madeRules / plan.offline
  why?: FallbackWhy;
};

/** Ask line to four steps. Never throws: the template is the floor. */
export async function draftLadder(req: LadderRequest, deps: TierDeps): Promise<LadderOutcome> {
  const ask = req.ask.trim().slice(0, MAX_ASK_CHARS);
  const total = Math.min(MAX_TOTAL, Math.max(MIN_TOTAL, Math.round(req.total_minutes)));
  const body = JSON.stringify({ ask, total_minutes: total, ...(req.weather ? { weather: req.weather } : {}) });
  const r = ask
    ? await callHub(
        "/api/v1/drafts/ladder",
        { body, contentType: "application/json" },
        (json) => {
          const d = LadderResponse.safeParse(json);
          if (!d.success) return null;
          const steps = d.data.steps as LadderStep[];
          if (d.data.tier === "hub" && !checkLadder(steps).ok) return null;
          return { tier: d.data.tier, value: steps };
        },
        deps,
        deps.timeoutMs ?? PHONE_TIMEOUT_MS.ladder,
      )
    : ({ ok: false, why: "unusable", ms: 0 } as const);
  const at = new Date(Date.now()).toISOString();
  if (r.ok) {
    deps.store?.record({ feature: "ladder", tier: "hub", at, ms: r.ms });
    return { tier: "hub", steps: r.value, ms: r.ms, label: tierLabel("hub"), note: t("ladder.madeHub") };
  }
  deps.store?.record({ feature: "ladder", tier: "rules", at, ms: r.ms, why: r.why });
  return {
    tier: "rules",
    steps: templateLadder(total),
    ms: r.ms,
    label: tierLabel("rules"),
    note: t(r.why === "offline" ? "plan.offline" : "ladder.madeRules"),
    why: r.why,
  };
}
