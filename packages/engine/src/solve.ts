// The solver (BR-S-1 to BR-S-6, BR-C-3 to BR-C-8, BR-Q-1 to BR-Q-6, ADR-0016 min_step).
// Spec and invariants: docs/engine/01-algorithm.md.
import type { Answer, Gathering, Id, Iso, Label, PlanStep, Rule, Solution, Step } from "@flare/shared/icd/engine";
import { FLARE_DURATION_MS, ms } from "./time.ts";

export const STEPS: readonly Step[] = [1, 2, 3, 4];

/** Where and when the gathering would happen, for evaluating one candidate set. */
export type Ctx = {
  kind: Gathering["kind"];
  /** Start time in epoch ms: Lit time for a Flare (BR-C-5), S for a Plan. */
  startMs: number;
  /** How long it lasts, for back_by (BR-C-6). */
  durationMs: number;
  /** Plan step, or null for a Flare. */
  step: Step | null;
  /** Place label whose phone check applies (BR-C-7, BR-E-3). */
  label: Label;
};

/** One rule that does not depend on the set (everything except `with`). */
export function ruleHolds(rule: Rule, ctx: Ctx): boolean {
  switch (rule.type) {
    case "with":
      return true; // set-dependent; handled by the fixed point (BR-S-3)
    case "after":
      return ctx.startMs >= ms(rule.at); // BR-C-5
    case "back_by":
      return ctx.startMs + ctx.durationMs <= ms(rule.at); // BR-C-6
    case "max_walk":
      return true; // folded into checks on the phone (BR-C-7); see checkPasses
    case "max_step":
      return ctx.step === null || ctx.step >= rule.step; // BR-C-8; Plans only
    case "min_step":
      return ctx.step === null || ctx.step <= rule.step; // ADR-0016; Plans only
  }
}

/** The phone's pass/fail for this place. A missing result counts as pass (BR-E-4, BR-S-2). */
export function checkPasses(a: Answer, label: Label): boolean {
  return a.checks[label] !== false;
}

/** Every rule of this answer except `with` holds, and the place check passes. */
export function fitsAlone(a: Answer, ctx: Ctx): boolean {
  return checkPasses(a, ctx.label) && a.rules.every((r) => ruleHolds(r, ctx));
}

/** All of this answer's `with` targets are in the set (BR-C-3). */
export function withHolds(a: Answer, set: ReadonlySet<Id>): boolean {
  return a.rules.every((r) => r.type !== "with" || set.has(r.member_id));
}

/** Every rule of this answer holds for this set and context (BR-C-2). */
export function allRulesHold(a: Answer, set: ReadonlySet<Id>, ctx: Ctx): boolean {
  return fitsAlone(a, ctx) && withHolds(a, set);
}

/**
 * Greatest set closed under `with` (BR-S-3): start from forced members plus every candidate
 * that fits alone, then repeatedly remove candidates whose `with` targets are missing.
 * Forced members are never removed. Returns ids sorted ascending (BR-S-6).
 */
export function fixedPoint(forced: readonly Id[], candidates: readonly Answer[], ctx: Ctx): Id[] {
  const set = new Set<Id>(forced);
  let live = candidates.filter((a) => !set.has(a.member_id) && fitsAlone(a, ctx));
  for (const a of live) set.add(a.member_id);
  let changed = true;
  while (changed) {
    changed = false;
    const keep: Answer[] = [];
    for (const a of live) {
      if (withHolds(a, set)) keep.push(a);
      else {
        set.delete(a.member_id);
        changed = true;
      }
    }
    live = keep;
  }
  return [...set].sort();
}

/** Yes answers that may join a set: not the host; Ember-only only when allowed (BR-Q-6). */
export function candidates(g: Gathering, answers: readonly Answer[], includeEmberOnly: boolean): Answer[] {
  return answers
    .filter((a) => a.member_id !== g.host && a.status === "yes" && (includeEmberOnly || !a.ember_only))
    .sort((x, y) => (x.member_id < y.member_id ? -1 : x.member_id > y.member_id ? 1 : 0));
}

export function planStep(g: Gathering, step: Step): PlanStep {
  const s = g.plan?.steps.find((p) => p.step === step);
  if (!s) throw new RangeError("engine: plan has no such step");
  return s;
}

/** Context for a Plan at step k. */
export function planCtx(g: Gathering, step: Step): Ctx {
  if (!g.plan) throw new RangeError("engine: not a plan");
  const s = planStep(g, step);
  return { kind: "plan", startMs: ms(g.plan.start_at), durationMs: s.minutes * 60_000, step, label: s.place };
}

/** Context for a Flare starting at startMs at this place. */
export function flareCtx(startMs: number, label: Label): Ctx {
  return { kind: "flare", startMs, durationMs: FLARE_DURATION_MS, step: null, label };
}

export type Candidate = { set: Id[]; step: Step | null; startMs: number };

/** Lexicographic ids comparison, for BR-S-6. */
function compareIds(a: readonly Id[], b: readonly Id[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const x = a[i] as Id;
    const y = b[i] as Id;
    if (x !== y) return x < y ? -1 : 1;
  }
  return a.length - b.length;
}

/**
 * BR-S-1 order: more people, then higher step (smaller number), then earlier start; ties by
 * lowest member ids (BR-S-6). Negative when a is better.
 */
export function compareCandidates(a: Candidate, b: Candidate): number {
  if (a.set.length !== b.set.length) return b.set.length - a.set.length;
  const sa = a.step ?? 0;
  const sb = b.step ?? 0;
  if (sa !== sb) return sa - sb;
  if (a.startMs !== b.startMs) return a.startMs - b.startMs;
  return compareIds(a.set, b.set);
}

/** Best set over the given contexts. */
export function best(forced: readonly Id[], cands: readonly Answer[], ctxs: readonly Ctx[]): Candidate {
  let top: Candidate | null = null;
  for (const ctx of ctxs) {
    const c: Candidate = { set: fixedPoint(forced, cands, ctx), step: ctx.step, startMs: ctx.startMs };
    if (top === null || compareCandidates(c, top) < 0) top = c;
  }
  if (top === null) throw new RangeError("engine: no context to solve");
  return top;
}

/** The place label a Flare is judged at: the Ember spot once chosen, else the original spot. */
export function flareLabel(g: Gathering): Label {
  return g.ember_choice ?? "spot"; // set only in Ember, and kept at Lit
}

/** Total yes-count toward quorum for a set: members plus anonymous text yeses (BR-ID-6). */
export function size(set: readonly Id[], g: Gathering): number {
  return set.length + g.text_yes;
}

export function need(quorum: number, n: number): number {
  return Math.max(0, quorum - n); // BR-Q-4
}

/**
 * ICD-1 solve(). Before Lit: the best set now. At Lit or Gone the set is fixed (BR-F-7),
 * so the chosen set is returned as is.
 */
export function solve(g: Gathering, answers: Answer[], now: Iso): Solution {
  if (g.state === "lit" || g.state === "gone") {
    const set = [...g.chosen_set].sort();
    return {
      set,
      step: g.plan?.current_step ?? null,
      need: 0,
      lights: g.state === "lit" || g.lit_at !== null,
    };
  }
  const nowMs = ms(now);
  const forced = [g.host];
  let top: Candidate;
  if (g.kind === "plan") {
    top = best(
      forced,
      candidates(g, answers, false),
      STEPS.map((k) => planCtx(g, k)),
    );
  } else {
    const emberOnly = g.state === "ember"; // BR-Q-6
    top = best(forced, candidates(g, answers, emberOnly), [flareCtx(nowMs, flareLabel(g))]);
  }
  const n = size(top.set, g);
  return { set: top.set, step: top.step, need: need(g.quorum, n), lights: n >= g.quorum };
}
