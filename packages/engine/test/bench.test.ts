// B14 in CI: the worst case solves well inside 5 ms at p99.
import os from "node:os";
import { describe, expect, it } from "vitest";
import { engine } from "../src/index.ts";
import { measure, worstCase } from "./bench/solve-bench.ts";

describe("B14 performance budget", () => {
  it("B14: 12 members × 4 rules × 4 steps solves in ≤ 5 ms (p99)", () => {
    const r = measure(2000);
    // The 5 ms budget is checked on a machine that isn't saturated (CI, or load below the core
    // count). Under heavy local load (nine agents building at once) timing measures the machine,
    // not the solver, so only a loose sanity bound applies (BUG-042).
    const busy = !process.env.CI && (os.loadavg()[0] ?? 0) > os.cpus().length;
    expect(r.p99).toBeLessThanOrEqual(busy ? 50 : 5);
  });
  it("the worst case unravels the whole with-chain to the host", () => {
    const { g, answers, now } = worstCase();
    const s = engine.solve(g, answers, now);
    expect(s.set).toEqual([g.host]);
    expect(s.need).toBe(5);
  });
});
