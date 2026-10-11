// CE6: view() per state (E1-S4 AC3, SRS-SOL-3).
import { describe, expect, it } from "vitest";
import { engine } from "../src/index.ts";
import { at, atMs, D, flare, HOST, plan, run, yes } from "./helpers.ts";

describe("CE6 view", () => {
  it("Flare Kindling: need and Ember time", () => {
    const w = run(flare({ quorum: 4 }), [[yes(1), at(2)]]);
    expect(engine.view(w.g, w.answers, at(3))).toEqual({ need: 2, next_change_at: at(30) });
  });
  it("Flare Ember before the pick: need with quorum 2, pick time", () => {
    const w = run(flare({ quorum: 4, candidates: ["c1"] }), [[{ type: "timer", job: "ember" }, at(30)]]);
    expect(engine.view(w.g, w.answers, at(30.5))).toEqual({ need: 1, next_change_at: at(31) });
  });
  it("Flare Ember after the pick: end of Ember", () => {
    const w = run(flare({ quorum: 4 }), [[{ type: "timer", job: "ember" }, at(30)]]);
    expect(engine.view(w.g, w.answers, at(30.5))).toEqual({ need: 1, next_change_at: at(60) });
  });
  it("Flare Ember entered late: pick time never passes the end of Ember", () => {
    const w = run(flare({ quorum: 4, candidates: ["c1"] }), [[{ type: "timer", job: "ember" }, atMs(59.5 * 60_000)]]);
    expect(engine.view(w.g, w.answers, at(59.6)).next_change_at).toBe(at(60));
  });
  it("Flare Lit: need 0, t0 + 4 h", () => {
    const w = run(flare(), [[yes(1), at(2)]]);
    expect(engine.view(w.g, w.answers, at(3))).toEqual({ need: 0, next_change_at: at(240) });
  });
  it("Gone: need 0, no next change", () => {
    const w = run(flare(), [[{ type: "cancel", by: HOST }, at(2)]]);
    expect(engine.view(w.g, w.answers, at(3))).toEqual({ need: 0, next_change_at: null });
  });
  it("Plan Kindling: next change at D", () => {
    expect(engine.view(plan(), [], at(1))).toEqual({ need: 2, next_change_at: D });
  });
  it("Plan Lit: S + step minutes + 60", () => {
    const w = run(plan(), [
      [yes(1), at(2)],
      [yes(2), at(2)],
      [{ type: "timer", job: "plan_deadline" }, D],
    ]);
    expect(engine.view(w.g, w.answers, at(70))).toEqual({ need: 0, next_change_at: at(120 + 90 + 60) });
  });
});
