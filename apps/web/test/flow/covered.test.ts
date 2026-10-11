// Automations, weather-aware Ember: when rain is likely, seats with a roof go first.
import type { MapPack, Place } from "@flare/shared/icd/map";
import { describe, expect, it } from "vitest";
import { coveredSeats } from "../../src/lib/screens/flow/host.svelte.ts";

const pack = {
  v: 1,
  area: "t",
  center: [42.32, -83.22],
  radius_m: 1000,
  osm_base: "2026-10-01",
  attribution: "© OpenStreetMap contributors",
  kinds: { b: "bench", h: "shelter" },
  items: [
    ["b", 42.32, -83.22, "n1", 0],
    ["b", 42.3201, -83.2201, "n2", { covered: "yes" }],
    ["h", 42.321, -83.221, "n3", 0],
    ["b", 42.32101, -83.22101, "n4", 0], // about 1.4 m from the shelter
  ],
} as unknown as MapPack;
const seat = (id: string, lat: number, lon: number, tags: Record<string, string> = {}): Place => ({
  kind: "bench",
  osm_id: id,
  name: null,
  lat,
  lon,
  tags,
});

describe("covered seats (weather-aware Ember)", () => {
  it("counts a covered tag or a shelter within 25 m, not an open bench", () => {
    const got = coveredSeats(pack, [
      seat("n1", 42.32, -83.22),
      seat("n2", 42.3201, -83.2201, { covered: "yes" }),
      seat("n4", 42.32101, -83.22101),
    ]);
    expect([...got].sort()).toEqual(["n2", "n4"]);
  });
});
