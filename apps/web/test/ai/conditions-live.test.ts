// Live bugs from a real Flare (Sun Oct 11, 8:22 PM): "After 10min, a quick visit works" read as
// "after 10 AM"; "10min only with you" failed. Each case runs at three times of day.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { parse, suggestions } from "../../src/lib/conditions/index.ts";

const TZ = "America/Detroit";
const members = ["Fuego", "Amor", "Shilp"].map((name) => ({ id: `m-${name.toLowerCase()}`, name }));
// Mon Oct 12 2026 local time (EDT, UTC-4).
const at = (h: number, m: number) => new Date(Date.UTC(2026, 9, 12, h + 4, m)).toISOString();
const ctxAt = (h: number, m: number) => ({ members, tz: TZ, now: at(h, m), kind: "flare" as const, host: "Fuego" });
const local = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(
    new Date(iso),
  );
const simple = (text: string, h: number, m: number) => {
  const r = parse(text, ctxAt(h, m));
  if (!r.ok) return r.reason;
  return r.rules
    .map((x) => (x.type === "with" ? `with=${x.member_id}` : "at" in x ? `${x.type}=${local(x.at)}` : x.type))
    .sort()
    .join("|");
};

const DELAYS = [
  "10min",
  "10mins",
  "10m",
  "10 min",
  "10 minutes",
  "in 10",
  "after 10 min",
  "give me 10",
  "can come in 10 min",
];

describe("live bug: delays and bare hours", () => {
  it("the friend's sentence: a delay, and the words it couldn't read are named", () => {
    const r = parse("After 10min, a quick visit works", ctxAt(20, 22));
    expect(r.ok && r.readBack).toBe("Got it: you can come in 10 min. Right?");
    expect(r.ok && r.missed).toBe("a quick visit works");
    expect(simple("After 10min, a quick visit works", 20, 22)).toBe("after=20:32");
  });
  it("the friend's second try: 10min only with you", () => {
    expect(simple("10min only with you", 20, 22)).toBe("after=20:32|with=m-fuego");
  });
  for (const [h, m, want] of [
    [20, 22, "20:32"],
    [9, 0, "09:10"],
    [23, 50, "00:00"],
  ] as const)
    it(`delays at ${h}:${m} all mean ${want}`, () => {
      for (const d of DELAYS) expect(simple(d, h, m), d).toBe(`after=${want}`);
    });
  it("half an hour and an hour", () => {
    expect(simple("in half an hour", 20, 22)).toBe("after=20:52");
    expect(simple("in an hour", 20, 22)).toBe("after=21:22");
  });
  it("a bare hour is the next one coming: after 10 at 8:22 PM is 10 PM, at 9 AM is 10 AM", () => {
    expect(simple("after 10", 20, 22)).toBe("after=22:00");
    expect(simple("after 10", 9, 0)).toBe("after=10:00");
    expect(simple("after 10am is good", 20, 22)).toBe("after=10:00"); // said with am: kept as said
    expect(simple("after 10", 22, 40)).toBe("after=22:00"); // round 6: 10 PM already holds, not 10 AM tomorrow
  });
  it("round 6b: with you when the host's name isn't on this phone yet is said back, never dropped", () => {
    const r = parse("10min only with you", { ...ctxAt(23, 27), host: "Sam" }); // Sam is not in members
    expect(r.ok && r.readBack).toBe("Got it: you can come in 10 min. Right?");
    expect(r.ok && r.missed).toBe("only with Sam");
  });
  it("with you means the host", () => {
    for (const s of ["with you", "only with you", "if you're there", "you and me", "only if you come"])
      expect(simple(s, 20, 22), s).toBe("with=m-fuego");
  });
  it("tap-to-fill chips come from the time of day and the host, and each parses back", () => {
    const ctx = ctxAt(20, 24);
    const chips = suggestions(ctx);
    expect(chips.map((c) => c.label)).toEqual([
      "Come in 10 min",
      "Only if Fuego's there",
      "After 9 PM",
      "15 min walk max",
    ]);
    for (const c of chips) expect(parse(c.text, ctx).ok, c.text).toBe(true);
  });
  it("property: back_by and delays never resolve before now; a bare after at most 6 h back", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 23 }),
        fc.integer({ min: 0, max: 59 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 120 }),
        (h, m, hour, min) => {
          const ctx = ctxAt(h, m);
          const now = Date.parse(ctx.now);
          for (const text of [`after ${hour}`, `back by ${hour}`, `in ${min} min`, `${min}min`]) {
            const r = parse(text, ctx);
            if (!r.ok) return false;
            for (const x of r.rules) {
              if (!("at" in x)) continue;
              const at = Date.parse(x.at);
              // back_by and delays are never in the past; a bare "after" may be one that already
              // holds, but never more than 6 h back (round 6: "after 10" at 10:40 PM is 10 PM).
              if (x.type === "back_by" && at < now - 60_000) return false;
              if (x.type === "after" && at < now - 6 * 3_600_000) return false;
            }
          }
          return true;
        },
      ),
      { numRuns: 500 },
    );
  });
});
