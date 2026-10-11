// BE7 pure rules: Spark tickets (BR-K-1) and Hot spots merge-by-max (BR-K-6).
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { type HotSpot, mergeHotSpots, recordLit, sparkAllowed } from "../src/index.ts";

const spot = (key: string, count: number, last_date: string, newest_spark_id: string | null = null): HotSpot => ({
  place_key: key,
  place_name: `name ${key} ${last_date}`,
  count,
  last_date,
  newest_spark_id,
});

describe("BR-K-1 spark tickets", () => {
  it("BR-K-1: no accepted arrival means not_arrived", () => {
    expect(sparkAllowed({ issued: false, used: false })).toEqual({ ok: false, error: "not_arrived" });
  });
  it("BR-K-1: one Spark per member per gathering", () => {
    expect(sparkAllowed({ issued: true, used: false })).toEqual({ ok: true });
    expect(sparkAllowed({ issued: true, used: true })).toEqual({ ok: false, error: "spark_exists" });
  });
});

describe("BR-K-6 Hot spots merge", () => {
  it("BR-K-6: count is the max per place; name, date and Spark from the newer entry", () => {
    const a = [spot("node/1", 3, "2026-10-01", "s1"), spot("way/2", 1, "2026-09-01")];
    const b = [spot("node/1", 2, "2026-10-11", "s9"), spot("node/3", 1, "2026-10-11")];
    expect(mergeHotSpots(a, b)).toEqual([
      { ...spot("node/1", 3, "2026-10-11", "s9") },
      spot("node/3", 1, "2026-10-11"),
      spot("way/2", 1, "2026-09-01"),
    ]);
  });
  it("BR-K-6: same date: higher count wins the name; a missing Spark id is kept from the other", () => {
    const a = [spot("k", 4, "2026-10-11", null)];
    const b = [spot("k", 5, "2026-10-11", null)];
    expect(mergeHotSpots(a, b)[0]?.count).toBe(5);
    const c = [{ ...spot("k", 4, "2026-10-11", "old") }];
    const d = [{ ...spot("k", 4, "2026-10-12", null) }];
    expect(mergeHotSpots(c, d)[0]?.newest_spark_id).toBe("old");
    expect(mergeHotSpots(d, c)[0]?.newest_spark_id).toBe("old");
  });
  it("BR-K-6: recordLit adds one at the place and keeps the newest date", () => {
    const blob = [spot("k", 2, "2026-10-12", "s1")];
    const out = recordLit(blob, { key: "k", name: "Pond" }, "2026-10-11", null);
    expect(out).toEqual([
      { place_key: "k", place_name: "Pond", count: 3, last_date: "2026-10-12", newest_spark_id: "s1" },
    ]);
    expect(recordLit([], { key: "n", name: "Bench" }, "2026-10-11", "s2")).toEqual([
      { place_key: "n", place_name: "Bench", count: 1, last_date: "2026-10-11", newest_spark_id: "s2" },
    ]);
  });

  const arbBlob = fc
    .uniqueArray(
      fc.record({
        place_key: fc.constantFrom("a", "b", "c", "d"),
        place_name: fc.constantFrom("x", "y"),
        count: fc.integer({ min: 1, max: 50 }),
        last_date: fc.constantFrom("2026-10-01", "2026-10-02", "2026-10-03"),
        newest_spark_id: fc.option(fc.constantFrom("s1", "s2"), { nil: null }),
      }),
      { selector: (e) => e.place_key },
    )
    .map((xs) => xs as HotSpot[]);

  it("BR-K-6 property: counts merge by max and are commutative; merge is idempotent", () => {
    fc.assert(
      fc.property(arbBlob, arbBlob, (a, b) => {
        const ab = mergeHotSpots(a, b);
        const ba = mergeHotSpots(b, a);
        expect(ab.map((e) => [e.place_key, e.count])).toEqual(ba.map((e) => [e.place_key, e.count]));
        expect(mergeHotSpots(ab, ab)).toEqual(ab);
        for (const e of ab) {
          const max = Math.max(...[...a, ...b].filter((x) => x.place_key === e.place_key).map((x) => x.count));
          expect(e.count).toBe(max);
        }
      }),
    );
  });
});
