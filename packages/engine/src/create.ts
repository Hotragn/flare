// Creation rows F1 and P1 (docs/architecture/04-state-machines.md). ICD-1 has no "create"
// event, so these are extra pure helpers: the backend validates with them and stores the
// returned gathering, then executes the effects after commit.
import type { Effect, Gathering, Id, Iso, Label, PlanStep } from "@flare/shared/icd/engine";
import { STEPS } from "./solve.ts";
import { HOUR, iso, KINDLING_MS, MINUTE, ms } from "./time.ts";

/** Most members in a group (BR-S-4). */
export const MAX_GROUP = 12;
/** Storage-level expiry after t0 for a Flare (BR-D-2). */
export const FLARE_EXPIRY_MS = 5 * HOUR;
/** Storage-level expiry after S for a Plan (BR-D-2). */
export const PLAN_EXPIRY_MS = 24 * HOUR;

export type CreateError = "quorum_range" | "group_full" | "plan_times" | "bad_request";

export type Created =
  | { ok: true; gathering: Gathering; effects: Effect[]; expires_at: Iso }
  | { ok: false; error: CreateError };

type Common = { id: Id; group_id: Id; host: Id; group_size: number; quorum: number };

export type FlareInput = Common & { ember_candidates: Label[] };
export type PlanInput = Common & { start_at: Iso; deadline_at: Iso; steps: PlanStep[] };

const LABEL_RE = /^(spot|c([1-9]|1[0-2])|step:[1-4])$/;

function base(input: Common, kind: Gathering["kind"], now: Iso): Gathering {
  return {
    id: input.id,
    group_id: input.group_id,
    kind,
    state: "kindling",
    host: input.host,
    group_size: input.group_size,
    quorum: input.quorum,
    version: 1,
    created_at: now,
    state_since: now,
    lit_at: null,
    done_at: null,
    ended: null,
    ember_candidates: [],
    ember_choice: null,
    plan: null,
    chosen_set: [],
    text_yes: 0,
    headcount: null,
  };
}

function groupOk(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= MAX_GROUP;
}

/** F1: quorum 2 to 4 (BR-Q-2), group ≤ 12 (BR-S-4); job `ember` at t0 + 30:00; expiry t0 + 5 h. */
export function createFlare(input: FlareInput, now: Iso): Created {
  if (!Number.isInteger(input.quorum) || input.quorum < 2 || input.quorum > 4)
    return { ok: false, error: "quorum_range" };
  if (!groupOk(input.group_size)) return { ok: false, error: "group_full" };
  const c = input.ember_candidates;
  if (c.length > 12 || new Set(c).size !== c.length || !c.every((l) => /^c([1-9]|1[0-2])$/.test(l)))
    return { ok: false, error: "bad_request" };
  const t0 = ms(now);
  const g = base(input, "flare", iso(t0));
  g.ember_candidates = [...c];
  return {
    ok: true,
    gathering: g,
    effects: [
      { type: "schedule", job: "ember", at: iso(t0 + KINDLING_MS) },
      { type: "counter", name: "flares_created" },
    ],
    expires_at: iso(t0 + FLARE_EXPIRY_MS),
  };
}

/** BR-P-1: D ≥ now + 10 min, D ≤ S − 10 min, S ≤ now + 36 h. */
export function planTimesOk(start_at: Iso, deadline_at: Iso, now: Iso): boolean {
  const n = ms(now);
  const s = ms(start_at);
  const d = ms(deadline_at);
  return d >= n + 10 * MINUTE && d <= s - 10 * MINUTE && s <= n + 36 * HOUR;
}

/** BR-P-4: exactly 4 steps numbered 1 to 4, minutes strictly decreasing, valid labels. */
export function ladderOk(steps: readonly PlanStep[]): boolean {
  if (steps.length !== 4) return false;
  const sorted = [...steps].sort((a, b) => a.step - b.step);
  for (let i = 0; i < 4; i++) {
    const s = sorted[i] as PlanStep;
    if (s.step !== STEPS[i]) return false;
    if (!Number.isInteger(s.minutes) || s.minutes < 1) return false;
    if (!LABEL_RE.test(s.place)) return false;
    if (i > 0 && s.minutes >= (sorted[i - 1] as PlanStep).minutes) return false;
  }
  return true;
}

/** P1: BR-P-1 times, BR-P-4 ladder, quorum 2 to 6 (BR-Q-2); job `plan_deadline` at D; expiry S + 24 h. */
export function createPlan(input: PlanInput, now: Iso): Created {
  if (!Number.isInteger(input.quorum) || input.quorum < 2 || input.quorum > 6)
    return { ok: false, error: "quorum_range" };
  if (!groupOk(input.group_size)) return { ok: false, error: "group_full" };
  if (!planTimesOk(input.start_at, input.deadline_at, now)) return { ok: false, error: "plan_times" };
  if (!ladderOk(input.steps)) return { ok: false, error: "bad_request" };
  const g = base(input, "plan", iso(ms(now)));
  const start = iso(ms(input.start_at));
  const deadline = iso(ms(input.deadline_at));
  g.plan = {
    start_at: start,
    deadline_at: deadline,
    steps: [...input.steps].sort((a, b) => a.step - b.step).map((s) => ({ ...s })),
    current_step: null,
  };
  return {
    ok: true,
    gathering: g,
    effects: [
      { type: "schedule", job: "plan_deadline", at: deadline },
      { type: "counter", name: "plans_created" },
    ],
    expires_at: iso(ms(start) + PLAN_EXPIRY_MS),
  };
}
