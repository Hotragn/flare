import { describe, expect, it } from "vitest";
import { latency, percentile, toMarkdown } from "../harness/report.ts";
import { same } from "../harness/tasks/conditions.ts";
import { hits, suspectNames } from "../harness/tasks/photo.ts";
import { sameRequest } from "../harness/tasks/rest-loop.ts";

describe("eval harness scoring", () => {
  it("percentiles", () => {
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 50)).toBe(5);
    expect(latency([3000, 1000, 2000]).median_ms).toBe(2000);
  });
  it("conditions compare ignores order and keeps null and error answers strict", () => {
    expect(
      same(
        [
          { type: "after", value: "14:00" },
          { type: "with", value: "Amor" },
        ],
        [
          { type: "with", value: "Amor" },
          { type: "after", value: "14:00" },
        ],
      ),
    ).toBe(true);
    expect(same(null, null)).toBe(true);
    expect(same([], null)).toBe(false);
    expect(same("error:not_in_group", "error:not_in_group")).toBe(true);
  });
  it("suspect names skip sentence starts, sign text and quotes", () => {
    expect(suspectNames("A sign reading 'Scentral Park' by a fence.", ["Scentral", "Park"])).toEqual([]);
    expect(suspectNames("A bench near Lake Erie.", [])).toEqual(["Lake", "Erie"]);
  });
  it("key fact hits are whole words", () => {
    expect(hits("A wooden bench", ["bench"])).toBe(true);
    expect(hits("A benchmark", ["bench"])).toBe(false);
  });
  it("rest requests compare prefer as a set", () => {
    const a = {
      minutes: 30,
      rest_gap_m: null,
      prefer: ["water", "trees"] as ("water" | "trees")[],
      avoid_steps: null,
      mobility_hint: false,
    };
    expect(sameRequest(a, { ...a, prefer: ["trees", "water"] })).toBe(true);
    expect(sameRequest(null, null)).toBe(true);
  });
  it("markdown report marks failed bars", () => {
    const md = toMarkdown({
      task: "t",
      tier: "hub",
      model: "m",
      prompt: "p@1",
      date: "d",
      n: 1,
      bars: [{ name: "b", target: "1", value: "0", pass: false }],
      notes: [],
      items: [],
    });
    expect(md).toContain("| b | 1 | 0 | NO |");
  });
});
