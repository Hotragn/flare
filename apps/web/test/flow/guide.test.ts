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
