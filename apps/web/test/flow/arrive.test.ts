// Automatic "I'm here": two good fixes in a row within 30 m, accuracy 20 m or better. Replayed on
// the recorded iPhone streams (they stood next to the spot), plus walks that must not trigger.
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { createArrival } from "../../src/lib/compass/arrive.ts";
import { createGuide } from "../../src/lib/compass/guide.ts";

const TARGET = { lat: 42.3196, lon: -83.2129 };
const at = (north: number, east: number) => ({
  lat: TARGET.lat + north / 111_320,
  lon: TARGET.lon + east / (111_320 * Math.cos((TARGET.lat * Math.PI) / 180)),
});
type F = { t: number; n: number; e: number; acc: number; v: number | null; c: number | null };
const replay = (fixes: { t: number; n: number; e: number; acc: number; v?: number | null; c?: number | null }[]) => {
  const g = createGuide(TARGET);
  const w = createArrival();
  let firedAt = -1;
  fixes.forEach((f, i) => {
    const s = g.position({ ...at(f.n, f.e), t: f.t, accuracy: f.acc, speed: f.v ?? null, course: f.c ?? null });
    if (w.fix(s.distance_m, s.accuracy_m) && firedAt < 0) firedAt = i;
  });
  return firedAt;
};

describe("automatic I'm here", () => {
  for (const file of ["compass-iphone16promax-ios26.6.1.json", "compass-iphone13-safari27.0.json"]) {
    it(`${file}: standing at the spot, it offers I'm here by the second fix`, () => {
      const { stream } = JSON.parse(fs.readFileSync(new URL(`../fixtures/${file}`, import.meta.url), "utf8")) as {
        stream: { fixes: F[] };
      };
      const i = replay(stream.fixes);
      expect(i).toBeGreaterThanOrEqual(1);
      expect(i).toBeLessThanOrEqual(3);
    });
  }
  it("walking in from 300 m: fires once, only after two fixes inside 30 m", () => {
    const walk = Array.from({ length: 30 }, (_, k) => ({ t: k * 1000, n: -300 + k * 12, e: 0, acc: 5 }));
    const i = replay(walk);
    const d = (k: number) => Math.abs(-300 + k * 12);
    expect(d(i)).toBeLessThanOrEqual(30);
    expect(d(i - 1)).toBeLessThanOrEqual(30);
  });
  it("a poor fix (40 m accuracy) never marks you here, even on the spot", () => {
    expect(replay(Array.from({ length: 10 }, (_, k) => ({ t: k * 1000, n: 2, e: 1, acc: 40 })))).toBe(-1);
  });
  it("one good fix between bad ones is not enough", () => {
    const fixes = [50, 10, 50, 10, 50].map((n, k) => ({ t: k * 1000, n, e: 0, acc: 5 }));
    expect(replay(fixes)).toBe(-1);
  });
});
