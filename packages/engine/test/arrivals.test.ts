// CE5: arrivals and headcount (BR-H-1 to BR-H-5) and the spark ticket effect (BR-K-1).
import type { EngineEvent } from "@flare/shared/icd/engine";
import { describe, expect, it } from "vitest";
import { engine, yesCount } from "../src/index.ts";
import { at, effects, expectError, flare, HOST, m, run, step, yes } from "./helpers.ts";

const self = (n: number, when: string): EngineEvent => ({
  type: "arrival",
  by: m(n),
  who: { for: "self" },
  recorded_at: when,
});
const plusOne = (n: number, when: string): EngineEvent => ({
  type: "arrival",
  by: HOST,
  who: { for: "member", member_id: m(n) },
  recorded_at: when,
});
const someone = (when: string): EngineEvent => ({
  type: "arrival",
  by: HOST,
  who: { for: "someone_else" },
  recorded_at: when,
});

const lit = () => run(flare(), [[yes(1), at(1)]]);

describe("CE5 arrivals", () => {
  it("BR-H-1 BR-K-1: I'm here adds 1 and issues a spark ticket", () => {
    const w = step(lit(), self(1, at(10)), at(10));
    expect(w.g.headcount).toBe(2);
    expect(w.answers[0]?.arrived_at).toBe(at(10));
    expect(effects(w.last)).toEqual([{ type: "spark_ticket", member_id: m(1) }, { type: "sse" }]);
  });
  it("BR-H-3: a self tap and a host +1 for the same member count once", () => {
    let w = step(lit(), self(1, at(10)), at(10));
    w = step(w, plusOne(1, at(11)), at(11));
    expect(w.g.headcount).toBe(2);
    expect(effects(w.last)).toEqual([]);
    let v = step(lit(), plusOne(1, at(10)), at(10));
    v = step(v, self(1, at(11)), at(11));
    expect(v.g.headcount).toBe(2);
    expect(v.answers[0]?.arrived_at).toBe(at(10));
  });
  it("BR-H-3: anonymous host +1s are separate", () => {
    let w = step(lit(), self(1, at(10)), at(10));
    w = step(w, someone(at(11)), at(11));
    expect(w.g.headcount).toBe(3);
    expect(effects(w.last)).toEqual([{ type: "sse" }]);
  });
  it("BR-H-4: headcount is capped at yes-count + 3", () => {
    let w = lit(); // yes-count 2, cap 5
    expect(yesCount(w.g, w.answers)).toBe(2);
    for (let i = 0; i < 6; i++) w = step(w, someone(at(10 + i)), at(10 + i));
    expect(w.g.headcount).toBe(5);
    const r = step(w, self(1, at(20)), at(20));
    expect(r.g.headcount).toBe(5);
    expect(r.answers[0]?.arrived_at).toBeNull();
    expect(effects(r.last)).toEqual([]);
  });
  it("BR-H-5: an outbox arrival recorded inside the Lit window counts; before Lit it is ignored", () => {
    const ok = step(lit(), self(1, at(5)), at(30));
    expect(ok.g.headcount).toBe(2);
    expect(ok.answers[0]?.arrived_at).toBe(at(5));
    const early = step(lit(), self(1, at(0.5)), at(30));
    expect(early.g.headcount).toBe(1);
    expect(effects(early.last)).toEqual([]);
  });
  it("BR-H-5: a recorded time in the future is clamped to now", () => {
    const w = step(lit(), self(1, at(50)), at(30));
    expect(w.answers[0]?.arrived_at).toBe(at(30));
  });
  it("BR-H-5: arrivals only while Lit", () => {
    expectError(engine.transition(flare(), [], self(1, at(1)), at(1)), "wrong_state");
  });
  it("BR-H-1: the host's own I'm here issues a ticket but the host is already the 1", () => {
    let w = step(lit(), { type: "arrival", by: HOST, who: { for: "self" }, recorded_at: at(10) }, at(10));
    expect(w.g.headcount).toBe(1);
    expect(effects(w.last)).toEqual([{ type: "spark_ticket", member_id: HOST }]);
    w = step(w, { type: "arrival", by: HOST, who: { for: "member", member_id: HOST }, recorded_at: at(11) }, at(11));
    expect(effects(w.last)).toEqual([]);
  });
  it("only the host taps +1", () => {
    const w = lit();
    expectError(
      engine.transition(
        w.g,
        w.answers,
        { type: "arrival", by: m(1), who: { for: "someone_else" }, recorded_at: at(5) },
        at(5),
      ),
      "not_host",
    );
    expectError(
      engine.transition(
        w.g,
        w.answers,
        { type: "arrival", by: m(1), who: { for: "member", member_id: m(1) }, recorded_at: at(5) },
        at(5),
      ),
      "not_host",
    );
  });
  it("+1 for a member with no answer record is unknown_member", () => {
    const w = lit();
    expectError(engine.transition(w.g, w.answers, plusOne(7, at(5)), at(5)), "unknown_member");
    expectError(engine.transition(w.g, w.answers, self(7, at(5)), at(5)), "unknown_member");
  });
  it("can't make it, then I'm here anyway, still counts", () => {
    let w = step(
      lit(),
      { type: "answer", member_id: m(1), answer: "cant_make_it", rules: [], ember_only: false },
      at(5),
    );
    w = step(w, self(1, at(6)), at(6));
    expect(w.g.headcount).toBe(2);
  });
});
