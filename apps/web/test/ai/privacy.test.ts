// SRS-COND-6, BR-C-9, CR-E1: typed conditions never leave the phone. Every network API is
// trapped while all 60 fixture phrases (plus Plan answers) are parsed; only rules come out,
// and those rules carry no word the person typed. The browser run is apps/web/test/e2e/privacy.ts.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "../../../../docs/requirements/fixtures/conditions-60.json" with { type: "json" };
import { templateLadder } from "../../src/lib/ai/ladder.ts";
import { planAnswer } from "../../src/lib/ai/plan.ts";
import { parse } from "../../src/lib/conditions/index.ts";

const calls: string[] = [];
const trap = (name: string) =>
  function trapped() {
    calls.push(name);
    throw new Error(`network: ${name}`);
  };

beforeEach(() => {
  calls.length = 0;
  vi.stubGlobal("fetch", trap("fetch"));
  vi.stubGlobal("XMLHttpRequest", trap("XMLHttpRequest"));
  vi.stubGlobal("WebSocket", trap("WebSocket"));
  vi.stubGlobal("EventSource", trap("EventSource"));
  vi.stubGlobal("navigator", { sendBeacon: trap("sendBeacon") });
});
afterEach(() => vi.unstubAllGlobals());

// Words that may appear in the structured rule because they are its field names.
const RULE_WORDS = new Set([
  "type",
  "with",
  "after",
  "back_by",
  "max_walk",
  "max_step",
  "min_step",
  "member_id",
  "at",
  "minutes",
  "step",
]);
const members = fixture.group_members.map((n, i) => ({ id: `00000000-0000-4000-8000-00000000000${i}`, name: n }));
const ctx = { members, tz: fixture.time_zone, now: "2026-10-11T15:00:00.000Z", kind: "plan" as const };

describe("typed conditions stay on the phone (SRS-COND-6)", () => {
  it("no network call while parsing all 60 phrases and Plan answers", () => {
    for (const c of [...fixture.core_40, ...fixture.hard_20]) {
      parse(c.text, ctx);
      planAnswer(c.text, ctx, templateLadder(60));
    }
    expect(calls).toEqual([]);
  });

  it("the rules that would be sent contain no typed word and no name", () => {
    for (const c of [...fixture.core_40, ...fixture.hard_20]) {
      const r = parse(c.text, ctx);
      if (!r.ok) continue;
      // Remove the schema's own names; what is left is values: ids, ISO times, numbers.
      const sent = JSON.stringify(r.rules).replace(
        /"(type|at|minutes|step|member_id|with|after|back_by|max_walk|max_step|min_step)"/g,
        "",
      );
      const words = (c.text.toLowerCase().match(/[a-z']{3,}/g) ?? []).filter((w) => !RULE_WORDS.has(w));
      for (const w of words) expect(sent.toLowerCase(), `${c.text} leaked "${w}"`).not.toContain(w);
    }
  });
});
