// Plan machine rows P1 to P11 (docs/architecture/04-state-machines.md section 2) and E15-S3 AC2.
import type { Rule } from "@flare/shared/icd/engine";
import { describe, expect, it } from "vitest";
import { createPlan, engine, ladderOk, planTimesOk } from "../src/index.ts";
import {
  answer,
  at,
  atMs,
  D,
  effects,
  expectError,
  flare,
  HOST,
  LADDER,
  m,
  plan,
  run,
  S,
  step,
  T0,
  yes,
} from "./helpers.ts";

const maxStep = (n: 1 | 2 | 3 | 4): Rule => ({ type: "max_step", step: n });
const minStep = (n: 1 | 2 | 3 | 4): Rule => ({ type: "min_step", step: n });
const deadline = { type: "timer", job: "plan_deadline" } as const;

function input(over: Partial<Parameters<typeof createPlan>[0]> = {}) {
  return {
    id: "p",
    group_id: "x",
    host: HOST,
    group_size: 6,
    quorum: 3,
    start_at: S,
    deadline_at: D,
    steps: LADDER,
    ...over,
  };
}

describe("P1 create", () => {
  it("P1: Kindling, job plan_deadline at D, expiry S + 24 h", () => {
    const r = createPlan(input(), T0);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.gathering.kind).toBe("plan");
    expect(r.gathering.plan).toEqual({ start_at: S, deadline_at: D, steps: LADDER, current_step: null });
    expect(r.effects).toEqual([
      { type: "schedule", job: "plan_deadline", at: D },
      { type: "counter", name: "plans_created" },
    ]);
    expect(r.expires_at).toBe(at(120 + 24 * 60));
  });
  it("P1 BR-P-1: deadline edges", () => {
    expect(planTimesOk(at(30), at(10), T0)).toBe(true); // D = now + 10, S = D + 20
    expect(planTimesOk(at(30), atMs(10 * 60_000 - 1), T0)).toBe(false); // D too soon
    expect(planTimesOk(at(30), at(20), T0)).toBe(true); // D = S - 10
    expect(planTimesOk(at(30), atMs(20 * 60_000 + 1), T0)).toBe(false); // D too close to S
    expect(planTimesOk(at(36 * 60), at(60), T0)).toBe(true); // S = now + 36 h
    expect(planTimesOk(atMs(36 * 3_600_000 + 1), at(60), T0)).toBe(false); // S too far
    expect(createPlan(input({ deadline_at: at(5) }), T0)).toEqual({ ok: false, error: "plan_times" });
  });
  it("P1 BR-P-4: exactly 4 steps, minutes strictly decreasing, valid labels", () => {
    expect(ladderOk(LADDER)).toBe(true);
    expect(ladderOk([...LADDER].reverse())).toBe(true); // order of the array does not matter
    expect(ladderOk(LADDER.slice(0, 3))).toBe(false);
    expect(ladderOk(LADDER.map((s) => (s.step === 2 ? { ...s, minutes: 90 } : s)))).toBe(false);
    expect(ladderOk(LADDER.map((s) => (s.step === 4 ? { ...s, minutes: 0 } : s)))).toBe(false);
    expect(ladderOk(LADDER.map((s) => (s.step === 3 ? { ...s, step: 2 as const } : s)))).toBe(false);
    // biome-ignore lint/suspicious/noExplicitAny: bad input from outside the type system
    expect(ladderOk(LADDER.map((s) => (s.step === 1 ? { ...s, place: "Fairlane" as any } : s)))).toBe(false);
    expect(createPlan(input({ steps: LADDER.slice(1) }), T0)).toEqual({ ok: false, error: "bad_request" });
  });
  it("P1 BR-Q-2: Plan quorum 2 to 6; group at most 12", () => {
    expect(createPlan(input({ quorum: 1 }), T0)).toEqual({ ok: false, error: "quorum_range" });
    expect(createPlan(input({ quorum: 7 }), T0)).toEqual({ ok: false, error: "quorum_range" });
    expect(createPlan(input({ quorum: 6 }), T0).ok).toBe(true);
    expect(createPlan(input({ group_size: 0 }), T0)).toEqual({ ok: false, error: "group_full" });
  });
});

describe("P2 early light (BR-P-2)", () => {
  it("P2: every member yes with no rules before D lights at step 1", () => {
    const w = run(plan({ group_size: 3, quorum: 3 }), [
      [yes(1), at(5)],
      [yes(2), at(6)],
    ]);
    expect(w.g.state).toBe("lit");
    expect(w.g.plan?.current_step).toBe(1);
    expect(w.g.chosen_set).toEqual([HOST, m(1), m(2)]);
    expect(effects(w.last)).toEqual([
      { type: "unschedule", job: "plan_deadline" },
      { type: "schedule", job: "gone", at: at(120 + 90 + 60) },
      { type: "schedule", job: "plan_reminder", at: at(90) },
      { type: "counter", name: "plans_lit_step", bucket: "1" },
      { type: "push", event: "plan_on", to: "set", step: 1, label: "step:1" },
      { type: "telegram", action: "lit" },
      { type: "sse" },
    ]);
  });
  it("P2: not every member yet means wait for D", () => {
    const w = run(plan({ group_size: 4, quorum: 3 }), [
      [yes(1), at(5)],
      [yes(2), at(6)],
    ]);
    expect(w.g.state).toBe("kindling");
  });
  it("P2: a yes with a rule blocks the early light", () => {
    const w = run(plan({ group_size: 3, quorum: 3 }), [
      [yes(1), at(5)],
      [yes(2, [maxStep(1)]), at(6)],
    ]);
    expect(w.g.state).toBe("kindling");
  });
  it("P2: a failing step-1 check blocks the early light", () => {
    const w = run(
      plan({ group_size: 3, quorum: 3 }),
      [[yes(2), at(6)]],
      [answer(1, [], { checks: { "step:1": false } })],
    );
    expect(w.g.state).toBe("kindling");
  });
  it("P2: everyone yes after D (timer not yet run) waits for the timer", () => {
    const w = run(plan({ group_size: 2, quorum: 2 }), [[yes(1), atMs(60 * 60_000)]]);
    expect(w.g.state).toBe("kindling");
  });
  it("P2: a one-person group never lights early", () => {
    expect(run(plan({ group_size: 1, quorum: 2 }), [[{ type: "text_yes" }, at(5)]]).g.state).toBe("kindling");
  });
  it("P2: the whole group below quorum does not light early", () => {
    const w = run(plan({ group_size: 2, quorum: 3 }), [[yes(1), at(5)]]);
    expect(w.g.state).toBe("kindling");
  });
});

describe("P3 need at the highest step that could still light", () => {
  it("P3 BR-Q-4 SRS-PLAN-11: need counts the best step", () => {
    const w = run(plan({ quorum: 4 }), [
      [yes(1), at(5)],
      [yes(2, [maxStep(3)]), at(6)],
    ]);
    expect(w.g.state).toBe("kindling");
    const s = engine.solve(w.g, w.answers, at(7));
    expect(s.step).toBe(3);
    expect(s.set).toEqual([HOST, m(1), m(2)]);
    expect(s.need).toBe(1);
    expect(engine.view(w.g, w.answers, at(7))).toEqual({ need: 1, next_change_at: D });
  });
});

describe("P4 to P6 at the deadline (E15-S3 AC2)", () => {
  it("P4: all yes at step 1", () => {
    const w = run(plan(), [
      [yes(1), at(5)],
      [yes(2), at(6)],
      [deadline, D],
    ]);
    expect(w.g.state).toBe("lit");
    expect(w.g.plan?.current_step).toBe(1);
    expect(effects(w.last)).toContainEqual({ type: "push", event: "plan_on", to: "set", step: 1, label: "step:1" });
  });
  it("P4 BR-S-1: one max_step(3) pulls a group of 4 to step 3 because that keeps more people", () => {
    const w = run(plan(), [
      [yes(1), at(5)],
      [yes(2), at(5)],
      [yes(3, [maxStep(3)]), at(6)],
      [deadline, D],
    ]);
    expect(w.g.plan?.current_step).toBe(3);
    expect(w.g.chosen_set).toEqual([HOST, m(1), m(2), m(3)]);
    expect(effects(w.last)).toContainEqual({ type: "schedule", job: "gone", at: at(120 + 40 + 60) });
  });
  it("P4 BR-S-1: max_step(3) does not pull the group down when it keeps nobody extra", () => {
    const w = run(plan(), [
      [yes(1), at(5)],
      [yes(2, [minStep(2)]), at(5)],
      [yes(3, [maxStep(3)]), at(6)],
      [deadline, D],
    ]);
    // step 1 or 2: host, m1, m2 (3); step 3 or 4: host, m1, m3 (3); tie on people, higher step wins
    expect(w.g.plan?.current_step).toBe(1);
    expect(w.g.chosen_set).toEqual([HOST, m(1), m(2)]);
  });
  it("P4 BR-C-7: a needs-fail on step 1 for one person moves to step 2 when that keeps more people", () => {
    const w = run(
      plan({ quorum: 4 }),
      [
        [yes(2), at(5)],
        [yes(3), at(5)],
        [deadline, D],
      ],
      [answer(1, [], { checks: { "step:1": false } })],
    );
    expect(w.g.plan?.current_step).toBe(2);
    expect(w.g.chosen_set).toHaveLength(4);
  });
  it("P5 BR-P-3: no step reaches quorum but 2 fit step 4: lit at step 4, Ember save", () => {
    const w = run(plan({ quorum: 4 }), [
      [yes(1), at(5)],
      [deadline, D],
    ]);
    expect(w.g.state).toBe("lit");
    expect(w.g.plan?.current_step).toBe(4);
    expect(effects(w.last)).toEqual([
      { type: "unschedule", job: "plan_deadline" },
      { type: "schedule", job: "gone", at: at(120 + 20 + 60) },
      { type: "schedule", job: "plan_reminder", at: at(90) },
      { type: "counter", name: "plans_lit_step", bucket: "4" },
      { type: "counter", name: "plan_ember_saves" },
      { type: "push", event: "plan_ember", to: "set", step: 4, label: "step:4" },
      { type: "telegram", action: "lit" },
      { type: "sse" },
    ]);
  });
  it("P5 BR-Q-6: an Ember-only yes counts for the step-4 save only", () => {
    const g = plan({ quorum: 3 });
    const w = run(g, [[yes(1, [], true), at(5)]]);
    expect(engine.solve(w.g, w.answers, at(6)).need).toBe(2);
    const d = step(w, deadline, D);
    expect(d.g.plan?.current_step).toBe(4);
    expect(d.g.chosen_set).toEqual([HOST, m(1)]);
  });
  it("P6: nobody fits: Gone, not this time", () => {
    const w = run(plan(), [
      [yes(1, [maxStep(4), minStep(3)]), at(5)],
      [deadline, D],
    ]);
    expect(w.g.state).toBe("gone");
    expect(w.g.ended).toBe("not_this_time");
    expect(effects(w.last)).not.toContainEqual({ type: "unschedule", job: "plan_deadline" });
  });
  it("P4: an early deadline timer does nothing", () => {
    expect(run(plan(), [[deadline, atMs(60 * 60_000 - 1)]]).g.state).toBe("kindling");
  });
  it("P4 BR-C-5 BR-C-6: after and back_by are judged against S and the step's minutes", () => {
    const w = run(plan({ quorum: 3 }), [
      [yes(1, [{ type: "after", at: S }]), at(5)],
      [yes(2, [{ type: "back_by", at: at(120 + 40) }]), at(5)],
      [deadline, D],
    ]);
    // back_by S+40: steps 3 (40 min) and 4 fit; step 3 is higher
    expect(w.g.plan?.current_step).toBe(3);
    expect(w.g.chosen_set).toEqual([HOST, m(1), m(2)]);
  });
});

/** A Plan lit at step 1 with host, m1, m2, m3; m2 needs step 1; m4 joins only at step 2 or smaller. */
function litPlan() {
  return run(plan({ quorum: 3 }), [
    [yes(1), at(5)],
    [yes(2, [minStep(1)]), at(5)],
    [yes(3), at(5)],
    [yes(4, [maxStep(2)]), at(5)],
    [yes(5, [{ type: "with", member_id: m(4) }]), at(5)],
    [deadline, D],
  ]);
}

describe("P7 to P9 fades", () => {
  it("BR-S-1 BR-S-3: a with-chain at step 2 outweighs a bigger step", () => {
    const w = litPlan();
    // step 1: host m1 m2 m3 (4); step 2: host m1 m3 m4 m5 (5, m5 rides with m4): step 2 wins
    expect(w.g.plan?.current_step).toBe(2);
    expect(w.g.chosen_set).toEqual([HOST, m(1), m(3), m(4), m(5)]);
  });
  it("P7 BR-P-6 ADR-0016: a fade lowers one step, adds fits, removes nobody, notes still_coming", () => {
    const w = run(plan({ quorum: 3 }), [
      [yes(1), at(5)],
      [yes(2, [minStep(1)]), at(5)],
      [yes(3, [maxStep(2)]), at(5)],
      [deadline, D],
    ]);
    // step 1: host m1 m2 (3); step 2: host m1 m3 (3): tie, step 1 wins
    expect(w.g.plan?.current_step).toBe(1);
    expect(w.g.chosen_set).toEqual([HOST, m(1), m(2)]);
    const f = step(w, { type: "fade", member_id: m(1) }, at(130));
    expect(f.g.plan?.current_step).toBe(2);
    expect(f.g.chosen_set).toEqual([HOST, m(1), m(2), m(3)]);
    expect(f.answers.find((a) => a.member_id === m(1))?.faded).toBe(true);
    expect(f.answers.find((a) => a.member_id === m(2))?.still_coming).toBe(true);
    expect(f.answers.find((a) => a.member_id === m(3))?.still_coming).toBe(false);
    expect(effects(f.last)).toEqual([
      { type: "counter", name: "plan_fades" },
      { type: "schedule", job: "gone", at: at(120 + 60 + 60) },
      { type: "push", event: "plan_smaller", to: "all", step: 2, label: "step:2" },
      { type: "push", event: "still_coming", to: [m(2)], step: 2 },
      { type: "telegram", action: "smaller" },
      { type: "sse" },
    ]);
    // a second fade by someone else: m2 was already told, m3 (step 2 or smaller) still fits step 3
    const f2 = step(f, { type: "fade", member_id: m(3) }, at(131));
    expect(f2.g.plan?.current_step).toBe(3);
    expect(f2.answers.find((a) => a.member_id === m(2))?.still_coming).toBe(true);
    expect(effects(f2.last).filter((e) => e.type === "push" && e.event === "still_coming")).toEqual([]);
  });
  it("P7: the host may fade too", () => {
    const w = run(plan(), [
      [yes(1), at(5)],
      [yes(2), at(5)],
      [deadline, D],
    ]);
    const f = step(w, { type: "fade", member_id: HOST }, at(100));
    expect(f.g.plan?.current_step).toBe(2);
    expectError(engine.transition(f.g, f.answers, { type: "fade", member_id: HOST }, at(101)), "fade_used");
  });
  it("P7 BR-P-5: window edge at S + 50% of the step's minutes", () => {
    const w = run(plan(), [
      [yes(1), at(5)],
      [yes(2), at(5)],
      [deadline, D],
    ]);
    // step 1 is 90 min: window ends at S + 45:00.000
    expect(step(w, { type: "fade", member_id: m(1) }, at(120 + 45)).g.plan?.current_step).toBe(2);
    expectError(
      engine.transition(w.g, w.answers, { type: "fade", member_id: m(1) }, atMs((165 * 60 + 0) * 1000 + 1)),
      "fade_window_closed",
    );
  });
  it("P8: a fade at step 4 is recorded with no step change", () => {
    const w = run(plan({ quorum: 4 }), [
      [yes(1), at(5)],
      [deadline, D],
    ]);
    expect(w.g.plan?.current_step).toBe(4);
    const f = step(w, { type: "fade", member_id: m(1) }, at(125));
    expect(f.g.plan?.current_step).toBe(4);
    expect(f.answers[0]?.faded).toBe(true);
    expect(effects(f.last)).toEqual([]);
    expect(f.g.version).toBe(w.g.version + 1);
  });
  it("P9: second fade by the same member is fade_used", () => {
    const w = run(plan(), [
      [yes(1), at(5)],
      [yes(2), at(5)],
      [deadline, D],
    ]);
    const f = step(w, { type: "fade", member_id: m(1) }, at(100));
    expectError(engine.transition(f.g, f.answers, { type: "fade", member_id: m(1) }, at(101)), "fade_used");
  });
  it("P9: a member outside the set cannot fade", () => {
    const w = run(plan(), [
      [yes(1), at(5)],
      [yes(2), at(5)],
      [deadline, D],
      [yes(7), at(70)],
    ]);
    expectError(engine.transition(w.g, w.answers, { type: "fade", member_id: m(7) }, at(71)), "not_in_set");
    expectError(engine.transition(w.g, [], { type: "fade", member_id: m(1) }, at(71)), "not_in_set");
  });
  it("P9: fades only in a Lit Plan", () => {
    expectError(engine.transition(plan(), [], { type: "fade", member_id: HOST }, at(5)), "wrong_state");
    const f = run(flare(), [[yes(1), at(1)]]);
    expectError(engine.transition(f.g, f.answers, { type: "fade", member_id: m(1) }, at(2)), "wrong_state");
  });
});

describe("P10 P11 ending", () => {
  it("P10: Done ends a Lit Plan with thanks_for_coming", () => {
    const w = run(plan(), [
      [yes(1), at(5)],
      [yes(2), at(5)],
      [deadline, D],
      [{ type: "done", by: HOST }, at(200)],
    ]);
    expect(w.g.state).toBe("gone");
    expect(w.g.ended).toBe("thanks_for_coming");
    expect(effects(w.last)).not.toContainEqual(expect.objectContaining({ name: "headcount_sum" }));
  });
  it("P10 BR-P-8: timer gone at S + step minutes + 60 min", () => {
    const w = run(plan(), [
      [yes(1), at(5)],
      [yes(2), at(5)],
      [deadline, D],
    ]);
    expect(step(w, { type: "timer", job: "gone" }, atMs((120 + 90 + 60) * 60_000 - 1)).g.state).toBe("lit");
    expect(step(w, { type: "timer", job: "gone" }, at(120 + 90 + 60)).g.ended).toBe("thanks_for_coming");
  });
  it("P11: the host cancels in Kindling", () => {
    const w = run(plan(), [[{ type: "cancel", by: HOST }, at(5)]]);
    expect(w.g.ended).toBe("not_this_time");
    expect(effects(w.last)[0]).toEqual({ type: "unschedule", job: "plan_deadline" });
  });
  it("P11: cancel after Lit is wrong_state", () => {
    const w = run(plan(), [
      [yes(1), at(5)],
      [yes(2), at(5)],
      [deadline, D],
    ]);
    expectError(engine.transition(w.g, w.answers, { type: "cancel", by: HOST }, at(70)), "wrong_state");
  });
});

describe("Automations: a reminder 30 min before a lit Plan starts", () => {
  const reminder = { type: "timer", job: "plan_reminder" } as const;
  it("lighting at the deadline schedules plan_reminder at S - 30 min; the timer pushes plan_soon to the set", () => {
    const w = run(plan(), [
      [yes(1), at(5)],
      [yes(2), at(6)],
      [deadline, D],
    ]);
    expect(effects(w.last)).toContainEqual({ type: "schedule", job: "plan_reminder", at: at(90) });
    const r = run(w.g, [[reminder, at(90)]], w.answers);
    expect(effects(r.last)).toContainEqual({ type: "push", event: "plan_soon", to: "set", step: 1 });
  });
  it("no reminder when the Plan lights less than 30 min before it starts", () => {
    const w = run(plan(), [
      [yes(1), at(5)],
      [yes(2), at(6)],
      [deadline, at(95)],
    ]);
    expect(effects(w.last).some((e) => e.type === "schedule" && e.job === "plan_reminder")).toBe(false);
  });
  it("a stale reminder after the Plan ended does nothing", () => {
    const w = run(plan(), [
      [yes(1), at(5)],
      [yes(2), at(6)],
      [deadline, D],
    ]);
    const gone = { ...w.g, state: "gone" as const };
    const r = engine.transition(gone, w.answers, reminder, at(90));
    expect(r.ok && r.effects).toEqual([]);
  });
});
