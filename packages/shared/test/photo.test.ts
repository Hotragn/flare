import { describe, expect, it } from "vitest";
import { countWords, enforce } from "../src/photo.ts";

describe("enforce", () => {
  it("accepts a good answer unchanged", () => {
    const d = enforce('{"invite":"Golden pond, come sit","alt":"A pond with yellow trees and an empty wooden bench."}');
    expect(d).toEqual({
      invite: "Golden pond, come sit",
      alt: "A pond with yellow trees and an empty wooden bench.",
      repaired: [],
    });
  });
  it("clips long fields and strips emoji and hashtags", () => {
    const d = enforce(
      '```json\n{"invite":"Come down to the big old pond right now please 🌳 #fall","alt":"one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twentyone"}\n```',
    );
    expect(d && countWords(d.invite)).toBe(6);
    expect(d && countWords(d.alt)).toBe(20);
    expect(d?.repaired.length).toBe(2);
    expect(d?.invite).not.toMatch(/#|🌳/u);
  });
  it("rejects answers that describe people", () => {
    expect(enforce('{"invite":"Meet the smiling woman","alt":"A woman with a hat by the pond."}')).toBeNull();
  });
  it("rejects non-JSON", () => {
    expect(enforce("I cannot see the photo")).toBeNull();
  });
});
