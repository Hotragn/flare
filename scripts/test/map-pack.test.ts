import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { distanceM } from "../../apps/web/src/lib/map/geo.ts";
import { extraQuery, type OverpassResult, pinnedQuery, runQuery } from "../../apps/web/src/lib/map/overpass.ts";
import {
  buildPack,
  countByKind,
  isFresh,
  isNatureWater,
  PackError,
  places,
  samplePolyline,
  validatePack,
} from "../../apps/web/src/lib/map/pack.ts";
import { sizes } from "../build-map-pack.ts";
import { fairlane, ORIGIN } from "./map-fixtures.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const pack = fairlane();

describe("SRS-OFF-5 Fairlane pack", () => {
  it("is valid v2 with ODbL attribution", () => {
    expect(validatePack(pack).v).toBe(2);
    expect(pack.attribution).toContain("ODbL");
    expect(pack.center).toEqual([42.3169092, -83.2229394]);
    expect(pack.radius_m).toBe(3000);
  });
  it("matches the analyst's pinned counts (evidence/README.md)", () => {
    const c = countByKind(pack);
    expect([c.bench, c.picnic_table, c.toilets, c.drinking_water, c.park, c.steps]).toEqual([54, 7, 7, 3, 32, 28]);
  });
  it("uses the analyst's pinned query statements", () => {
    const pinned = fs.readFileSync(path.join(ROOT, "docs/requirements/evidence/fairlane-pinned.overpassql"), "utf8");
    const ours = pinnedQuery({ lat: 42.3169092, lon: -83.2229394, radius_m: 3000 });
    for (const line of ours.split("\n").filter((l) => l.includes("nwr("))) expect(pinned).toContain(line.trim());
  });
  it("records its OSM timestamp (SRS-IF-4)", () => {
    expect(Date.parse(pack.osm_base)).not.toBeNaN();
  });
  it("has named streets, named water and no sewer tanks", () => {
    const ps = places(pack);
    expect(ps.some((p) => p.kind === "street" && p.name === "Michigan Avenue")).toBe(true);
    expect(ps.some((p) => p.kind === "water" && p.name === "Fair Lane Lake")).toBe(true);
    expect(ps.some((p) => p.kind === "water" && /CSO/.test(p.name ?? ""))).toBe(false);
  });
  it("is 40 KB or less brotli (target 10 KB; streets every 25 m set the floor, docs/maps/02-pack-format.md)", () => {
    const s = sizes(JSON.stringify(pack));
    expect(s.brotli).toBeLessThanOrEqual(40 * 1024);
  });
});

const base = "2026-10-10T17:07:36Z";
const pinned = (elements: OverpassResult["elements"]): OverpassResult => ({
  osm3s: { timestamp_osm_base: base },
  elements,
});

describe("buildPack", () => {
  const now = new Date("2026-10-11T00:00:00Z");
  it("refuses data older than 7 days (SRS-IF-4)", () => {
    expect(() =>
      buildPack({
        area: "t",
        center: [42.3, -83.2],
        radius_m: 3000,
        pinned: pinned([]),
        extra: { elements: [] },
        now: new Date("2026-10-18T00:00:00Z"),
      }),
    ).toThrow(PackError);
    expect(() =>
      buildPack({
        area: "t",
        center: [42.3, -83.2],
        radius_m: 3000,
        pinned: { elements: [] },
        extra: { elements: [] },
        now,
      }),
    ).toThrow(/timestamp_osm_base/);
  });
  it("turns streets into points every 25 m and keeps only the name", () => {
    const p = buildPack({
      area: "t",
      center: [ORIGIN.lat, ORIGIN.lon],
      radius_m: 3000,
      now,
      pinned: pinned([
        { type: "node", id: 1, lat: 42.3, lon: -83.2, tags: { amenity: "bench", backrest: "yes", material: "wood" } },
      ]),
      extra: {
        elements: [
          {
            type: "way",
            id: 9,
            tags: { highway: "residential", name: "Elm St", surface: "asphalt" },
            geometry: [
              { lat: 42.3, lon: -83.2 },
              { lat: 42.3009, lon: -83.2 },
            ],
          },
          {
            type: "way",
            id: 10,
            tags: { highway: "service", name: "Lot Aisle" },
            geometry: [
              { lat: 42.3, lon: -83.2 },
              { lat: 42.301, lon: -83.2 },
            ],
          },
          {
            type: "way",
            id: 11,
            tags: { natural: "water", water: "wastewater", name: "CSO Tank" },
            geometry: [{ lat: 42.3, lon: -83.2 }],
          },
        ],
      },
    });
    const ps = places(p);
    expect(ps[0]).toMatchObject({ kind: "bench", tags: { backrest: "yes" } });
    expect(ps[0]?.tags.material).toBeUndefined();
    const streets = ps.filter((x) => x.kind === "street");
    expect(streets.length).toBe(5); // 100 m: 0, 25, 50, 75, 100
    expect(streets.every((x) => x.name === "Elm St" && x.tags.surface === undefined)).toBe(true);
    expect(ps.some((x) => x.name === "Lot Aisle" || x.name === "CSO Tank")).toBe(false);
  });
  it("is deterministic", () => {
    const input = {
      area: "t",
      center: [42.3, -83.2] as [number, number],
      radius_m: 3000,
      now,
      pinned: pinned([]),
      extra: { elements: [] },
    };
    expect(JSON.stringify(buildPack(input))).toBe(JSON.stringify(buildPack(input)));
  });
});

describe("samplePolyline", () => {
  it("spaces points by the step", () => {
    const pts = samplePolyline([ORIGIN, { lat: ORIGIN.lat + 0.0018, lon: ORIGIN.lon }], 25);
    expect(pts.length).toBe(9); // 200 m: 0, 25, ..., 200
    pts.slice(1).forEach((p, i) => {
      expect(distanceM(pts[i] ?? p, p)).toBeCloseTo(25, 0);
    });
  });
});

describe("isNatureWater", () => {
  it("drops wastewater, covered and tank names", () => {
    expect(isNatureWater({ name: "Fair Lane Lake", natural: "water" })).toBe(true);
    expect(isNatureWater({ name: "Adandoned CSO Tank", natural: "water" })).toBe(false);
    expect(isNatureWater({ name: "X", natural: "water", covered: "yes" })).toBe(false);
  });
});

describe("validatePack and isFresh", () => {
  it("rejects bad packs", () => {
    expect(() => validatePack({ ...pack, v: 1 })).toThrow(/version/);
    expect(() => validatePack({ ...pack, attribution: "" })).toThrow(/ODbL/);
    expect(() => validatePack({ ...pack, items: [["z", 1, 2, "n1", 0]] })).toThrow(/malformed/);
  });
  it("is fresh for 7 days", () => {
    const t = Date.parse(pack.osm_base);
    expect(isFresh(pack, new Date(t + 6 * 86_400_000))).toBe(true);
    expect(isFresh(pack, new Date(t + 8 * 86_400_000))).toBe(false);
  });
});

describe("Overpass client", () => {
  it("queries overpass-api.de only, with User-Agent, retrying when busy (BUG-004)", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    let n = 0;
    const fake = async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      n++;
      return n < 3
        ? new Response("busy", { status: 429 })
        : new Response(JSON.stringify({ osm3s: { timestamp_osm_base: base }, elements: [] }), { status: 200 });
    };
    const r = await runQuery(extraQuery({ lat: 1, lon: 2, radius_m: 3 }), {
      fetch: fake,
      userAgent: "UA",
      sleep: async () => {},
    });
    expect(r.elements).toEqual([]);
    expect(calls).toHaveLength(3);
    for (const c of calls) {
      expect(new URL(c.url).host).toBe("overpass-api.de");
      expect((c.init.headers as Record<string, string>)["user-agent"]).toBe("UA");
    }
  });
  it("does not retry other errors", async () => {
    let n = 0;
    const fake = async () => {
      n++;
      return new Response("bad", { status: 400 });
    };
    await expect(runQuery("x", { fetch: fake, sleep: async () => {} })).rejects.toThrow(/400/);
    expect(n).toBe(1);
  });
});
