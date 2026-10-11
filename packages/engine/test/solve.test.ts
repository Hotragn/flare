// Solver cases: E1-S4 AC2, BR-S-1 to BR-S-6, BR-C-3 to BR-C-8, BR-Q-1 to BR-Q-6.
import type { Rule } from "@flare/shared/icd/engine";
import { describe, expect, it } from "vitest";
import { engine } from "../src/index.ts";
import { compareCandidates, fixedPoint, flareCtx, ruleHolds } from "../src/solve.ts";
import { answer, at, flare, HOST, m, plan, run } from "./helpers.ts";

const withM = (n: number): Rule => ({ type: "with", member_id: m(n) });

describe("E1-S4 AC2 solver cases", () => {
  it("BR-S-2: no rules: everyone who said yes is in", () => {
    const s = engine.solve(flare({ quorum: 4 }), [answer(1), answer(2), answer(3)], at(5));
    expect(s).toEqual({ set: [HOST, m(1), m(2), m(3)], step: null, need: 0, lights: true });
  });
  it("BR-S-3: with chain A with B, B with C, C present: all in", () => {
    const s = engine.solve(flare({ quorum: 4 }), [answer(1, [withM(2)]), answer(2, [withM(3)]), answer(3)], at(5));
    expect(s.set).toEqual([HOST, m(1), m(2), m(3)]);
  });
  it("BR-S-3: with chain where C never said yes unravels to nobody", () => {
    const s = engine.solve(flare({ quorum: 4 }), [answer(1, [withM(2)]), answer(2, [withM(3)])], at(5));
    expect(s.set).toEqual([HOST]);
    expect(s.need).toBe(3);
  });
  it("BR-S-3: a with cycle A with B, B with A holds together", () => {
    const s = engine.solve(flare({ quorum: 3 }), [answer(1, [withM(2)]), answer(2, [withM(1)])], at(5));
    expect(s.set).toEqual([HOST, m(1), m(2)]);
  });
  it("BR-C-3: with the host always holds", () => {
    const s = engine.solve(flare(), [answer(1, [{ type: "with", member_id: HOST }])], at(5));
    expect(s.set).toEqual([HOST, m(1)]);
  });
  it("BR-C-5 BR-C-6: conflicting times: after 4 PM and back by 3 PM can never hold", () => {
    const rules: Rule[] = [
      { type: "after", at: "2026-10-11T20:00:00.000Z" },
      { type: "back_by", at: "2026-10-11T19:00:00.000Z" },
    ];
    const s = engine.solve(flare(), [answer(1, rules)], "2026-10-11T19:30:00.000Z");
    expect(s.set).toEqual([HOST]);
    expect(s.lights).toBe(false);
  });
  it("BR-C-5: after T holds when the Flare would start (now) at or after T", () => {
    const g = flare();
    const a = [answer(1, [{ type: "after", at: at(10) }])];
    expect(engine.solve(g, a, at(9.99)).set).toEqual([HOST]);
    expect(engine.solve(g, a, at(10)).set).toEqual([HOST, m(1)]);
  });
  it("BR-C-6: back_by T for a Flare uses 60 minutes", () => {
    const g = flare();
    const a = [answer(1, [{ type: "back_by", at: at(70) }])];
    expect(engine.solve(g, a, at(10)).set).toEqual([HOST, m(1)]);
    expect(engine.solve(g, a, at(10.01)).set).toEqual([HOST]);
  });
  it("BR-C-7: max_walk is judged by the phone's check for the spot", () => {
    const g = flare();
    const rules: Rule[] = [{ type: "max_walk", minutes: 10 }];
    expect(engine.solve(g, [answer(1, rules, { checks: { spot: true } })], at(1)).set).toEqual([HOST, m(1)]);
    expect(engine.solve(g, [answer(1, rules, { checks: { spot: false } })], at(1)).set).toEqual([HOST]);
    expect(engine.solve(g, [answer(1, rules)], at(1)).set).toEqual([HOST, m(1)]); // not reported: pass
  });
  it("a yes that can never be satisfied (with someone who left) stays out without hurting others", () => {
    const s = engine.solve(flare({ quorum: 3 }), [answer(1, [withM(9)]), answer(2)], at(1));
    expect(s.set).toEqual([HOST, m(2)]);
    expect(s.need).toBe(1);
  });
  it("BR-C-8 ADR-0016: max_step and min_step do not apply to Flares", () => {
    const rules: Rule[] = [
      { type: "max_step", step: 4 },
      { type: "min_step", step: 1 },
    ];
    expect(engine.solve(flare(), [answer(1, rules)], at(1)).set).toEqual([HOST, m(1)]);
  });
  it("BR-C-8 ADR-0016: max_step n holds at step ≥ n; min_step n at step ≤ n", () => {
    const ctx = (step: 1 | 2 | 3 | 4) => ({ ...flareCtx(0, "spot"), kind: "plan" as const, step });
    expect(ruleHolds({ type: "max_step", step: 3 }, ctx(2))).toBe(false);
    expect(ruleHolds({ type: "max_step", step: 3 }, ctx(3))).toBe(true);
    expect(ruleHolds({ type: "min_step", step: 2 }, ctx(2))).toBe(true);
    expect(ruleHolds({ type: "min_step", step: 2 }, ctx(3))).toBe(false);
  });
  it("BR-Q-5: non-yes answers never enter the set", () => {
    const s = engine.solve(
      flare(),
      [answer(1, [], { status: "taken_back" }), answer(2, [], { status: "cant_make_it" })],
      at(1),
    );
    expect(s.set).toEqual([HOST]);
  });
});

describe("BR-S-1 and BR-S-6 ordering", () => {
  it("more people beats a higher step; a higher step beats an earlier start; then lowest ids", () => {
    const a = { set: ["a", "b", "c"], step: 3 as const, startMs: 0 };
    const b = { set: ["a", "b"], step: 1 as const, startMs: 0 };
    expect(compareCandidates(a, b)).toBeLessThan(0);
    const c = { set: ["a", "b"], step: 2 as const, startMs: 0 };
    expect(compareCandidates(b, c)).toBeLessThan(0);
    const d = { set: ["a", "b"], step: 1 as const, startMs: 5 };
    expect(compareCandidates(b, d)).toBeLessThan(0);
    const e = { set: ["a", "c"], step: 1 as const, startMs: 0 };
    expect(compareCandidates(b, e)).toBeLessThan(0);
    expect(compareCandidates(b, { ...b })).toBe(0);
  });
  it("BR-S-6: output ids are sorted ascending whatever the answer order", () => {
    const s = engine.solve(flare({ quorum: 4 }), [answer(3), answer(1), answer(2)], at(1));
    expect(s.set).toEqual([HOST, m(1), m(2), m(3)]);
  });
  it("fixedPoint keeps forced members even when their with targets are missing", () => {
    const set = fixedPoint([m(1)], [answer(1, [withM(9)]), answer(2, [withM(1)])], flareCtx(0, "spot"));
    expect(set).toEqual([m(1), m(2)]);
  });
});

describe("solve at Lit and Gone", () => {
  it("returns the chosen set at Lit", () => {
    const w = run(flare(), [[{ type: "answer", member_id: m(2), answer: "yes", rules: [], ember_only: false }, at(1)]]);
    expect(engine.solve(w.g, w.answers, at(2))).toEqual({ set: [HOST, m(2)], step: null, need: 0, lights: true });
  });
  it("Gone without Lit does not light", () => {
    const w = run(plan(), [[{ type: "cancel", by: HOST }, at(1)]]);
    expect(engine.solve(w.g, w.answers, at(2))).toEqual({ set: [], step: null, need: 0, lights: false });
  });
  it("Gone after Lit keeps lights true", () => {
    const w = run(flare(), [
      [{ type: "answer", member_id: m(2), answer: "yes", rules: [], ember_only: false }, at(1)],
      [{ type: "done", by: HOST }, at(2)],
    ]);
    expect(engine.solve(w.g, w.answers, at(3)).lights).toBe(true);
  });
});
