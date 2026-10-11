// The Touch Grass home (2026 direction, B): golden hour from the sun, the nearest named green
// spot from the pack. Pure functions, no network.
import { describe, expect, it } from "vitest";
import { sunset } from "../../src/lib/map/sun.ts";
import { GOLDEN_MIN, golden } from "../../src/lib/screens/flow/home.ts";

const AT = { lat: 42.3196, lon: -83.2129 };
describe("home", () => {
  it("golden hour: soon, now, then after sunset", () => {
    const day = new Date("2026-10-11T16:00:00Z");
    const set = sunset(AT, day).getTime();
    expect(golden(AT, new Date(set - (GOLDEN_MIN + 47) * 60_000))).toEqual({ kind: "soon", minutes: 47 });
    expect(golden(AT, new Date(set - 20 * 60_000))).toEqual({ kind: "now", minutes: 20 });
    expect(golden(AT, new Date(set + 60_000))).toEqual({ kind: "after" });
  });
});
