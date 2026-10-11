import { describe, expect, it } from "vitest";
import { distanceM } from "../../apps/web/src/lib/map/geo.ts";
import {
  accessLine,
  checkNeeds,
  emberCandidates,
  failedNeeds,
  nameSpot,
  placeWords,
  walkMinutes,
} from "../../apps/web/src/lib/map/places.ts";
import { at, fairlane, ORIGIN, POINTS, tinyPack } from "./map-fixtures.ts";

const pack = fairlane();
const none = { avoid_steps: false, rest_gap_m: null, restroom_300m: false } as const;

describe("SRS-CRE-3 nameSpot", () => {
  it("names five Fairlane points from the pack", () => {
    expect(nameSpot(pack, POINTS.wagner)?.name).toBe("Wagner Park");
    expect(nameSpot(pack, POINTS.lake)?.name).toBe("Fair Lane Lake");
    expect(nameSpot(pack, POINTS.green)?.name).toBe("Village Green");
    // No named feature within 150 m: falls back to the street.
    expect(nameSpot(pack, POINTS.mall)?.name).toBe("Town Center Drive");
    expect(nameSpot(pack, POINTS.resid)?.name).toBe("Rotunda Drive");
  });
  it("never puts coordinates in the name, and keys by OSM id", () => {
    for (const p of Object.values(POINTS)) {
      const r = nameSpot(pack, p);
      expect(r?.name).not.toMatch(/\d+\.\d{3}/);
      expect(r?.key).toMatch(/^[nwr]\d+$/);
    }
  });
  it("prefers a named feature within 150 m over a nearer street", () => {
    const t = tinyPack([
      { kind: "street", p: at(0, 10), tags: { name: "Elm St" } },
      { kind: "park", p: at(90, 140), tags: { name: "Oak Park" } },
    ]);
    expect(nameSpot(t, ORIGIN)?.name).toBe("Oak Park");
  });
  it("uses the street when the named feature is past 150 m", () => {
    const t = tinyPack([
      { kind: "street", p: at(0, 200), tags: { name: "Elm St" } },
      { kind: "park", p: at(90, 160), tags: { name: "Oak Park" } },
    ]);
    expect(nameSpot(t, ORIGIN)?.name).toBe("Elm St");
  });
  it("returns null with nothing named nearby", () => {
    expect(nameSpot(tinyPack([{ kind: "bench", p: at(0, 5) }]), ORIGIN)).toBeNull();
  });
});

describe("BR-E-1 emberCandidates", () => {
  it("returns benches and picnic tables within 400 m, nearest first, at most 12", () => {
    for (const p of Object.values(POINTS)) {
      const c = emberCandidates(pack, p);
      expect(c.length).toBeLessThanOrEqual(12);
      const d = c.map((x) => distanceM(p, x));
      expect(d).toEqual([...d].sort((a, b) => a - b));
      for (const x of c) {
        expect(["bench", "picnic_table"]).toContain(x.kind);
        expect(distanceM(p, x)).toBeLessThanOrEqual(400);
      }
    }
    expect(emberCandidates(pack, POINTS.wagner)).toHaveLength(12);
    expect(emberCandidates(pack, POINTS.resid)).toHaveLength(0);
  });
  it("includes picnic tables and drops private seats", () => {
    const t = tinyPack([
      { kind: "picnic_table", p: at(0, 50) },
      { kind: "bench", p: at(0, 20), tags: { access: "private" } },
      { kind: "bench", p: at(0, 399) },
      { kind: "bench", p: at(0, 401) },
    ]);
    expect(emberCandidates(t, ORIGIN).map((x) => x.osm_id)).toEqual(["n1", "n3"]);
  });
});

describe("BR-C-7 walkMinutes", () => {
  it("is straight-line distance × 1.3 at 4.8 km/h", () => {
    expect(walkMinutes(ORIGIN, at(45, 800))).toBeCloseTo(13, 6); // 800 m × 1.3 / 80 m/min
    expect(walkMinutes(ORIGIN, ORIGIN)).toBe(0);
  });
});

describe("SRS-ACC-2 accessLine", () => {
  it("matches the pack at Fairlane points", () => {
    expect(accessLine(pack, POINTS.wagner)).toEqual({
      benches: { count: 12, nearest_m: 139 },
      restrooms: { count: 0, nearest_m: null },
      water: { count: 1, nearest_m: 138 },
      steps_mapped: true,
    });
    expect(accessLine(pack, POINTS.mall).restrooms).toEqual({ count: 1, nearest_m: 72 });
  });
  it("counts within 200 m only and reports BR-A-4 steps within 50 m", () => {
    const t = tinyPack([
      { kind: "bench", p: at(0, 30) },
      { kind: "bench", p: at(0, 199) },
      { kind: "bench", p: at(0, 205) },
      { kind: "toilets", p: at(90, 150) },
      { kind: "toilets", p: at(90, 100), tags: { access: "private" } },
      { kind: "drinking_water", p: at(180, 10) },
      { kind: "steps", p: at(270, 60) },
    ]);
    expect(accessLine(t, ORIGIN)).toEqual({
      benches: { count: 2, nearest_m: 30 },
      restrooms: { count: 1, nearest_m: 150 },
      water: { count: 1, nearest_m: 10 },
      steps_mapped: false,
    });
  });
});

describe("BR-A-2 checkNeeds (SRS-ACC-6, SRS-PLAN-6)", () => {
  const spot = ORIGIN;
  it("passes with no needs set", () => {
    expect(checkNeeds(tinyPack([]), none, null, spot)).toBe(true);
  });
  it("avoid steps: fails with steps within 50 m of the spot", () => {
    const n = { ...none, avoid_steps: true };
    expect(failedNeeds(tinyPack([{ kind: "steps", p: at(10, 49) }]), n, null, spot)).toEqual(["steps"]);
    expect(checkNeeds(tinyPack([{ kind: "steps", p: at(10, 51) }]), n, null, spot)).toBe(true);
  });
  it("avoid steps: fails with steps within 20 m of the straight line from the person", () => {
    const n = { ...none, avoid_steps: true };
    const from = at(0, 500); // person 500 m north
    const onLine = at(0, 250);
    const besideLine = { lat: onLine.lat, lon: onLine.lon + 19 / (111_320 * Math.cos((onLine.lat * Math.PI) / 180)) };
    const farFromLine = { lat: onLine.lat, lon: onLine.lon + 25 / (111_320 * Math.cos((onLine.lat * Math.PI) / 180)) };
    expect(checkNeeds(tinyPack([{ kind: "steps", p: besideLine }]), n, from, spot)).toBe(false);
    expect(checkNeeds(tinyPack([{ kind: "steps", p: farFromLine }]), n, from, spot)).toBe(true);
    // Without the person's position only the spot clause applies.
    expect(checkNeeds(tinyPack([{ kind: "steps", p: besideLine }]), n, null, spot)).toBe(true);
  });
  it("restroom: fails when no toilets within 300 m", () => {
    const n = { ...none, restroom_300m: true };
    expect(checkNeeds(tinyPack([{ kind: "toilets", p: at(0, 299) }]), n, null, spot)).toBe(true);
    expect(failedNeeds(tinyPack([{ kind: "toilets", p: at(0, 301) }]), n, null, spot)).toEqual(["restroom"]);
  });
  it("rest distance: fails when the nearest bench is farther than the limit", () => {
    for (const gap of [100, 200, 400] as const) {
      const n = { ...none, rest_gap_m: gap };
      expect(checkNeeds(tinyPack([{ kind: "bench", p: at(0, gap - 1) }]), n, null, spot)).toBe(true);
      expect(checkNeeds(tinyPack([{ kind: "picnic_table", p: at(0, gap - 1) }]), n, null, spot)).toBe(true);
      expect(failedNeeds(tinyPack([{ kind: "bench", p: at(0, gap + 1) }]), n, null, spot)).toEqual(["rest"]);
    }
  });
  it("is deterministic and reports every failed clause", () => {
    const n = { avoid_steps: true, rest_gap_m: 100, restroom_300m: true } as const;
    const t = tinyPack([{ kind: "steps", p: at(0, 5) }]);
    expect(failedNeeds(t, n, null, spot)).toEqual(["steps", "rest", "restroom"]);
    expect(failedNeeds(t, n, null, spot)).toEqual(failedNeeds(t, n, null, spot));
  });
  it("works on the Fairlane pack", () => {
    const n = { avoid_steps: true, rest_gap_m: 200, restroom_300m: true } as const;
    expect(failedNeeds(pack, n, null, POINTS.wagner)).toEqual(["steps", "restroom"]);
    expect(failedNeeds(pack, n, null, POINTS.green)).toEqual([]);
  });
});

describe("ADR-0007 placeWords", () => {
  it("leads with the spot name and has no duplicates", () => {
    const w = placeWords(pack, POINTS.lake);
    expect(w[0]).toBe("Fair Lane Lake");
    expect(new Set(w.map((x) => x.toLowerCase())).size).toBe(w.length);
    expect(w.length).toBeLessThanOrEqual(8);
    expect(w).toContain("bench");
  });
});
