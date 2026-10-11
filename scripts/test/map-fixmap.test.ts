import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ALLOW_KEYS,
  canExport,
  change,
  draftFromPhoto,
  keep,
  left,
  NotReviewed,
  noteExport,
  osmExport,
  remove,
  sanitize,
  startReview,
} from "../../apps/web/src/lib/map/fixmap.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const at = { lat: 42.3160312, lon: -83.2370456 };
const seen = new Date("2026-10-11T16:00:00Z");

describe("SRS-MAP-1 allow-list (BR-AI-4)", () => {
  it("is the 13 keys from E17-S1", () => {
    expect(ALLOW_KEYS).toEqual([
      "amenity",
      "backrest",
      "material",
      "seats",
      "wheelchair",
      "fee",
      "access",
      "opening_hours",
      "drinking_water",
      "step_count",
      "handrail",
      "covered",
      "lit",
    ]);
  });
  it("drops keys off the list and bad values", () => {
    const t = sanitize({
      amenity: "bench",
      backrest: "yes",
      name: "Grandpa's bench",
      seats: "three",
      material: "wood",
      inscription: "In memory of",
      wheelchair: "maybe",
      lit: " no ",
    });
    expect(t).toEqual([
      { key: "amenity", value: "bench" },
      { key: "backrest", value: "yes" },
      { key: "material", value: "wood" },
      { key: "lit", value: "no" },
    ]);
    expect(
      sanitize([
        { key: "seats", value: "3" },
        { key: "seats", value: "4" },
      ]),
    ).toEqual([{ key: "seats", value: "3" }]);
    expect(sanitize("amenity=bench")).toEqual([]);
    expect(sanitize(null)).toEqual([]);
  });
});

describe("SRS-MAP-4 photo", () => {
  it("is zeroed after drafting, also when the drafter fails", async () => {
    const photo = new Uint8Array([1, 2, 3, 4]);
    const tags = await draftFromPhoto(photo, async (p) => {
      expect(p[0]).toBe(1); // the drafter sees the photo
      return { amenity: "bench", backrest: "yes" };
    });
    expect(tags).toHaveLength(2);
    expect([...photo]).toEqual([0, 0, 0, 0]);
    const p2 = new Uint8Array([9, 9]);
    expect(await draftFromPhoto(p2, async () => Promise.reject(new Error("hub down")))).toEqual([]);
    expect([...p2]).toEqual([0, 0]);
  });
});

describe("SRS-MAP-2 review", () => {
  const draft = sanitize({ amenity: "bench", backrest: "yes", material: "wood", seats: "3" });
  it("keeps export disabled until every tag is reviewed", () => {
    let r = startReview("bench", at, draft, seen);
    expect(left(r)).toBe(4);
    expect(canExport(r)).toBe(false);
    expect(() => noteExport(r)).toThrow(NotReviewed);
    expect(() => osmExport(r)).toThrow(NotReviewed);
    r = keep(r, "amenity");
    r = keep(r, "backrest");
    r = change(r, "seats", "2");
    expect(left(r)).toBe(1);
    expect(canExport(r)).toBe(false);
    r = remove(r, "material");
    expect(left(r)).toBe(0);
    expect(canExport(r)).toBe(true);
  });
  it("rejects a changed value off the rules", () => {
    const r = startReview("bench", at, draft, seen);
    expect(() => change(r, "seats", "lots")).toThrow(RangeError);
  });
  it("needs at least one surviving tag", () => {
    let r = startReview("bench", at, [{ key: "backrest", value: "yes" }], seen);
    r = remove(r, "backrest");
    expect(canExport(r)).toBe(false);
  });
});

describe("SRS-MAP-3 export", () => {
  let r = startReview("bench", at, sanitize({ amenity: "bench", backrest: "yes", material: "wood", seats: "3" }), seen);
  r = keep(keep(change(remove(r, "material"), "seats", "2"), "amenity"), "backrest");
  it("writes OSM Note text from the copy deck", () => {
    expect(noteExport(r)).toEqual({
      text: "Missing bench here, seen Oct 11, 2026. Suggested tags: amenity=bench, backrest=yes, seats=2. Drafted with Flare and checked by a person on site.",
      lat: 42.316031,
      lon: -83.237046,
    });
  });
  it("writes a .osm file with one new node and escaped values", () => {
    let s = startReview("steps", at, sanitize({ handrail: "yes", opening_hours: "Mo-Fr 08:00-17:00" }), seen);
    s = keep(keep(s, "handrail"), "opening_hours");
    const x = osmExport(s);
    expect(x).toContain('<node id="-1" action="modify" visible="true" lat="42.3160312" lon="-83.2370456">');
    expect(x).toContain('<tag k="highway" v="steps"/>');
    expect(x).toContain('<tag k="handrail" v="yes"/>');
    expect(x).not.toMatch(/photo|jpeg|base64/i);
  });
  it("no map module source contains an openstreetmap.org request", () => {
    // Static proof for SRS-MAP-3: no fetch, XHR, beacon or URL to any openstreetmap.org host
    // anywhere in the map and compass code. ODbL attribution text names the site, not a URL.
    for (const dir of ["apps/web/src/lib/map", "apps/web/src/lib/compass"]) {
      for (const f of fs.readdirSync(path.join(ROOT, dir))) {
        const src = fs.readFileSync(path.join(ROOT, dir, f), "utf8");
        expect(src, f).not.toMatch(/https?:\/\/([\w-]+\.)*openstreetmap\.org/);
      }
    }
  });
});
