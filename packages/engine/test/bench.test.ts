// B14 in CI: the worst case solves well inside 5 ms at p99.
import { describe, expect, it } from "vitest";
import { engine } from "../src/index.ts";
import { measure, worstCase } from "./bench/solve-bench.ts";

describe("B14 performance budget", () => {
  it("B14: 12 members × 4 rules × 4 steps solves in ≤ 5 ms (p99)", () => {
    const r = measure(2000);
    expect(r.p99).toBeLessThanOrEqual(5);
  });
  it("the worst case unravels the whole with-chain to the host", () => {
    const { g, answers, now } = worstCase();
    const s = engine.solve(g, answers, now);
    expect(s.set).toEqual([g.host]);
    expect(s.need).toBe(5);
  });
});
