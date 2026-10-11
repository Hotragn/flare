import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MAP_COPY } from "../../apps/web/src/lib/map/copy.ts";
import { endsAfterSunset, natureLine, season } from "../../apps/web/src/lib/map/nature.ts";
import { sunset } from "../../apps/web/src/lib/map/sun.ts";
import { at, fairlane, ORIGIN, POINTS, tinyPack } from "./map-fixtures.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const TZ = "America/Detroit";
const pack = fairlane();
const minutesOff = (a: Date, iso: string) => Math.abs(a.getTime() - Date.parse(iso)) / 60_000;

/**
 * Independent check: the "sunrise equation" (Wikipedia, J2000 form), a different
 * derivation from NOAA's spreadsheet. Agrees with NOAA to about a minute at mid latitudes.
 */
function sunsetEquation(lat: number, lon: number, isoDate: string): Date {
  const r = Math.PI / 180;
  const jd0 = Date.parse(`${isoDate}T12:00:00Z`) / 86_400_000 + 2440587.5;
  const n = Math.round(jd0 - 2451545.0 + 0.0008); // jd0 is noon UTC, so this is the day number
  const jStar = n - lon / 360;
  const M = (357.5291 + 0.98560028 * jStar) % 360;
  const C = 1.9148 * Math.sin(M * r) + 0.02 * Math.sin(2 * M * r) + 0.0003 * Math.sin(3 * M * r);
  const lambda = (M + C + 180 + 102.9372) % 360;
  const jTransit = 2451545.0 + jStar + 0.0053 * Math.sin(M * r) - 0.0069 * Math.sin(2 * lambda * r);
  const decl = Math.asin(Math.sin(lambda * r) * Math.sin(23.4397 * r));
  const cosW = (Math.sin(-0.833 * r) - Math.sin(lat * r) * Math.sin(decl)) / (Math.cos(lat * r) * Math.cos(decl));
  const jSet = jTransit + Math.acos(cosW) / r / 360;
  return new Date((jSet - 2440587.5) * 86_400_000);
}

describe("MP4 sunset (NOAA)", () => {
  it("is 6:57 PM EDT in Dearborn on Oct 11, 2026 (evidence/README.md)", () => {
    const s = sunset(POINTS.mall, new Date("2026-10-11T15:00:00Z"));
    expect(minutesOff(s, "2026-10-11T22:57:00Z")).toBeLessThanOrEqual(1);
  });
  it("agrees with the independent sunrise equation within 1.5 min on 12 dates (its own error is about 1 min)", () => {
    for (let m = 1; m <= 12; m++) {
      const day = `2026-${String(m).padStart(2, "0")}-11`;
      const ours = sunset(POINTS.mall, new Date(`${day}T16:00:00Z`));
      const ref = sunsetEquation(POINTS.mall.lat, POINTS.mall.lon, day);
      expect(minutesOff(ours, ref.toISOString()), day).toBeLessThanOrEqual(1.5);
    }
  });
  it("picks the local day, not the UTC day", () => {
    // 11:30 PM EDT Oct 11 is already Oct 12 in UTC.
    const s = sunset(POINTS.mall, new Date("2026-10-12T03:30:00Z"));
    expect(minutesOff(s, "2026-10-11T22:57:00Z")).toBeLessThanOrEqual(1);
  });
  it("returns an Invalid Date when the sun does not set", () => {
    expect(Number.isNaN(sunset({ lat: 78.2, lon: 15.6 }, new Date("2026-06-21T12:00:00Z")).getTime())).toBe(true);
  });
});

describe("SRS-NAT-1 natureLine", () => {
  it("shows the sunset within 3 hours of it", () => {
    expect(natureLine(pack, POINTS.lake, new Date("2026-10-11T21:00:00Z"), TZ)).toBe("Sunset 6:57 PM");
  });
  it("else a named natural feature within 200 m", () => {
    expect(natureLine(pack, POINTS.lake, new Date("2026-10-11T15:00:00Z"), TZ)).toBe("By Fair Lane Lake");
  });
  it("else the season", () => {
    expect(natureLine(pack, POINTS.mall, new Date("2026-10-11T15:00:00Z"), TZ)).toBe("Week 3 of fall");
    const t = tinyPack([{ kind: "water", p: at(0, 201), tags: { name: "Far Pond" } }]);
    expect(natureLine(t, ORIGIN, new Date("2026-10-11T15:00:00Z"), TZ)).toBe("Week 3 of fall");
  });
  it("only uses words from the copy deck plus real names and times", () => {
    const line = natureLine(pack, POINTS.green, new Date("2026-10-11T15:00:00Z"), TZ);
    expect(line).toMatch(/^(By .+|Sunset \d{1,2}:\d\d [AP]M|Week \d+ of (spring|summer|fall|winter))$/);
  });
});

describe("season", () => {
  it("knows the astronomical seasons and flips south of the equator", () => {
    expect(season(new Date("2026-09-22T16:00:00Z"), TZ, 42)).toEqual({ season: "fall", week: 1 });
    expect(season(new Date("2026-01-05T16:00:00Z"), TZ, 42)).toEqual({ season: "winter", week: 3 });
    expect(season(new Date("2026-07-01T16:00:00Z"), TZ, 42).season).toBe("summer");
    expect(season(new Date("2026-07-01T16:00:00Z"), "Australia/Sydney", -33.9).season).toBe("winter");
  });
});

describe("BR-P-9 endsAfterSunset", () => {
  it("flags steps that end after sunset", () => {
    expect(endsAfterSunset(POINTS.mall, new Date("2026-10-11T23:10:00Z"))).toBe(true);
    expect(endsAfterSunset(POINTS.mall, new Date("2026-10-11T22:30:00Z"))).toBe(false);
  });
});

describe("map copy matches the deck", () => {
  it("every MAP_COPY value equals design/prototype/src/lib/copy/deck.json", () => {
    const deck = JSON.parse(fs.readFileSync(path.join(ROOT, "design/prototype/src/lib/copy/deck.json"), "utf8"));
    for (const [k, v] of Object.entries(MAP_COPY)) expect(deck.strings[k]?.text, k).toBe(v);
  });
});
