import type { LatLon } from "@flare/shared/icd/map";
import { describe, expect, it } from "vitest";
import { type CompassEnv, createCompass, headingOf, smoothHeading } from "../../apps/web/src/lib/compass/compass.ts";
import { direction, phrase, shouldSpeak, spokenMeters } from "../../apps/web/src/lib/compass/speech.ts";
import { destination } from "../../apps/web/src/lib/map/geo.ts";

const T: LatLon = { lat: 42.3055, lon: -83.2447 };

/** Fake platform: records calls; tests drive position, heading and the clock. */
function fakeEnv(opts: { permission?: string | Error; vibrates?: boolean } = {}) {
  const log: string[] = [];
  let orient: ((r: { webkitCompassHeading?: number; alpha: number | null }) => void) | null = null;
  let pos: ((p: LatLon & { accuracy: number }) => void) | null = null;
  let posErr: ((c: number) => void) | null = null;
  let clock = 0;
  const env: CompassEnv = {
    onOrientation(cb) {
      log.push("orientation:listen");
      orient = cb;
      return () => log.push("orientation:off");
    },
    watchPosition(ok, err) {
      log.push("location:watch");
      pos = ok;
      posErr = err;
      return () => log.push("location:off");
    },
    speak: (t) => log.push(`speak:${t}`),
    stopSpeaking: () => log.push("stop"),
    vibrate: () => {
      log.push("vibrate");
      return opts.vibrates ?? false;
    },
    tone: () => log.push("tone"),
    now: () => clock,
  };
  if (opts.permission !== undefined) {
    env.requestOrientationPermission = () => {
      log.push("orientation:ask");
      return opts.permission instanceof Error
        ? Promise.reject(opts.permission)
        : Promise.resolve(opts.permission as string);
    };
  }
  return {
    env,
    log,
    at: (p: LatLon, accuracy = 5) => pos?.({ ...p, accuracy }),
    turn: (deg: number) => orient?.({ webkitCompassHeading: deg, alpha: null }),
    fail: (code: number) => posErr?.(code),
    tick: (ms: number) => {
      clock += ms;
    },
  };
}

const spoken = (log: string[]) => log.filter((l) => l.startsWith("speak:")).map((l) => l.slice(6));

describe("SRS-CMP-1 phrase", () => {
  it("says name, distance, direction from the copy deck", () => {
    expect(phrase("Amor", 400, 330)).toBe("Amor, 400 meters, slightly left.");
    expect(phrase("Amor", 87, 90)).toBe("Amor, 85 meters, to your right.");
    expect(phrase("Amor", 1234, 180)).toBe("Amor, 1.2 kilometers, behind you.");
    expect(phrase("Amor", 40, 5)).toBe("Amor is straight ahead.");
    expect(phrase("Amor", 40, null)).toBe("Amor, 40 meters.");
  });
  it("maps relative bearings to directions", () => {
    expect([0, 15, 16, 45, 46, 135, 136, 224, 314, 345].map(direction)).toEqual([
      "ahead",
      "ahead",
      "slightRight",
      "slightRight",
      "right",
      "right",
      "behind",
      "behind",
      "left",
      "ahead",
    ]);
    expect(spokenMeters(7.4)).toBe(7);
    expect(spokenMeters(152)).toBe(150);
  });
});

describe("SRS-CMP-2 speech repeats", () => {
  const last = { at: 0, angle: 10, distanceM: 400 };
  it("on a 30° turn, a halved distance, or after 60 s, and not otherwise", () => {
    expect(shouldSpeak(null, 0, null, 400)).toBe(true);
    expect(shouldSpeak(last, 1000, 39, 390)).toBe(false);
    expect(shouldSpeak(last, 1000, 40, 390)).toBe(true);
    expect(shouldSpeak(last, 1000, 340, 390)).toBe(true); // -30° wraps around north
    expect(shouldSpeak(last, 1000, 10, 200)).toBe(true);
    expect(shouldSpeak(last, 1000, 10, 201)).toBe(false);
    expect(shouldSpeak(last, 60_000, 10, 390)).toBe(true);
  });
});

describe("compass controller", () => {
  it("asks orientation first, then location, inside start() (spike E3)", async () => {
    const f = fakeEnv({ permission: "granted" });
    const c = createCompass({ target: T, name: "Amor", env: f.env });
    const p = c.start();
    // Both are requested synchronously, orientation before location, before any await.
    expect(f.log.slice(0, 2)).toEqual(["orientation:ask", "location:watch"]);
    await p;
    expect(c.state().orientation).toBe("granted");
    expect(f.log).toContain("orientation:listen");
  });
  it("speaks on first fix, turns, halving and 60 s; ticks once on facing (SRS-CMP-2, -3)", async () => {
    const f = fakeEnv({ permission: "granted" });
    const c = createCompass({ target: T, name: "Amor", env: f.env });
    await c.start();
    const me = destination(T, 180, 400); // 400 m south of the target: target bearing 0°
    f.turn(90); // facing east: target is to the left
    f.at(me);
    expect(spoken(f.log)).toEqual(["Amor, 400 meters, to your left."]);
    expect(c.state().distance_m).toBeCloseTo(400, 0);
    f.tick(1000);
    f.at(destination(T, 180, 390)); // small move: no repeat
    expect(spoken(f.log)).toHaveLength(1);
    for (let i = 0; i < 12; i++) f.turn(0); // smoothing converges on north: facing
    expect(c.state().facing).toBe(true);
    expect(f.log.filter((l) => l === "tone")).toHaveLength(1); // no vibration API: tone instead
    // Turning 90° re-speaks at each 30° step (left, then slightly left); facing itself is the tone.
    expect(spoken(f.log)).toEqual([
      "Amor, 400 meters, to your left.",
      "Amor, 390 meters, to your left.",
      "Amor, 390 meters, slightly left.",
    ]);
    const n = spoken(f.log).length;
    f.at(destination(T, 180, 190)); // distance halved
    expect(spoken(f.log)).toHaveLength(n + 1);
    f.tick(60_000);
    f.at(destination(T, 180, 185));
    expect(spoken(f.log)).toHaveLength(n + 2);
  });
  it("vibrates instead of a tone where vibration exists", async () => {
    const f = fakeEnv({ vibrates: true });
    const c = createCompass({ target: T, name: "Amor", env: f.env });
    await c.start();
    expect(c.state().orientation).toBe("unsupported"); // no prompt platform
    f.turn(0);
    f.at(destination(T, 180, 100));
    expect(f.log).toContain("vibrate");
    expect(f.log).not.toContain("tone");
  });
  it("keeps distance and speech when motion is denied (SRS-CMP-7)", async () => {
    const f = fakeEnv({ permission: "denied" });
    const c = createCompass({ target: T, name: "Amor", env: f.env });
    await c.start();
    expect(c.state().orientation).toBe("denied");
    expect(f.log).not.toContain("orientation:listen");
    f.at(destination(T, 90, 250));
    expect(c.state().rel_deg).toBeNull();
    expect(spoken(f.log)).toEqual(["Amor, 250 meters."]);
  });
  it("reports a permission error and a location denial", async () => {
    const f = fakeEnv({ permission: new Error("NotAllowedError") });
    const c = createCompass({ target: T, name: "Amor", env: f.env });
    await c.start();
    f.fail(1);
    expect(c.state()).toMatchObject({ orientation: "error", location: "denied" });
  });
  it("stops talking and unsubscribes on stop()", async () => {
    const f = fakeEnv({ permission: "granted" });
    const c = createCompass({ target: T, name: "Amor", env: f.env, talking: false });
    await c.start();
    f.at(destination(T, 0, 50));
    expect(spoken(f.log)).toEqual([]); // talking off: line kept, nothing spoken
    expect(c.state().line).toBe("Amor, 50 meters.");
    c.setTalking(true);
    expect(spoken(f.log)).toEqual(["Amor, 50 meters."]);
    c.stop();
    expect(f.log).toEqual(expect.arrayContaining(["orientation:off", "location:off", "stop"]));
  });
});

describe("headings", () => {
  it("reads webkitCompassHeading, then absolute alpha, else nothing", () => {
    expect(headingOf({ webkitCompassHeading: 370, alpha: 5 })).toBe(10);
    expect(headingOf({ alpha: 90, absolute: true })).toBe(270);
    expect(headingOf({ alpha: 90, absolute: false })).toBeNull();
  });
  it("smooths across north without spinning", () => {
    expect(smoothHeading(350, 10, 0.5)).toBeCloseTo(0, 6);
    expect(smoothHeading(null, 42)).toBe(42);
  });
});
