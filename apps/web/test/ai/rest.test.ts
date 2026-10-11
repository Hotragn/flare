// OD5 rest-loop request parser (SRS-REST-1, E16-S1 AC1).
import { describe, expect, it } from "vitest";
import { countWords } from "../../src/lib/conditions/index.ts";
import { parseRest, restReadBack } from "../../src/lib/conditions/rest.ts";

const ok = (text: string, needs: Parameters<typeof parseRest>[1] = null) => {
  const r = parseRest(text, needs);
  if (!r.ok) throw new Error(`didn't parse: ${text}`);
  return r.request;
};

describe("SRS-REST-1 request to constraints", () => {
  it("E16-S1 AC1: the backlog example", () => {
    const r = ok("Knee's bad, 40 minutes, want trees");
    expect(r).toEqual({ minutes: 40, restGapM: 200, prefer: ["trees"], avoidSteps: false });
    expect(restReadBack(r).line).toBe("Got it: 40 min, a bench every 200 m, under trees. Right?");
  });

  it("rest gap and steps come from the needs profile (BR-A-1)", () => {
    const r = ok("half an hour by the pond", { avoidSteps: true, maxRestGap: 100, restroomNear: true });
    expect(r).toEqual({ minutes: 30, restGapM: 100, prefer: ["water", "restrooms"], avoidSteps: true });
  });

  it("explicit gap snaps down to 100, 200 or 400 m and isn't read as minutes", () => {
    expect(ok("an hour, bench every 150 m")).toMatchObject({ minutes: 60, restGapM: 100 });
    expect(ok("sit every 350 meters, 20 min")).toMatchObject({ minutes: 20, restGapM: 200 });
  });

  it("hours, word numbers, limits and no-steps words", () => {
    expect(ok("1.5 hours").minutes).toBe(90);
    expect(ok("thirty min loop").minutes).toBe(30);
    expect(ok("5 minutes").minutes).toBe(10);
    expect(ok("no stairs please")).toMatchObject({ avoidSteps: true, minutes: 30 });
    expect(ok("I use a walker")).toMatchObject({ avoidSteps: true });
  });

  it("nothing usable is refused", () => {
    expect(parseRest("hello")).toEqual({ ok: false });
    expect(parseRest("")).toEqual({ ok: false });
  });

  it("read-back stays at most 12 words with everything set; chips list all", () => {
    const r = restReadBack({ minutes: 90, restGapM: 100, prefer: ["trees", "water"], avoidSteps: true });
    expect(countWords(r.line)).toBeLessThanOrEqual(12);
    expect(r.line).toBe("Got it: 90 min, a bench every 100 m, no steps. Right?");
    expect(r.chips).toEqual(["90 min", "a bench every 100 m", "under trees", "by water", "no steps"]);
  });
});
