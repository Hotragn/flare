// OD1 and OD2: rules parser and read-back against docs/requirements/fixtures/conditions-60.json.

import { describe, expect, it } from "vitest";
import fixture from "../../../../docs/requirements/fixtures/conditions-60.json" with { type: "json" };
import {
  countWords,
  parse,
  parseError,
  READBACK_MAX_WORDS,
  readBack,
  readBackChips,
} from "../../src/lib/conditions/index.ts";
import { parseRaw, type RawRule } from "../../src/lib/conditions/rules.ts";
import { localToIso, timeLabel } from "../../src/lib/conditions/time.ts";

type Case = { text: string; expect: { type: string; value: string | number }[] | null | string };
const members = fixture.group_members;
const key = (rs: { type: string; value: unknown }[]) =>
  rs
    .map((r) => `${r.type}=${r.value}`)
    .sort()
    .join("|");

function same(text: string, expected: Case["expect"]): boolean {
  const r = parseRaw(text, members);
  if (expected === null) return !r.ok && r.reason === "didnt_catch";
  if (typeof expected === "string") return !r.ok && r.reason === "not_in_group";
  return r.ok && key(r.rules) === key(expected);
}

const score = (set: Case[]) => set.filter((c) => same(c.text, c.expect)).length;

// The four CR-A1 phrases (ADR-0016), with a Plan ladder whose step 2 is the park loop.
const STEPS = [
  { step: 1 as const, name: "full walk" },
  { step: 2 as const, name: "park loop" },
  { step: 3 as const, name: "short loop" },
  { step: 4 as const, name: "porch" },
];
const MIN_STEP: [string, RawRule[]][] = [
  ["only the long one", [{ type: "min_step", value: 1 }]],
  ["the full walk or nothing", [{ type: "min_step", value: 1 }]],
  ["at least the park loop", [{ type: "min_step", value: 2 }]],
  ["step 2 or bigger", [{ type: "min_step", value: 2 }]],
];

const ids = Object.fromEntries(members.map((n, i) => [n, `00000000-0000-4000-8000-00000000000${i}`]));
const ctx = (kind: "flare" | "plan" = "plan") => ({
  members: members.map((n) => ({ id: ids[n] ?? "", name: n })),
  tz: fixture.time_zone,
  now: "2026-10-11T15:00:00.000Z", // 11:00 in Dearborn (EDT, UTC-4)
  kind,
  steps: STEPS,
});

describe("OD1 rules parser (SRS-COND-1, SRS-COND-2)", () => {
  it("SRS-COND-2: core_40 parses at least 36 of 40", () => {
    const ok = score(fixture.core_40 as Case[]);
    expect(ok).toBeGreaterThanOrEqual(36);
    expect(ok).toBe(40); // the lab's score; keep it
  });

  it("SRS-COND-4: hard_20 score is reported and beats the lab's 15", () => {
    const ok = score(fixture.hard_20 as Case[]);
    console.info(`hard_20: ${ok}/20`);
    expect(ok).toBeGreaterThanOrEqual(17);
  });

  it("CR-A1 min_step: the 4 phrases parse", () => {
    for (const [text, want] of MIN_STEP) {
      const r = parseRaw(text, members, STEPS);
      expect(r.ok && key(r.rules), text).toBe(key(want));
    }
  });

  it("lab 07 general rule 1: negated far is max_walk", () => {
    expect(same("not too far, like 10 minutes", [{ type: "max_walk", value: 10 }])).toBe(true);
    expect(same("can't walk far today", [{ type: "max_walk", value: 10 }])).toBe(true);
    expect(same("not too far, like 15 min", [{ type: "max_walk", value: 15 }])).toBe(true);
  });

  it("lab 07 general rule 2: home for dinner at T is back_by", () => {
    expect(same("gotta be home for dinner at 6", [{ type: "back_by", value: "18:00" }])).toBe(true);
    expect(same("need to be home at 5:30", [{ type: "back_by", value: "17:30" }])).toBe(true);
  });

  it("BR-C-2: OR is refused, more than 4 rules is too_many", () => {
    expect(parseRaw("with Amor or Shilp", members)).toEqual({ ok: false, reason: "didnt_catch" });
    const r = parseRaw("with Amor and Shilp, after 2, back by 5, max 10 min walk", members);
    expect(r).toEqual({ ok: false, reason: "too_many" });
  });

  it("SRS-COND-7: a name not in the group is refused with the name", () => {
    const r = parse("only if Bob comes", ctx());
    expect(r).toEqual({ ok: false, reason: "not_in_group", name: "Bob" });
    if (!r.ok) expect(parseError(r)).toBe("Bob isn't in this group.");
  });

  it("SRS-COND-8: unparseable text gives the hint", () => {
    const r = parse("maybe", ctx());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(parseError(r)).toBe("I didn't catch that. Try 'after 2' or 'only with Amor'.");
  });

  it("BR-C-3: with() resolves to the member id on the phone", () => {
    const r = parse("only if amor comes", ctx());
    expect(r.ok && r.rules).toEqual([{ type: "with", member_id: ids.Amor }]);
  });

  it("BR-TIME-2: times are read in the group time zone and sent as UTC", () => {
    const r = parse("after 2, back by 5", ctx());
    expect(r.ok && r.rules).toEqual([
      { type: "after", at: "2026-10-11T18:00:00.000Z" },
      { type: "back_by", at: "2026-10-11T21:00:00.000Z" },
    ]);
  });

  it("BR-C-1: step rules are Plans only", () => {
    expect(parse("porch only", ctx("flare"))).toEqual({ ok: false, reason: "didnt_catch" });
    const r = parse("short one, back by 4", ctx("flare"));
    expect(r.ok && r.rules.map((x) => x.type)).toEqual(["back_by"]);
  });

  it("parses in under 1 ms per phrase", () => {
    const all = [...fixture.core_40, ...fixture.hard_20].map((c) => c.text);
    const t = performance.now();
    for (let i = 0; i < 10; i++) for (const s of all) parseRaw(s, members);
    expect((performance.now() - t) / (all.length * 10)).toBeLessThan(1);
  });
});

describe("OD2 read-back (SRS-COND-5, SRS-PLAN-10)", () => {
  it("SRS-COND-5: every fixture read-back is at most 12 words", () => {
    for (const c of [...fixture.core_40, ...fixture.hard_20]) {
      const r = parse(c.text, ctx());
      if (r.ok) expect(countWords(r.readBack), `${c.text} -> ${r.readBack}`).toBeLessThanOrEqual(READBACK_MAX_WORDS);
    }
  });

  it("SRS-PLAN-10: the read-back names the step", () => {
    const r = parse("step 3 or smaller, back by 5", ctx());
    expect(r.ok && r.readBack).toBe("Got it: step 3 or smaller, back by 5 PM. Right?");
    const m = parse("at least the park loop", ctx());
    expect(m.ok && m.readBack).toBe("Got it: step 2 or bigger. Right?");
  });

  it("SRS-COND-5: four rules fall back to a count; the chips list each one", () => {
    const r = parse("only with Amor, after 2, back by 5, max 15 min walk", ctx());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.readBack).toBe("Got it: 4 rules, listed below. Right?");
    expect(readBackChips(r.rules, ctx())).toEqual([
      "Only with Amor",
      "After 2 PM",
      "Back by 5 PM",
      "Walk 15 min at most",
    ]);
  });

  it("two with() rules share one fragment", () => {
    const r = parse("only if Ammo and Amor come", ctx());
    expect(r.ok && r.readBack).toBe("Got it: only with Ammo and Amor. Right?");
  });

  it("readBack works on rules alone (ICD-7)", () => {
    expect(readBack([{ type: "max_walk", minutes: 10 }], ctx())).toBe("Got it: 10 min walk at most. Right?");
  });
});

describe("group time zone helpers", () => {
  it("handles the DST change week (America/Detroit, 2026-11-01)", () => {
    expect(localToIso("14:00", "2026-11-02T15:00:00.000Z", "America/Detroit")).toBe("2026-11-02T19:00:00.000Z");
    expect(timeLabel("2026-11-02T19:30:00.000Z", "America/Detroit")).toBe("2:30 PM");
    expect(timeLabel("2026-10-11T16:00:00.000Z", "America/Detroit")).toBe("12 PM");
  });
});
