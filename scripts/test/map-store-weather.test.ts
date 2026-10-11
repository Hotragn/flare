import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { maps } from "../../apps/web/src/lib/map/index.ts";
import { cellKey, loadNear, memoryStore } from "../../apps/web/src/lib/map/store.ts";
import { coarse, planWeather, reduce } from "../../apps/web/src/lib/map/weather.ts";
import { FAIRLANE_PATH, POINTS } from "./map-fixtures.ts";

const packText = fs.readFileSync(FAIRLANE_PATH, "utf8");
const osmBase = JSON.parse(packText).osm_base as string;
const day = 86_400_000;
const noSleep = async () => {};

/** Fake network: serves the bundled pack and answers Overpass, recording every host. */
let clock = Date.now(); // the fake Overpass stamps its data with this time
function net(opts: { overpass?: "ok" | "down"; bundled?: boolean } = {}) {
  const hosts: string[] = [];
  const fetch = async (url: string) => {
    const u = new URL(url, "https://flare.test");
    hosts.push(u.host);
    if (u.pathname === "/maps/fairlane.json")
      return opts.bundled === false ? new Response("", { status: 404 }) : new Response(packText);
    if (u.host === "overpass-api.de") {
      if (opts.overpass === "down") throw new TypeError("offline");
      return new Response(
        JSON.stringify({ osm3s: { timestamp_osm_base: new Date(clock).toISOString() }, elements: [] }),
      );
    }
    return new Response("", { status: 404 });
  };
  return { fetch, hosts };
}

describe("ICD-6 maps.load", () => {
  it("loads and validates a bundled pack", async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = net().fetch as typeof fetch;
    try {
      expect((await maps.load("fairlane")).area).toBe("fairlane");
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

describe("SRS-IF-4 loadNear", () => {
  const fresh = () => new Date(Date.parse(osmBase) + day);
  const old = () => new Date(Date.parse(osmBase) + 8 * day);
  it("uses the bundled pack around Fairlane without touching Overpass", async () => {
    const n = net();
    const r = await loadNear(POINTS.wagner, { fetch: n.fetch, now: fresh, sleep: noSleep });
    expect(r.source).toBe("bundled");
    expect(n.hosts).not.toContain("overpass-api.de");
  });
  it("builds a live pack elsewhere, caches it, and reuses it for 7 days", async () => {
    const n = net();
    const store = memoryStore();
    const chicago = { lat: 41.8781, lon: -87.6298 };
    const a = await loadNear(chicago, { fetch: n.fetch, store, sleep: noSleep });
    expect(a.source).toBe("live");
    expect(n.hosts.filter((h) => h === "overpass-api.de")).toHaveLength(2);
    const b = await loadNear(chicago, { fetch: n.fetch, store, sleep: noSleep });
    expect(b.source).toBe("cache");
    expect(n.hosts.filter((h) => h === "overpass-api.de")).toHaveLength(2);
    const c = await loadNear(chicago, {
      fetch: n.fetch,
      store,
      sleep: noSleep,
      now: () => {
        clock = Date.now() + 8 * day;
        return new Date(clock);
      },
    });
    expect(c.source).toBe("live");
  });
  it("falls back to a stale pack offline, else throws", async () => {
    const r = await loadNear(POINTS.mall, { fetch: net({ overpass: "down" }).fetch, now: old, sleep: noSleep });
    expect(r.source).toBe("stale");
    await expect(
      loadNear({ lat: 41.88, lon: -87.63 }, { fetch: net({ overpass: "down" }).fetch, sleep: noSleep }),
    ).rejects.toThrow(/No map data/);
  });
  it("never contacts an openstreetmap.org host (SRS-MAP-3)", async () => {
    const n = net();
    await loadNear({ lat: 41.88, lon: -87.63 }, { fetch: n.fetch, sleep: noSleep });
    expect(n.hosts.some((h) => h.endsWith("openstreetmap.org"))).toBe(false);
  });
  it("keys live packs on a coarse 0.01° grid", () => {
    expect(cellKey({ lat: 41.87812, lon: -87.62984 }).key).toBe("41.88_-87.63");
  });
});

const hour = (iso: string, t: number, pop: number) => ({
  startTime: iso,
  endTime: new Date(Date.parse(iso) + 3_600_000).toISOString(),
  temperature: t,
  temperatureUnit: "F" as const,
  probabilityOfPrecipitation: { value: pop },
});

describe("MP5 plan weather (SRS-PLAN-2)", () => {
  const periods = [
    hour("2026-10-11T15:00:00Z", 60, 10),
    hour("2026-10-11T16:00:00Z", 64, 20),
    hour("2026-10-11T17:00:00Z", 66, 60),
  ];
  it("reduces the window to rain_likely and an average temp", () => {
    expect(reduce(periods, new Date("2026-10-11T15:00:00Z"), new Date("2026-10-11T17:00:00Z"))).toEqual({
      rain_likely: false,
      temp_f: 62,
    });
    expect(reduce(periods, new Date("2026-10-11T16:30:00Z"), new Date("2026-10-11T17:30:00Z"))).toEqual({
      rain_likely: true,
      temp_f: 65,
    });
    expect(reduce(periods, new Date("2026-10-12T15:00:00Z"), new Date("2026-10-12T16:00:00Z"))).toBeNull();
  });
  it("sends only a 0.1° position to api.weather.gov", async () => {
    const urls: string[] = [];
    const fetch = async (url: string) => {
      urls.push(url);
      if (url.includes("/points/"))
        return new Response(
          JSON.stringify({
            properties: { forecastHourly: "https://api.weather.gov/gridpoints/DTX/60,62/forecast/hourly" },
          }),
        );
      return new Response(JSON.stringify({ properties: { periods } }));
    };
    const w = await planWeather(POINTS.mall, new Date("2026-10-11T15:00:00Z"), new Date("2026-10-11T16:00:00Z"), {
      fetch,
    });
    expect(w).toEqual({ rain_likely: false, temp_f: 60 });
    expect(urls[0]).toBe("https://api.weather.gov/points/42.3,-83.2");
    expect(urls.every((u) => new URL(u).origin === "https://api.weather.gov")).toBe(true);
    expect(coarse({ lat: 42.3169, lon: -83.2229 })).toEqual({ lat: 42.3, lon: -83.2 });
  });
  it("fails soft when NWS is down, slow, odd, or redirects elsewhere", async () => {
    const s = new Date("2026-10-11T15:00:00Z");
    const e = new Date("2026-10-11T16:00:00Z");
    const down = async () => {
      throw new TypeError("network");
    };
    expect(await planWeather(POINTS.mall, s, e, { fetch: down })).toBeNull();
    expect(await planWeather(POINTS.mall, s, e, { fetch: async () => new Response("", { status: 503 }) })).toBeNull();
    expect(await planWeather(POINTS.mall, s, e, { fetch: async () => new Response("{}") })).toBeNull();
    const evil = async () => new Response(JSON.stringify({ properties: { forecastHourly: "https://evil.example/x" } }));
    expect(await planWeather(POINTS.mall, s, e, { fetch: evil })).toBeNull();
    const slow = (_u: string, init: RequestInit) =>
      new Promise<Response>((_r, rej) => init.signal?.addEventListener("abort", () => rej(new Error("timeout"))));
    expect(await planWeather(POINTS.mall, s, e, { fetch: slow, timeoutMs: 20 })).toBeNull();
  });
});
