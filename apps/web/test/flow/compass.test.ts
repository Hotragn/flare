// Compass math, sensor order and speech cadence (FE4). Spike E3 decided the order.
import { afterEach, describe, expect, it, vi } from "vitest";
import { speechDue } from "../../src/lib/motion/speech.ts";
import { bearingDeg, distanceM, relative, roundMeters, startSensors } from "../../src/lib/screens/flow/compass.ts";

const POND = { lat: 42.3196, lon: -83.2129 };

describe("compass (FE4)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("SRS-CMP-4: distance is within 1% of the known 111.2 m for 0.001° of latitude", () => {
    const d = distanceM(POND, { lat: POND.lat + 0.001, lon: POND.lon });
    expect(Math.abs(d - 111.2)).toBeLessThan(1.2);
  });

  it("SRS-CMP-1: bearing north is 0°, east is 90°", () => {
    expect(bearingDeg(POND, { lat: POND.lat + 0.01, lon: POND.lon })).toBeCloseTo(0, 0);
    expect(bearingDeg(POND, { lat: POND.lat, lon: POND.lon + 0.01 })).toBeCloseTo(90, 0);
  });

  it("SRS-CMP-1: relative bearing wraps to -180..180 (negative is left)", () => {
    expect(relative(10, 350)).toBe(20);
    expect(relative(350, 10)).toBe(-20);
    expect(relative(180, 0)).toBe(-180);
  });

  it("SRS-CMP-1: distances round to 5 m near and 10 m far", () => {
    expect(roundMeters(42)).toBe(40);
    expect(roundMeters(3)).toBe(5);
    expect(roundMeters(436)).toBe(440);
  });

  it("spike E3: orientation permission is asked first, in the tap, before location", async () => {
    const calls: string[] = [];
    vi.stubGlobal("addEventListener", () => calls.push("listen"));
    vi.stubGlobal("removeEventListener", () => {});
    vi.stubGlobal("DeviceOrientationEvent", {
      requestPermission: () => {
        calls.push("orientation");
        return Promise.resolve("granted");
      },
    });
    vi.stubGlobal("navigator", {
      geolocation: {
        watchPosition: () => {
          calls.push("location");
          return 1;
        },
        clearWatch: () => {},
      },
    });
    const stop = startSensors(
      () => {},
      () => {},
    );
    expect(calls).toEqual(["orientation", "location"]);
    stop();
    await Promise.resolve();
    expect(calls).not.toContain("listen"); // stopped before the answer: no listener left behind
  });

  it("SRS-CMP-7: webkitCompassHeading drives the heading with no network", async () => {
    const target = new EventTarget();
    vi.stubGlobal("addEventListener", target.addEventListener.bind(target));
    vi.stubGlobal("removeEventListener", target.removeEventListener.bind(target));
    vi.stubGlobal("DeviceOrientationEvent", { requestPermission: () => Promise.resolve("granted") });
    vi.stubGlobal("navigator", {});
    const seen: (number | null)[] = [];
    const stop = startSensors(
      (r) => seen.push(r.heading),
      () => {},
    );
    await Promise.resolve();
    await Promise.resolve();
    target.dispatchEvent(Object.assign(new Event("deviceorientation"), { webkitCompassHeading: 270 }));
    expect(seen).toEqual([270]);
    stop();
  });

  it("SRS-CMP-2: speech repeats on a 30° turn, a halved distance or 60 s", () => {
    const a = { text: "Fuego, 400 meters, to your left.", bearing: -60, meters: 400, at: 0 };
    expect(speechDue(null, a)).toBe(true);
    expect(speechDue(a, { ...a, bearing: -40, at: 10_000 })).toBe(false);
    expect(speechDue(a, { ...a, bearing: -25, at: 10_000 })).toBe(true);
    expect(speechDue(a, { ...a, meters: 200, at: 10_000 })).toBe(true);
    expect(speechDue(a, { ...a, at: 60_000 })).toBe(true);
  });
});
