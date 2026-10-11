// Phrasing families added to the rules parser after the Tinker LoRA run (docs/handoffs/11-tinker.md).
// The fine-tune showed what people say; the rules learn it so the words never leave the phone (BR-C-9).

import { describe, expect, it } from "vitest";
import fixture from "../../../../docs/requirements/fixtures/conditions-60.json" with { type: "json" };
import fresh from "../../../../evals/datasets/conditions-fresh-40.json" with { type: "json" };
import { parseRaw, parseTime, type RawRule, type StepName } from "../../src/lib/conditions/rules.ts";

const members = fixture.group_members;
// The eval's Plan ladder (evals/datasets/conditions-cr-a1.json).
const STEPS: StepName[] = [
  { step: 1, name: "the full walk" },
  { step: 2, name: "the park loop" },
  { step: 3, name: "a quick lap" },
  { step: 4, name: "just say hi" },
];
const key = (rs: { type: string; value: unknown }[]) =>
  rs
    .map((r) => `${r.type}=${r.value}`)
    .sort()
    .join("|");
const rules = (text: string) => {
  const r = parseRaw(text, members, STEPS);
  return r.ok ? key(r.rules) : r.reason;
};
const cases = (list: [string, RawRule[]][]) => {
  for (const [text, want] of list) expect(rules(text), text).toBe(key(want));
};

describe("fine-tune families in the rules parser", () => {
  it("times: quarter to, quarter past, half past", () => {
    expect(parseTime("quarter to 5")).toBe("16:45");
    expect(parseTime("quarter to five")).toBe("16:45");
    expect(parseTime("quarter past 9")).toBe("09:15");
    expect(parseTime("half past 4")).toBe("16:30");
    expect(parseTime("quarter to 13")).toBeNull();
    cases([["back no later than quarter to 5", [{ type: "back_by", value: "16:45" }]]]);
  });

  it("W1: softer with() cues for group members", () => {
    cases([
      ["as long as Amor joins", [{ type: "with", value: "Amor" }]],
      ["sure, assuming Fuego's in", [{ type: "with", value: "Fuego" }]],
      ["cant go without shilp lol", [{ type: "with", value: "Shilp" }]],
      ["tell ammo to come and im there", [{ type: "with", value: "Ammo" }]],
      ["Fuego has to come", [{ type: "with", value: "Fuego" }]],
      [
        "in if both fuego and shilp show",
        [
          { type: "with", value: "Fuego" },
          { type: "with", value: "Shilp" },
        ],
      ],
    ]);
    // Soft cues never refuse a name: "tell Mom" is not a not_in_group error.
    expect(rules("tell Mom I'm in, after 2")).toBe(key([{ type: "after", value: "14:00" }]));
    expect(parseRaw("as long as Bob comes", members)).toEqual({ ok: false, reason: "not_in_group", name: "Bob" });
  });

  it("A1-A3: busy until T, T at the earliest, past T, done with X around T", () => {
    cases([
      ["can't do anything til 3", [{ type: "after", value: "15:00" }]],
      ["im stuck at work until 5", [{ type: "after", value: "17:00" }]],
      ["gotta finish laundry so 2:45 at the earliest", [{ type: "after", value: "14:45" }]],
      ["only once its past 1:30", [{ type: "after", value: "13:30" }]],
      ["count me in once I'm done with lunch around 1", [{ type: "after", value: "13:00" }]],
    ]);
  });

  it("B1-B2: curfew, at the latest, free until, wrap up by, event I must be back for", () => {
    cases([
      ["curfew is 5:30 lol", [{ type: "back_by", value: "17:30" }]],
      ["5 at the latest", [{ type: "back_by", value: "17:00" }]],
      ["free until 6", [{ type: "back_by", value: "18:00" }]],
      ["have to wrap up by noon", [{ type: "back_by", value: "12:00" }]],
      ["got a thing at 3, need to be back for it", [{ type: "back_by", value: "15:00" }]],
      ["my shift starts at 6 so i gotta be back before then", [{ type: "back_by", value: "18:00" }]],
    ]);
    // An event with "after" is a start time, not a deadline.
    expect(rules("I'll come after my thing at 2")).not.toContain("back_by");
  });

  it("M0-M2: spoken durations, limit word after the minutes, nothing far", () => {
    cases([
      ["half hour walk max", [{ type: "max_walk", value: 30 }]],
      ["ten minute walk max", [{ type: "max_walk", value: 10 }]],
      ["my knee's bad, 15 mins walking tops", [{ type: "max_walk", value: 15 }]],
      ["20 min walk at most", [{ type: "max_walk", value: 20 }]],
      ["i can walk 25 minutes, no more", [{ type: "max_walk", value: 25 }]],
      ["nothing far pls", [{ type: "max_walk", value: 10 }]],
      [
        "home by 5 and nothing more than a 10 min walk",
        [
          { type: "back_by", value: "17:00" },
          { type: "max_walk", value: 10 },
        ],
      ],
    ]);
  });

  it("S1-S3: sit or say hi is the smallest step; named-step limits", () => {
    cases([
      [
        "sit somewhere close",
        [
          { type: "max_step", value: 4 },
          { type: "max_walk", value: 10 },
        ],
      ],
      ["just wanna say hi honestly", [{ type: "max_step", value: 4 }]],
      ["a quick lap is all i've got in me", [{ type: "max_step", value: 3 }]],
      ["nothing bigger than the park loop", [{ type: "max_step", value: 2 }]],
      ["nothing smaller than the park loop", [{ type: "min_step", value: 2 }]],
      ["no bigger than step 3", [{ type: "max_step", value: 3 }]],
    ]);
  });

  it("plain yes words", () => {
    for (const t of ["sure thing", "sounds good", "bet", "for sure", "I'm down"]) expect(rules(t), t).toBe("");
  });

  it("still refuses OR, vague and impossible times", () => {
    for (const t of ["if Amor or Shilp comes", "maybe", "back by 26", "after 25", "lemme check and get back to u"])
      expect(rules(t), t).toBe("didnt_catch");
  });

  it("fresh_40 dev set: 40/40, each parse under 1 ms", () => {
    const items = fresh.items as { text: string; expect: { type: string; value: string | number }[] | null | string }[];
    let ok = 0;
    for (const c of items) {
      const r = parseRaw(c.text, members, STEPS);
      if (c.expect === null) ok += Number(!r.ok && r.reason === "didnt_catch");
      else if (typeof c.expect === "string") ok += Number(!r.ok && r.reason === "not_in_group");
      else ok += Number(r.ok && key(r.rules) === key(c.expect));
    }
    expect(ok).toBe(40);
    const all = [
      ...items.map((c) => c.text),
      ...fixture.core_40.map((c) => c.text),
      ...fixture.hard_20.map((c) => c.text),
    ];
    const t = performance.now();
    for (let i = 0; i < 10; i++) for (const s of all) parseRaw(s, members, STEPS);
    expect((performance.now() - t) / (all.length * 10)).toBeLessThan(1);
  });
});
