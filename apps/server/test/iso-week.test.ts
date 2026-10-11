// Crew space week bucket: ISO weeks in UTC (Monday start, week 1 holds the first Thursday).
import { describe, expect, it } from "vitest";
import { isoWeek } from "../src/core/gatherings.ts";

describe("isoWeek", () => {
  it("matches ISO 8601", () => {
    expect(isoWeek(new Date("2026-10-11T12:00:00Z"))).toBe("2026-W41"); // a Sunday
    expect(isoWeek(new Date("2026-10-12T00:00:00Z"))).toBe("2026-W42"); // the Monday after
    expect(isoWeek(new Date("2027-01-01T00:00:00Z"))).toBe("2026-W53"); // a Friday: still 2026
    expect(isoWeek(new Date("2026-01-01T00:00:00Z"))).toBe("2026-W01"); // a Thursday
  });
});
