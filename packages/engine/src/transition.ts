// ICD-1 transition(): the Flare machine (F1 to F14) and the Plan machine (P1 to P11) from
// docs/architecture/04-state-machines.md. Pure: inputs are never mutated, effects are data.
import type {
  Answer,
  Effect,
  Ended,
  EngineError,
  EngineEvent,
  Gathering,
  Id,
  Iso,
  JobKind,
  Label,
  Result,
  Step,
} from "@flare/shared/icd/engine";
import {
  allRulesHold,
  best,
  candidates,
  fixedPoint,
  flareLabel,
  planCtx,
  planStep,
  STEPS,
  size,
  solve,
} from "./solve.ts";
import {
  DELETE_AFTER_MS,
  EMBER_END_MS,
  EMBER_PICK_MS,
  iso,
  KINDLING_MS,
  LIT_CAP_MS,
  MINUTE,
  ms,
  PLAN_TAIL_MS,
} from "./time.ts";

/** Mutable working copy for one transition. */
type Draft = { g: Gathering; answers: Answer[]; effects: Effect[]; nowMs: number; changed: boolean };

/** Anonymous text yeses allowed per gathering (BR-ID-6). */
export const TEXT_YES_CAP = 3;
/** Headcount may exceed the yes-count by at most this many (BR-H-4). */
export const HEADCOUNT_SLACK = 3;
/** Ember quorum (BR-E-5). */
export const EMBER_QUORUM = 2;

function fail(error: EngineError): Result {
  return { ok: false, error };
}

function done(d: Draft): Result {
  if (d.changed) d.g.version += 1;
  return { ok: true, gathering: d.g, answers: d.answers, effects: tidy(d.effects) };
}

function find(d: Draft, id: Id): Answer | undefined {
  return d.answers.find((a) => a.member_id === id);
}

function blankAnswer(id: Id): Answer {
  return {
    member_id: id,
    status: "yes",
    ember_only: false,
    rules: [],
    checks: {},
    checks_at: null,
    faded: false,
    still_coming: false,
    arrived_at: null,
  };
}

/** The host is always a yes (BR-Q-1); its record is created when the host first reports something. */
function hostAnswer(d: Draft): Answer {
  const found = find(d, d.g.host);
  if (found) return found;
  const a = blankAnswer(d.g.host);
  d.answers.push(a);
  return a;
}

const t0 = (g: Gathering): number => ms(g.created_at);

/** When a Lit gathering ends by timer (BR-F-5, BR-P-8). */
export function litEndMs(g: Gathering): number {
  if (g.kind === "flare") return t0(g) + LIT_CAP_MS;
  const plan = g.plan;
  if (!plan || plan.current_step === null) throw new RangeError("engine: lit plan without a step");
  return ms(plan.start_at) + planStep(g, plan.current_step).minutes * MINUTE + PLAN_TAIL_MS;
}

function schedule(d: Draft, job: JobKind, atMs: number): void {
  d.effects.push({ type: "schedule", job, at: iso(atMs) });
}

function unschedule(d: Draft, job: JobKind): void {
  d.effects.push({ type: "unschedule", job });
}

/** Yes-count for the headcount cap: host, member yeses, text yeses (BR-H-4). */
export function yesCount(g: Gathering, answers: readonly Answer[]): number {
  return 1 + answers.filter((a) => a.member_id !== g.host && a.status === "yes").length + g.text_yes;
}

/** One `sse` and one Telegram edit per transition, sent last; a `lit`/`final` post supersedes `edit_count`. */
function tidy(effects: Effect[]): Effect[] {
  const tg = effects.filter((e): e is Extract<Effect, { type: "telegram" }> => e.type === "telegram");
  const strong = tg.filter((e) => e.action !== "edit_count");
  const keepTg: Effect[] = strong.length > 0 ? strong : tg.slice(0, 1);
  const out: Effect[] = effects.filter((e) => e.type !== "sse" && e.type !== "telegram");
  out.push(...keepTg);
  if (effects.some((e) => e.type === "sse")) out.push({ type: "sse" });
  return out;
}

// ---------- Lighting and ending ----------

function light(d: Draft, set: Id[], step: Step | null, emberSave: boolean): void {
  const g = d.g;
  const from = g.state;
  const now = iso(d.nowMs);
  g.state = "lit";
  g.state_since = now;
  g.lit_at = now;
  g.chosen_set = set;
  g.headcount = 1; // BR-H-1
  d.changed = true;
  if (g.kind === "flare") {
    if (from === "kindling") {
      unschedule(d, "ember");
      d.effects.push({ type: "counter", name: "flares_lit" });
    } else {
      unschedule(d, "ember_pick");
      d.effects.push({ type: "counter", name: "embers_lit" }); // BR-E-6
    }
    schedule(d, "gone", litEndMs(g));
    d.effects.push({ type: "push", event: "lit", to: "set", label: flareLabel(g) });
  } else {
    const plan = g.plan;
    if (!plan || step === null) throw new RangeError("engine: plan lit without a step");
    plan.current_step = step;
    unschedule(d, "plan_deadline");
    schedule(d, "gone", litEndMs(g));
    // Automations: a reminder 30 min before the start, when there is still time for one.
    const remindAt = ms(plan.start_at) - PLAN_REMINDER_MS;
    if (remindAt > d.nowMs) schedule(d, "plan_reminder", remindAt);
    d.effects.push({ type: "counter", name: "plans_lit_step", bucket: String(step) });
    if (emberSave) d.effects.push({ type: "counter", name: "plan_ember_saves" }); // BR-P-3
    d.effects.push({
      type: "push",
      event: emberSave ? "plan_ember" : "plan_on",
      to: "set",
      step,
      label: planStep(g, step).place,
    });
  }
  d.effects.push({ type: "telegram", action: "lit" });
  d.effects.push({ type: "sse" });
}

/** Automations: how long before a lit Plan starts its reminder goes out. */
export const PLAN_REMINDER_MS = 30 * MINUTE;
const now0 = (d: Draft) => iso(d.nowMs);

function end(d: Draft, ended: Ended, byTimer: JobKind | null): void {
  const g = d.g;
  const from = g.state;
  const pending: JobKind[] =
    from === "kindling"
      ? g.kind === "flare"
        ? ["ember"]
        : ["plan_deadline"]
      : from === "ember"
        ? g.ember_choice === null
          ? ["ember_pick", "gone"]
          : ["gone"]
        : g.kind === "plan" && ms(g.plan?.start_at ?? now0(d)) - PLAN_REMINDER_MS > d.nowMs
          ? ["gone", "plan_reminder"]
          : ["gone"];
  for (const job of pending) if (job !== byTimer) unschedule(d, job);
  const now = iso(d.nowMs);
  if (from === "lit" && g.kind === "flare" && g.lit_at !== null) {
    const hc = g.headcount ?? 1;
    d.effects.push({ type: "counter", name: "headcount_sum", bucket: String(hc) });
    d.effects.push({ type: "counter", name: "headcount_max", bucket: String(hc) });
    const minutes = Math.floor((d.nowMs - ms(g.lit_at)) / MINUTE);
    d.effects.push({ type: "counter", name: "lit_minutes_sum", bucket: String(minutes) });
  }
  g.state = "gone";
  g.state_since = now;
  g.done_at = now;
  g.ended = ended;
  d.changed = true;
  schedule(d, "delete", d.nowMs + DELETE_AFTER_MS); // F14
  d.effects.push({ type: "push", event: "gone", to: "all" });
  d.effects.push({ type: "telegram", action: "final" });
  d.effects.push({ type: "sse" });
}

// ---------- Ember (BR-E-1 to BR-E-6) ----------

/**
 * The Ember spot: the first candidate (nearest first) that every yes and Ember-only yes passed
 * (BR-E-1, BR-E-3), else `spot` (BR-E-2). Before the 60 s default (BR-E-4) it returns null
 * unless every one of them has reported a result for every candidate.
 */
export function pickEmber(g: Gathering, answers: readonly Answer[], final: boolean): Label | null {
  if (g.ember_candidates.length === 0) return "spot";
  const voters = answers.filter((a) => a.status === "yes" || a.member_id === g.host);
  if (!final) {
    if (!voters.some((a) => a.member_id === g.host)) return null; // the host has not reported yet
    const allIn = voters.every((a) => g.ember_candidates.every((c) => a.checks[c] !== undefined));
    if (!allIn) return null;
  }
  for (const c of g.ember_candidates) {
    if (voters.every((a) => a.checks[c] !== false)) return c;
  }
  return "spot";
}

function enterEmber(d: Draft): void {
  const g = d.g;
  g.state = "ember";
  g.state_since = iso(d.nowMs);
  g.quorum = EMBER_QUORUM;
  g.ember_choice = null;
  d.changed = true;
  d.effects.push({ type: "counter", name: "embers" });
  schedule(d, "gone", t0(g) + EMBER_END_MS);
  const choice = pickEmber(g, d.answers, false);
  if (choice === null) schedule(d, "ember_pick", d.nowMs + EMBER_PICK_MS);
  else chooseEmber(d, choice, false);
  d.effects.push({ type: "sse" });
  if (choice !== null) solveAndMaybeLight(d);
}

/** Settle the Ember spot and announce it: "Smaller plan: 15 min at {bench}." (SRS-EMB-2). */
function chooseEmber(d: Draft, choice: Label, cancelPickJob: boolean): void {
  d.g.ember_choice = choice;
  d.changed = true;
  if (cancelPickJob) unschedule(d, "ember_pick");
  d.effects.push({ type: "push", event: "ember", to: "all", label: choice });
  d.effects.push({ type: "telegram", action: "ember" });
}

// ---------- Re-solve after any change ----------

/** Lights the gathering when its state allows it and the solver reaches quorum. */
function solveAndMaybeLight(d: Draft): boolean {
  const g = d.g;
  if (g.kind === "flare") {
    if (g.state === "kindling" && d.nowMs > t0(g) + KINDLING_MS) return false; // BR-F-2: Ember's now
    if (g.state === "ember" && g.ember_choice === null) return false; // wait for the place
    const s = solve(g, d.answers, iso(d.nowMs));
    if (s.lights) {
      light(d, s.set, null, false);
      return true;
    }
    return false;
  }
  // Plan in Kindling: only the "everyone said yes" early light before D (BR-P-2).
  const plan = g.plan;
  if (!plan || d.nowMs >= ms(plan.deadline_at)) return false;
  const plain = d.answers.filter(
    (a) => a.member_id !== g.host && a.status === "yes" && a.rules.length === 0 && !a.ember_only,
  );
  if (g.group_size < 2 || plain.length < g.group_size - 1) return false;
  const set = fixedPoint([g.host], plain, planCtx(g, 1));
  if (set.length < g.group_size || size(set, g) < g.quorum) return false;
  light(d, set, 1, false);
  return true;
}

/** After an answer-type change before Lit: light, or publish the new count. */
function afterChange(d: Draft): void {
  const g = d.g;
  if (g.state === "ember" && g.ember_choice === null) {
    const choice = pickEmber(g, d.answers, false);
    if (choice !== null) chooseEmber(d, choice, true);
  }
  if (solveAndMaybeLight(d)) return;
  d.effects.push({ type: "telegram", action: "edit_count" });
  d.effects.push({ type: "sse" });
}

// ---------- Plan deadline (P4, P5, P6) ----------

function atDeadline(d: Draft): void {
  const g = d.g;
  const forced = [g.host];
  const top = best(
    forced,
    candidates(g, d.answers, false),
    STEPS.map((k) => planCtx(g, k)),
  );
  if (size(top.set, g) >= g.quorum && top.step !== null) {
    light(d, top.set, top.step, false); // P4
    return;
  }
  const save = fixedPoint(forced, candidates(g, d.answers, true), planCtx(g, 4));
  if (size(save, g) >= EMBER_QUORUM) {
    light(d, save, 4, true); // P5
    return;
  }
  end(d, "not_this_time", "plan_deadline"); // P6
}

// ---------- Fades (P7, P8, P9; BR-P-5, BR-P-6, ADR-0016) ----------

function fade(d: Draft, member: Id): Result | null {
  const g = d.g;
  const plan = g.plan;
  if (g.kind !== "plan" || !plan || g.state !== "lit" || plan.current_step === null) return fail("wrong_state");
  if (!g.chosen_set.includes(member)) return fail("not_in_set");
  const a = member === g.host ? hostAnswer(d) : find(d, member);
  if (!a) return fail("not_in_set");
  if (a.faded) return fail("fade_used");
  const k = plan.current_step;
  const windowEnd = ms(plan.start_at) + (planStep(g, k).minutes * MINUTE) / 2;
  if (d.nowMs > windowEnd) return fail("fade_window_closed");
  a.faded = true;
  d.changed = true;
  if (k === 4) return null; // P8: recorded, no step change
  const next = (k + 1) as Step;
  plan.current_step = next;
  const ctx = planCtx(g, next);
  const set = fixedPoint(g.chosen_set, candidates(g, d.answers, false), ctx);
  g.chosen_set = set;
  const inSet = new Set(set);
  const notify: Id[] = [];
  for (const x of d.answers) {
    if (x.member_id === g.host || !inSet.has(x.member_id)) continue;
    const coming = x.status !== "yes" || allRulesHold(x, inSet, ctx);
    const was = x.still_coming;
    x.still_coming = !coming;
    if (!coming && !was) notify.push(x.member_id);
  }
  d.effects.push({ type: "counter", name: "plan_fades" });
  schedule(d, "gone", litEndMs(g));
  d.effects.push({ type: "push", event: "plan_smaller", to: "all", step: next, label: ctx.label });
  if (notify.length > 0) d.effects.push({ type: "push", event: "still_coming", to: notify.sort(), step: next });
  d.effects.push({ type: "telegram", action: "smaller" });
  d.effects.push({ type: "sse" });
  return null;
}

// ---------- Arrivals (BR-H-1 to BR-H-5, BR-K-1) ----------

function arrival(d: Draft, e: Extract<EngineEvent, { type: "arrival" }>): Result | null {
  const g = d.g;
  if (g.state !== "lit" || g.lit_at === null) return fail("wrong_state");
  const recorded = ms(e.recorded_at);
  if (recorded < ms(g.lit_at)) return null; // BR-H-5: outside the Lit window, ignored
  const at = iso(Math.min(recorded, d.nowMs));
  const cap = yesCount(g, d.answers) + HEADCOUNT_SLACK;
  const hc = g.headcount ?? 1;
  if (e.who.for !== "self" && e.by !== g.host) return fail("not_host");
  if (e.who.for === "someone_else") {
    if (hc >= cap) return null; // BR-H-4
    g.headcount = hc + 1;
    d.changed = true;
    d.effects.push({ type: "sse" });
    return null;
  }
  const who = e.who.for === "self" ? e.by : e.who.member_id;
  if (who === g.host) {
    const h = hostAnswer(d);
    if (h.arrived_at !== null) return null;
    h.arrived_at = at; // the host is already the 1 in the headcount (BR-H-1)
    d.changed = true;
    d.effects.push({ type: "spark_ticket", member_id: who });
    return null;
  }
  const a = find(d, who);
  if (!a) return fail("unknown_member");
  if (a.arrived_at !== null) return null; // BR-H-3: counts once
  if (hc >= cap) return null; // BR-H-4
  a.arrived_at = at;
  g.headcount = hc + 1;
  d.changed = true;
  d.effects.push({ type: "spark_ticket", member_id: who }); // BR-K-1
  d.effects.push({ type: "sse" });
  return null;
}

// ---------- Timers ----------

function timer(d: Draft, job: JobKind): void {
  const g = d.g;
  switch (job) {
    case "ember":
      if (g.kind === "flare" && g.state === "kindling" && d.nowMs >= t0(g) + KINDLING_MS) enterEmber(d); // F4
      return;
    case "ember_pick":
      if (g.state === "ember" && g.ember_choice === null) {
        const choice = pickEmber(g, d.answers, true) ?? "spot"; // F5
        chooseEmber(d, choice, false);
        d.effects.push({ type: "sse" });
        solveAndMaybeLight(d);
      }
      return;
    case "gone":
      if (g.kind === "flare" && g.state === "ember" && d.nowMs >= t0(g) + EMBER_END_MS)
        end(d, "not_this_time", "gone"); // F7
      else if (g.state === "lit" && d.nowMs >= litEndMs(g)) end(d, "thanks_for_coming", "gone"); // F9, P10
      return;
    case "plan_deadline":
      if (g.kind === "plan" && g.state === "kindling" && g.plan && d.nowMs >= ms(g.plan.deadline_at)) atDeadline(d);
      return;
    case "plan_reminder":
      if (g.kind === "plan" && g.state === "lit" && g.plan?.current_step) {
        d.effects.push({ type: "push", event: "plan_soon", to: "set", step: g.plan.current_step });
        d.changed = true;
      }
      return;
    case "delete":
      return; // F14: deletion is the backend's cascade; nothing changes here
  }
}

// ---------- Entry point ----------

function clone<T>(v: T): T {
  return structuredClone(v);
}

export function transition(g0: Gathering, answers0: Answer[], event: EngineEvent, now: Iso): Result {
  const d: Draft = { g: clone(g0), answers: clone(answers0), effects: [], nowMs: ms(now), changed: false };
  const g = d.g;
  if (g.state === "gone") {
    if (event.type === "timer") return done(d); // F13/F14: stale timers and delete do nothing
    return fail("wrong_state"); // F13: the backend answers 410 gone
  }
  const preLit = g.state === "kindling" || g.state === "ember";
  switch (event.type) {
    case "answer": {
      if (event.member_id === g.host) return fail("wrong_state"); // the host is always in (BR-Q-1)
      let a = find(d, event.member_id);
      if (!a) {
        a = blankAnswer(event.member_id);
        d.answers.push(a);
      }
      a.status = event.answer;
      a.rules = clone(event.rules);
      a.ember_only = event.ember_only;
      a.still_coming = false;
      d.changed = true;
      if (preLit) afterChange(d);
      else d.effects.push({ type: "sse" }); // F10, F11: state unchanged
      return done(d);
    }
    case "take_back": {
      if (!preLit) return fail("already_lit"); // F12
      const a = find(d, event.member_id);
      if (!a) return fail("unknown_member");
      if (a.status !== "yes") return done(d);
      a.status = "taken_back";
      d.changed = true;
      afterChange(d);
      return done(d);
    }
    case "checks": {
      const a = event.member_id === g.host ? hostAnswer(d) : find(d, event.member_id);
      if (!a) return fail("unknown_member");
      a.checks = { ...a.checks, ...event.results };
      a.checks_at = now;
      d.changed = true;
      if (preLit) afterChange(d);
      return done(d);
    }
    case "text_yes": {
      if (g.text_yes >= TEXT_YES_CAP) return fail("text_yes_cap");
      g.text_yes += 1;
      d.changed = true;
      if (preLit) afterChange(d);
      else d.effects.push({ type: "sse" });
      return done(d);
    }
    case "fade": {
      const r = fade(d, event.member_id);
      return r ?? done(d);
    }
    case "arrival": {
      const r = arrival(d, event);
      return r ?? done(d);
    }
    case "done": {
      if (event.by !== g.host) return fail("not_host");
      if (g.state !== "lit") return fail("wrong_state");
      end(d, "thanks_for_coming", null); // F9, P10
      return done(d);
    }
    case "cancel": {
      if (event.by !== g.host) return fail("not_host");
      if (!preLit) return fail("wrong_state"); // BR-F-6
      end(d, "not_this_time", null); // F8, P11
      return done(d);
    }
    case "member_left": {
      if (event.member_id === g.host) {
        if (preLit) end(d, "not_this_time", null);
        return done(d);
      }
      const before = d.answers.length;
      d.answers = d.answers.filter((a) => a.member_id !== event.member_id);
      const wasInSet = g.chosen_set.includes(event.member_id);
      g.chosen_set = g.chosen_set.filter((id) => id !== event.member_id);
      d.changed = d.changed || before !== d.answers.length || wasInSet;
      if (preLit) afterChange(d);
      else if (d.changed) d.effects.push({ type: "sse" });
      return done(d);
    }
    case "timer":
      timer(d, event.job);
      return done(d);
  }
}
