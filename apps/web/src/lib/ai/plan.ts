// FE5 logic (moved to ODAI in the WBS): Plan times, the answer with step rules, and the
// sunset flag. Pure functions; the frontend renders the screens (P1 to P7).
import type { ConditionsIcd, Engine } from "@flare/shared/icd/index";
import { parse, parseError, readBackChips } from "../conditions/index.ts";
import { t } from "./copy.ts";
import { type LadderStep, stepNames } from "./ladder.ts";

const MIN = 60_000;

export type PlanTimesError = "tooSoon" | "tooClose" | "tooFar";

/** BR-P-1: D ≥ created + 10 min, D ≤ S − 10 min, S ≤ created + 36 h. Times are server ISO. */
export function checkPlanTimes(
  createdIso: string,
  startIso: string,
  deadlineIso: string,
): { ok: true } | { ok: false; error: PlanTimesError; message: string } {
  const c = Date.parse(createdIso);
  const s = Date.parse(startIso);
  const d = Date.parse(deadlineIso);
  const fail = (error: PlanTimesError) => ({ ok: false as const, error, message: t(`plan.err.${error}`) });
  if (s > c + 36 * 60 * MIN) return fail("tooFar");
  if (d < c + 10 * MIN) return fail("tooSoon");
  if (d > s - 10 * MIN) return fail("tooClose");
  return { ok: true };
}

/** BR-P-9: a step ends after sunset when start + its minutes is past sunset. Off when the host turned it off. */
export function endsAfterSunset(startIso: string, steps: LadderStep[], sunsetIso: string | null, checkOn = true) {
  const sunset = sunsetIso ? Date.parse(sunsetIso) : Number.NaN;
  return steps.map((st) => ({
    step: st.step,
    afterSunset: checkOn && Number.isFinite(sunset) && Date.parse(startIso) + st.minutes * MIN > sunset,
    note: t("ladder.afterSunset"),
  }));
}

export type PlanAnswerDraft =
  | { ok: true; rules: Engine.Rule[]; readBack: string; chips: string[] }
  | { ok: false; message: string };

/**
 * A Plan answer's conditions (E15-S2 AC1, SRS-PLAN-10): the parser gets the ladder's step names,
 * so "at least the half walk" works. Only the rules leave the phone, after the person says Yes.
 */
export function planAnswer(
  text: string,
  ctx: Omit<ConditionsIcd.ParseContext, "kind" | "steps">,
  steps: LadderStep[],
): PlanAnswerDraft {
  const full: ConditionsIcd.ParseContext = { ...ctx, kind: "plan", steps: stepNames(steps) };
  const r = parse(text, full);
  if (!r.ok) return { ok: false, message: parseError(r) };
  return { ok: true, rules: r.rules, readBack: r.readBack, chips: readBackChips(r.rules, full) };
}

/** Which steps a member's step rules allow (BR-C-8 max_step: chosen ≥ n; ADR-0016 min_step: chosen ≤ n). */
export function stepsAllowed(rules: Engine.Rule[]): Engine.Step[] {
  const all: Engine.Step[] = [1, 2, 3, 4];
  return all.filter((k) =>
    rules.every((r) => (r.type === "max_step" ? k >= r.step : r.type === "min_step" ? k <= r.step : true)),
  );
}
