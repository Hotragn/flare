import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { enforce, PHOTO_PROMPT, PhotoDraft } from "../src/photo.ts";
import { hasPersonWords } from "../src/prompts/guard.ts";
import { TEMPLATE_LABELS } from "../src/prompts/ladder.ts";
import { enforceOsmTags, OSM_KEYS, OSM_SYSTEM, validTag } from "../src/prompts/osm-tags.ts";
import { parseRestRequest, restReadBack } from "../src/prompts/rest-loop.ts";

const deck = JSON.parse(
  readFileSync(new URL("../../../design/prototype/src/lib/copy/deck.json", import.meta.url), "utf8"),
).strings as Record<string, { text: string }>;

describe("person-word guard (BR-AI-2)", () => {
  it.each([
    "a smiling woman",
    "his red jacket",
    "an elderly couple",
    "a teen on a bike",
    "people wearing hats",
    "a bald guy",
  ])("rejects %s", (s) => expect(hasPersonWords(s)).toBe(true));
  it.each([
    "a group of people on the lawn",
    "a person walking",
    "a kids' playground",
    "tall trees by a body of water",
    "a couple of benches",
  ])("allows %s", (s) => expect(hasPersonWords(s)).toBe(false));
  it("photo enforce drops clothing descriptions", () => {
    expect(enforce('{"invite":"Meet by the pond","alt":"A person wearing a red jacket sits on a bench."}')).toBeNull();
  });
  it("photo spec is v2 with the 6 s budget and the guarded draft schema", () => {
    expect(PHOTO_PROMPT.version).toBe(2);
    expect(PHOTO_PROMPT.budgetMs).toBe(6000);
    const d = enforce('{"invite":"Golden pond, come sit","alt":"A pond with yellow trees."}');
    expect(PhotoDraft.safeParse(d).success).toBe(true);
  });
});

describe("ladder template labels", () => {
  it("match copy keys ladder.template.step1 to step4", () => {
    expect(TEMPLATE_LABELS.map((_, i) => deck[`ladder.template.step${i + 1}`]?.text)).toEqual([...TEMPLATE_LABELS]);
  });
});

describe("OSM tag drafts (BR-AI-4, E17-S1 AC1)", () => {
  it("the allow-list is exactly the 13 keys in E17-S1", () => {
    expect([...OSM_KEYS].sort()).toEqual(
      [
        "amenity",
        "backrest",
        "material",
        "seats",
        "wheelchair",
        "fee",
        "access",
        "opening_hours",
        "drinking_water",
        "step_count",
        "handrail",
        "covered",
        "lit",
      ].sort(),
    );
    for (const k of OSM_KEYS) expect(OSM_SYSTEM).toContain(k);
  });
  it("keeps allowed tags and drops every other key", () => {
    const d = enforceOsmTags(
      '{"tags":{"amenity":"bench","backrest":true,"material":"Wood","seats":3,"name":"Ford bench","leisure":"park","colour":"green"}}',
    );
    expect(d?.tags).toEqual({ amenity: "bench", backrest: "yes", material: "wood", seats: "3" });
    expect(d?.dropped.sort()).toEqual(["colour", "leisure", "name"]);
  });
  it("drops bad values for allowed keys", () => {
    const d = enforceOsmTags('{"amenity":"cafe","lit":"maybe","step_count":"0","opening_hours":"Mo-Fr 08:00-20:00"}');
    expect(d?.tags).toEqual({ opening_hours: "Mo-Fr 08:00-20:00" });
  });
  it("an empty object is a valid nothing-to-tag answer; prose is null", () => {
    expect(enforceOsmTags('{"tags":{}}')?.tags).toEqual({});
    expect(enforceOsmTags("I see a bench")).toBeNull();
  });
  it("validTag rejects keys off the list", () => expect(validTag("name", "x")).toBe(false));
});

describe("rest-loop request (SRS-REST-1, E16-S1 AC1)", () => {
  it("parses the AC1 example", () => {
    expect(parseRestRequest("Knee's bad, 40 minutes, want trees")).toEqual({
      minutes: 40,
      rest_gap_m: null,
      prefer: ["trees"],
      avoid_steps: null,
      mobility_hint: true,
    });
  });
  it("converts feet and minutes of walking to metres", () => {
    expect(parseRestRequest("bench every 300 feet, 30 min")?.rest_gap_m).toBe(90);
    expect(parseRestRequest("rest every 4 minutes, 40 minutes total")).toMatchObject({ minutes: 40, rest_gap_m: 200 });
  });
  it("does not count a negated preference", () => {
    expect(parseRestRequest("no water please, 30 minutes")?.prefer).toEqual([]);
  });
  it("returns null when nothing is usable", () => {
    expect(parseRestRequest("sure, sounds good")).toBeNull();
    expect(parseRestRequest("a 6 hour walk")).toBeNull();
  });
  it("read-back is ≤ 12 words and uses the default gap", () => {
    const r = parseRestRequest("an hour by the water and trees, shady, quiet, flat, toilets, no stairs");
    expect(r).not.toBeNull();
    const rb = restReadBack(
      r ?? { minutes: 60, rest_gap_m: null, prefer: [], avoid_steps: null, mobility_hint: false },
    );
    expect(rb.split(/\s+/).length).toBeLessThanOrEqual(12);
    expect(rb).toContain("bench every 200 m");
  });
});
