// Title Case answers are a style, not place names (eval L13, ADR-0025); the invented-name
// check still holds for a capitalised word inside a sentence-case answer.
import { describe, expect, it } from "vitest";
import { enforceLadder, isTitleCase, sentenceCase } from "../src/prompts/ladder.ts";

const L13 = { ask: "Frisbee at Ford Woods Park even if it rains", total_minutes: 60 };
const answer = (labels: string[]) => JSON.stringify({ labels, minutes: [60, 30, 15, 10] });

describe("sentence case before the invented-name check", () => {
  it("spots Title Case: two or more capitalised words after the first, small words aside", () => {
    expect(isTitleCase("Covered Frisbee Play")).toBe(true);
    expect(isTitleCase("Long Walk by the Pond")).toBe(true);
    expect(isTitleCase("Walk to Paris")).toBe(false); // one capitalised word reads as a name
    expect(isTitleCase("Covered frisbee play")).toBe(false);
    expect(isTitleCase("Walk")).toBe(false);
  });

  it("lower-cases words after the first, keeping names the ask capitalises and all-caps words", () => {
    expect(sentenceCase("Covered Frisbee Play", L13.ask)).toBe("Covered frisbee play");
    expect(sentenceCase("Frisbee At Ford Woods Park", L13.ask)).toBe("Frisbee at Ford Woods Park");
    expect(sentenceCase("Walk By WDDA Lawn", "walk")).toBe("Walk by WDDA lawn");
  });

  it("accepts the Title Case answer that sent L13 to the template, in sentence case", () => {
    const d = enforceLadder(
      answer(["Covered Frisbee Play", "Short Frisbee Toss", "Quick Frisbee Throw", "Sit and Talk"]),
      L13,
    );
    expect(d?.ladder.map((s) => s.label)).toEqual([
      "Covered frisbee play",
      "Short frisbee toss",
      "Quick frisbee throw",
      "Sit and talk",
    ]);
    expect(d?.templateSteps).toBe(0);
    expect(d?.repaired).toContain("labels:sentence case");
  });

  it("still replaces a capitalised word the ask does not contain in a sentence-case answer", () => {
    const d = enforceLadder(answer(["Walk to Dearborn Mall", "Short loop", "Quick lap", "Sit by water"]), {
      ask: "Fairlane walk",
      total_minutes: 60,
    });
    expect(d?.ladder[0]?.label).toBe("The full plan");
    expect(d?.templateSteps).toBe(1);
  });

  it("keeps a place the ask names, and still checks all-caps words in a Title Case answer", () => {
    const d = enforceLadder(
      answer(["Ford Woods Park Frisbee", "Short Frisbee Toss", "Walk By WDDA Lawn", "Quick Sit Down"]),
      L13,
    );
    expect(d?.ladder.map((s) => s.label)).toEqual([
      "Ford Woods Park frisbee",
      "Short frisbee toss",
      "A quick lap", // WDDA is not in the ask
      "Quick sit down",
    ]);
  });

  it("an invented place in a Title Case answer is still caught ('Walk To Dearborn Mall')", () => {
    const d = enforceLadder(
      answer(["Walk To Dearborn Mall", "Short Park Walk", "Quick Frisbee Throw", "Long Walk By Rouge River"]),
      { ask: "Walk by the Rouge River", total_minutes: 60 },
    );
    expect(d?.ladder.map((s) => s.label)).toEqual([
      "The full plan",
      "Short park walk",
      "Quick frisbee throw",
      "Long walk by Rouge", // clipped to 4 words; Rouge is in the ask
    ]);
  });

  it("an answer of invented places in sentence case is still refused", () => {
    const bad = answer(["Walk to Paris", "Walk to Rome", "Walk to Oslo", "Walk to Bern"]);
    expect(enforceLadder(bad, { ask: "Fairlane walk", total_minutes: 60 })).toBeNull();
  });

  it("one Title Case label among sentence-case ones is not a style: it is checked as written", () => {
    const d = enforceLadder(answer(["Walk To Paris", "Short loop", "Quick lap", "Sit by water"]), {
      ask: "walk",
      total_minutes: 60,
    });
    expect(d?.ladder[0]?.label).toBe("The full plan");
  });
});
