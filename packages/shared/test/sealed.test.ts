import { describe, expect, it } from "vitest";
import { NoticeText, SealedGathering } from "../src/sealed.ts";

const spot = { name: "Ford Woods Park pond", lat: 42.3169, lon: -83.2229, key: "w1086505648" };

describe("sealed payload shapes", () => {
  it("accepts a full Flare blob", () => {
    const ok = SealedGathering.safeParse({
      v: 1,
      host_name: "Fuego",
      invite: "Golden pond, come sit",
      scene: "A bench beside a calm pond.",
      host_line: "Fuego is waiting at Ford Woods Park pond.",
      spot,
      candidates: { c1: { ...spot, name: "Bench by the pond" } },
      access: {
        benches: { count: 4, nearest_m: 12 },
        restrooms: { count: 1, nearest_m: 180 },
        water: { count: 0, nearest_m: null },
        steps_mapped: false,
      },
    });
    expect(ok.success).toBe(true);
  });
  it("rejects a candidate label outside c1..c12 and a long invite", () => {
    expect(
      SealedGathering.safeParse({
        v: 1,
        host_name: "F",
        invite: "x",
        scene: "",
        host_line: "",
        spot,
        candidates: { c13: spot },
      }).success,
    ).toBe(false);
    expect(
      SealedGathering.safeParse({ v: 1, host_name: "F", invite: "x".repeat(81), scene: "", host_line: "", spot })
        .success,
    ).toBe(false);
  });
  it("notice text stays small", () => {
    expect(
      NoticeText.safeParse({ v: 1, host: "Fuego", spot: "Ford Woods Park pond", benches: { c1: "Bench by the pond" } })
        .success,
    ).toBe(true);
    expect(NoticeText.safeParse({ v: 1, host: "x".repeat(41), spot: "" }).success).toBe(false);
  });
});
