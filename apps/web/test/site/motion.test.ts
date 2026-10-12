// Website motion and live pieces: the sunset line from the time zone, the scroll story's
// progress, and the live strip's health check (brief items 1, 3 and 5).
import { describe, expect, it } from "vitest";
import { agoParts, cloudPhotoOffered, fetchHealth } from "../../src/routes/(site)/live.ts";
import { chapterOf, progressOf } from "../../src/routes/(site)/motion.ts";
import { cityOf, placeFor, sunFor } from "../../src/routes/(site)/sunline.ts";
import { ZONES } from "../../src/routes/(site)/zones.ts";

const json =
  (v: unknown, status = 200) =>
  async () =>
    new Response(JSON.stringify(v), { status });

describe("sunset from the time zone, no location", () => {
  it("maps a zone to its city and coordinates", () => {
    expect(placeFor("America/Detroit", ZONES)).toEqual({ lat: 42.3, lon: -83, city: "Detroit" });
    expect(placeFor("Asia/Calcutta", ZONES)?.city).toBe("Kolkata"); // old name some browsers report
    expect(placeFor("America/Indiana/Indianapolis", ZONES)?.city).toBe("Indianapolis");
    expect(placeFor("Etc/UTC", ZONES)).toBeNull();
    expect(placeFor("Detroit", ZONES)).toBeNull(); // no suffix matches
    expect(cityOf("America/Port_of_Spain")).toBe("Port of Spain");
  });
  it("counts minutes to sunset within 2 h, a time before that, tomorrow after it", () => {
    const detroit = { lat: 42.3, lon: -83 };
    // Detroit sunset on 2026-10-11 is about 18:56 EDT (22:56 UTC).
    const soon = sunFor(detroit, new Date("2026-10-11T22:18:00Z"));
    expect(soon?.kind).toBe("soon");
    if (soon?.kind === "soon") expect(soon.min).toBeGreaterThan(30);
    if (soon?.kind === "soon") expect(soon.min).toBeLessThan(45);
    expect(sunFor(detroit, new Date("2026-10-11T15:00:00Z"))?.kind).toBe("later");
    // Final review: after midnight, the next sunset is "today", never "tomorrow" on the same date.
    for (let h = 0; h < 48; h++) {
      const now = new Date(Date.UTC(2026, 9, 11, h, 30));
      const r = sunFor(detroit, now);
      if (r?.kind === "down") expect(r.next.toDateString()).not.toBe(now.toDateString());
    }
    const down = sunFor(detroit, new Date("2026-10-12T01:00:00Z"));
    expect(down?.kind).toBe("down");
    if (down?.kind === "down") expect(down.next.toISOString().slice(0, 10)).toBe("2026-10-12");
  });
  it("returns null in polar night", () => {
    expect(sunFor({ lat: 78.2, lon: 15.6 }, new Date("2026-12-21T12:00:00Z"))).toBeNull();
  });
});

describe("scroll story progress", () => {
  it("is 0 at the top, 1 at the end, clamped, and splits into 4 chapters", () => {
    expect(progressOf(100, 3000, 800)).toBe(0);
    expect(progressOf(-1100, 3000, 800)).toBe(0.5);
    expect(progressOf(-5000, 3000, 800)).toBe(1);
    expect(progressOf(-10, 500, 800)).toBe(1); // shorter than the screen
    expect([0, 0.24, 0.25, 0.6, 0.99, 1].map((p) => chapterOf(p))).toEqual([0, 0, 1, 2, 3, 3]);
  });
});

describe("live strip", () => {
  it("reads health and fails soft", async () => {
    expect(await fetchHealth(json({ ok: true, version: "abc", hub: "absent", db: "ok" }))).toEqual({
      s: "ok",
      ok: true,
      version: "abc",
      hub: "absent",
      db: "ok",
    });
    expect(await fetchHealth(json({}, 503))).toEqual({ s: "down" });
    expect(await fetchHealth(json({ ok: true, hub: "maybe" }))).toEqual({ s: "down" });
    expect(await fetchHealth(async () => Promise.reject(new TypeError("offline")))).toEqual({ s: "down" });
  });
  it("says seconds, then minutes, never negative", () => {
    const now = new Date("2026-10-11T20:00:00Z");
    expect(agoParts(new Date("2026-10-11T19:59:48Z"), now)).toEqual({ s: 12 });
    expect(agoParts(new Date("2026-10-11T19:57:00Z"), now)).toEqual({ m: 3 });
    expect(agoParts(new Date("2026-10-11T20:00:05Z"), now)).toEqual({ s: 0 });
  });
  it("offers cloud photos only when the server says so", async () => {
    expect(await cloudPhotoOffered(json({ cloud_ai: { photo_opt_in: true } }))).toBe(true);
    expect(await cloudPhotoOffered(json({ cloud_ai: { photo_opt_in: "yes" } }))).toBe(false);
    expect(await cloudPhotoOffered(json({}, 500))).toBe(false);
  });
});
