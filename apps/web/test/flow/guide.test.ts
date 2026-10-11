// Compass guide replays (device check, iPhone 16 Pro Max, iOS 26.6.1). The device report held
// summary stats, not raw streams, so these streams are generated to match them: headings at
// 50 Hz with about 14° of noise, GPS fixes once a second at 2.5 to 3 m. The check page now
// records raw streams (relative metres only), so the next run can be replayed as is.
import { describe, expect, it } from "vitest";
import { angleDiff, createGuide, type Fix, unwrapAngle } from "../../src/lib/compass/guide.ts";

// Deterministic noise.
function rng(seed: number) {
  let x = seed;
  return () => {
    x = (x * 1664525 + 1013904223) % 2 ** 32;
    return x / 2 ** 32;
  };
}
const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());

const TARGET = { lat: 42.3196, lon: -83.2129 };
/** A point `north` and `east` metres from the target. */
const at = (north: number, east: number) => ({
  lat: TARGET.lat + north / 111_320,
  lon: TARGET.lon + east / (111_320 * Math.cos((TARGET.lat * Math.PI) / 180)),
});

describe("compass guide replay", () => {
  it("standing still, noisy heading around north: steady, no spin through 0/360", () => {
    const g = createGuide(TARGET);
    const r = rng(1);
    g.position({ ...at(30, 0), t: 0, accuracy: 3, speed: 0 }); // 30 m north of the target
    const seen: number[] = [];
    for (let i = 0; i < 500; i++) {
      const s = g.orientation({ t: i * 20, heading: (360 + 180 + 14 * gauss(r)) % 360, accuracy: 14, beta: 10 });
      if (i > 50) seen.push(s.heading as number);
    }
    // The person faces south (180), toward the target: steady within a few degrees.
    const worst = Math.max(...seen.map((h) => Math.abs(angleDiff(180, h))));
    expect(worst).toBeLessThan(8);
    expect(g.state().facing).toBe(true);
    // Around north the raw values wrap 350..10; the smoothed heading stays near 0, never near 180.
    const n = createGuide(TARGET);
    for (let i = 0; i < 300; i++) n.orientation({ t: i * 20, heading: (360 + 14 * gauss(r)) % 360, accuracy: 14 });
    expect(Math.abs(angleDiff(0, n.state().heading as number))).toBeLessThan(8);
  });

  it("facing locks at 15° and lets go only past 25° (a shaky hand doesn't flicker it)", () => {
    const g = createGuide(TARGET);
    g.position({ ...at(30, 0), t: 0, accuracy: 3 });
    let flips = 0;
    let was = false;
    for (let i = 0; i < 400; i++) {
      // Wobbling between 160° and 200° (rel -20..+20) after first pointing straight at it.
      const h = i < 50 ? 180 : 180 + 20 * Math.sin(i / 7);
      const s = g.orientation({ t: i * 20, heading: h, accuracy: 14 });
      if (s.facing !== was) flips++;
      was = s.facing;
    }
    expect(flips).toBe(1); // locked once, never let go
  });

  it("walking away north at 1.3 m/s: GPS course replaces the compass, target reads behind", () => {
    const g = createGuide(TARGET);
    const r = rng(2);
    let s = g.state();
    for (let sec = 0; sec <= 30; sec++) {
      const north = 5 + 1.3 * sec;
      const fix: Fix = {
        ...at(north + 3 * gauss(r) * 0.5, 3 * gauss(r) * 0.5),
        t: sec * 1000,
        accuracy: 3,
        speed: 1.3,
        course: (360 + 4 * gauss(r)) % 360,
      };
      s = g.position(fix);
      // The compass meanwhile is swinging (phone in a hand, swinging while walking).
      for (let k = 0; k < 20; k++)
        g.orientation({ t: sec * 1000 + k * 50, heading: (360 + 60 * Math.sin(k)) % 360, accuracy: 14 });
      s = g.state();
    }
    expect(s.source).toBe("course");
    expect(Math.abs(angleDiff(180, s.bearing_deg as number))).toBeLessThan(10);
    expect(Math.abs(s.rel_deg as number)).toBeGreaterThan(160); // behind you
    // Stops: below 0.6 m/s it goes back to the compass.
    s = g.position({ ...at(44, 0), t: 32_000, accuracy: 3, speed: 0.2, course: -1 });
    g.orientation({ t: 32_100, heading: 180, accuracy: 14 });
    expect(g.state().source).toBe("compass");
  });

  it("closer than twice the accuracy: says near, keeps the last good bearing, no false direction", () => {
    const g = createGuide(TARGET);
    g.position({ ...at(20, 0), t: 0, accuracy: 3 });
    g.orientation({ t: 10, heading: 180, accuracy: 14 });
    const far = g.state();
    expect(far.near).toBe(false);
    expect(Math.round(far.bearing_deg as number)).toBe(180);
    // 4 m away with a 3 m fix: near. The jittery fix on the other side must not flip the bearing.
    const s = g.position({ ...at(-4, 1), t: 1000, accuracy: 3 });
    expect(s.near).toBe(true);
    expect(s.rel_deg).toBeNull();
    expect(Math.round(s.bearing_deg as number)).toBe(180);
  });

  it("a bad or dropped fix keeps the last good bearing and marks it stale after 10 s", () => {
    const g = createGuide(TARGET);
    g.position({ ...at(50, 0), t: 0, accuracy: 3 });
    const good = g.state().bearing_deg;
    g.position({ ...at(0, 300), t: 1000, accuracy: 120 }); // a 120 m fix: ignored
    expect(g.state().bearing_deg).toBe(good);
    expect(Math.round(g.state().distance_m as number)).toBe(50);
    expect(g.tick(5000).stale).toBe(false);
    expect(g.tick(11_000).stale).toBe(true);
    expect(g.state().bearing_deg).toBe(good);
  });

  it("held upright like a camera: keeps the last heading and asks to hold it flat", () => {
    const g = createGuide(TARGET);
    g.position({ ...at(30, 0), t: 0, accuracy: 3 });
    g.orientation({ t: 0, heading: 180, accuracy: 14, beta: 20 });
    const s = g.orientation({ t: 20, heading: 0, accuracy: 14, beta: 85 }); // the flip iOS gives upright
    expect(s.hint).toBe("flat");
    expect(Math.round(s.heading as number)).toBe(180);
    expect(g.orientation({ t: 40, heading: 181, accuracy: 14, beta: 15 }).hint).toBeNull();
  });

  it("an uncalibrated or poor compass asks for a figure 8", () => {
    const g = createGuide(TARGET);
    expect(g.orientation({ t: 0, heading: 90, accuracy: -1 }).hint).toBe("figure8");
    expect(g.orientation({ t: 20, heading: 90, accuracy: 40 }).hint).toBe("figure8");
    expect(g.orientation({ t: 40, heading: 90, accuracy: 12 }).hint).toBeNull();
  });

  it("landscape: adds the screen's rotation so the arrow still points the right way", () => {
    const g = createGuide(TARGET);
    g.position({ ...at(30, 0), t: 0, accuracy: 3 });
    const s = g.orientation({ t: 0, heading: 90, accuracy: 14, screen: 90 }); // device top east, screen up south
    expect(Math.round(s.heading as number)).toBe(180);
    expect(s.facing).toBe(true);
  });

  it("turning right round (an exact 180°) settles within a second, it never freezes", () => {
    const g = createGuide(TARGET);
    for (let i = 0; i < 50; i++) g.orientation({ t: i * 20, heading: 90, accuracy: 14 });
    for (let i = 50; i < 100; i++) g.orientation({ t: i * 20, heading: 270, accuracy: 14 });
    expect(Math.abs(angleDiff(270, g.state().heading as number))).toBeLessThan(5);
  });

  it("the arrow follows the short way round: 170° to -170° is a 20° turn, not 340°", () => {
    expect(unwrapAngle(170, -170)).toBe(190);
    expect(unwrapAngle(-170, 170)).toBe(-190);
    expect(unwrapAngle(10, 350)).toBe(-10);
  });
});

describe("device-check copy of the guide", () => {
  it("static/check/guide.js is generated from guide.ts and up to date (npm run gen:guide)", async () => {
    const fs = await import("node:fs");
    const { generated, OUT } = await import("../../../../scripts/gen-guide.ts");
    expect(fs.readFileSync(OUT, "utf8")).toBe(generated());
  });
});

describe("real device streams (Sun 2026-10-11, relative metres only)", () => {
  type H = { t: number; h: number; a: number | null; b: number; g: number; s: number };
  type F = { t: number; n: number; e: number; acc: number; v: number | null; c: number | null };
  const replay = async (file: string) => {
    const fs = await import("node:fs");
    const url = new URL(`../fixtures/${file}`, import.meta.url);
    const { stream } = JSON.parse(fs.readFileSync(url, "utf8")) as { stream: { headings: H[]; fixes: F[] } };
    const g = createGuide(TARGET);
    const events = [
      ...stream.headings.map((x) => ({
        t: x.t,
        run: () => g.orientation({ t: x.t, heading: x.h, accuracy: x.a, beta: x.b, gamma: x.g, screen: x.s }),
      })),
      ...stream.fixes.map((f) => ({
        t: f.t,
        run: () => g.position({ ...at(f.n, f.e), t: f.t, accuracy: f.acc, speed: f.v, course: f.c }),
      })),
    ].sort((a, b) => a.t - b.t);
    let nearFlips = 0;
    let was: boolean | null = null;
    let nearFixes = 0;
    for (const e of events) {
      const s = e.run();
      if (s.distance_m === null) continue;
      if (was !== null && s.near !== was) nearFlips++;
      was = s.near;
      if (s.near) nearFixes++;
    }
    return { nearFlips, nearFixes, total: events.length, last: g.state() };
  };

  it("16 Pro Max: never more than 7.5 m out with 3 to 9 m accuracy, so it says close, without flicker", async () => {
    const r = await replay("compass-iphone16promax-ios26.6.1.json");
    expect(r.last.near).toBe(true);
    expect(r.nearFlips).toBeLessThanOrEqual(2); // was a stream of near/far flips at the 2x edge
  });

  it("iPhone 13 (Safari 27.0): heading events arrived; within 1.6 m the whole run, so close throughout", async () => {
    const r = await replay("compass-iphone13-safari27.0.json");
    expect(r.last.heading).not.toBeNull();
    expect(r.nearFlips).toBe(0);
  });
});

describe("the arrow on the real iPhone heading streams (target 300 m north)", () => {
  // The recorded walks stood next to the target, so here the same real heading streams play
  // against a friend 300 m away: the arrow the screen draws (rel_deg, unwrapped the way
  // Compass.svelte does) must turn smoothly and never take the long way round, and facing
  // must lock and let go without flicker.
  type H = { t: number; h: number; a: number | null; b: number; g: number; s: number };
  const arrow = async (file: string) => {
    const fs = await import("node:fs");
    const url = new URL(`../fixtures/${file}`, import.meta.url);
    const { stream } = JSON.parse(fs.readFileSync(url, "utf8")) as { stream: { headings: H[] } };
    const g = createGuide(TARGET);
    g.position({ ...at(-300, 0), t: stream.headings[0]?.t ?? 0, accuracy: 5, speed: 0, course: null });
    let shown: number | null = null;
    let lastT = 0;
    let maxStep = 0;
    let flips = 0;
    let wasFacing: boolean | null = null;
    let samples = 0;
    for (const x of stream.headings) {
      const s = g.orientation({ t: x.t, heading: x.h, accuracy: x.a, beta: x.b, gamma: x.g, screen: x.s });
      if (s.rel_deg === null) continue;
      const next = shown === null ? s.rel_deg : unwrapAngle(shown, s.rel_deg);
      // Between back-to-back events (the phones send one every 100 ms). After a gap (the screen
      // locked, Safari paused the sensor) the phone really did turn; the needle's 530 ms spring
      // animates that jump, so it isn't counted.
      if (shown !== null && x.t - lastT <= 250) maxStep = Math.max(maxStep, Math.abs(next - shown));
      shown = next;
      lastT = x.t;
      if (wasFacing !== null && s.facing !== wasFacing) flips++;
      wasFacing = s.facing;
      samples++;
    }
    return { maxStep, flips, samples };
  };
  for (const file of ["compass-iphone16promax-ios26.6.1.json", "compass-iphone13-safari27.0.json"]) {
    it(`${file}: under 30° per 100 ms event, never the long way round, facing steady`, async () => {
      const r = await arrow(file);
      expect(r.samples).toBeGreaterThan(20);
      expect(r.maxStep).toBeLessThan(30);
      expect(r.flips).toBeLessThanOrEqual(Math.ceil(r.samples / 50)); // at most one lock change per ~1.5 s of events
    });
  }
});
