// Dark photos are brightened for display only (photo-fit fix). Pure parts: the mean luma and
// the filter it picks.
import { describe, expect, it } from "vitest";
import { DARK, filterFor, meanLuma } from "../../src/lib/photo-light.ts";

const px = (r: number, g: number, b: number, a = 255, n = 16) => Array.from({ length: n }, () => [r, g, b, a]).flat();

describe("photo light", () => {
  it("measures mean luma from 0 to 1", () => {
    expect(meanLuma(px(0, 0, 0))).toBe(0);
    expect(meanLuma(px(255, 255, 255))).toBeCloseTo(1);
    expect(meanLuma(px(0, 255, 0))).toBeCloseTo(0.7152);
    expect(meanLuma([...px(255, 255, 255, 255, 2), ...px(0, 0, 0, 255, 2)])).toBeCloseTo(0.5);
  });
  it("skips transparent pixels and treats an empty image as bright", () => {
    expect(meanLuma([...px(255, 255, 255, 255, 4), ...px(0, 0, 0, 0, 4)])).toBeCloseTo(1);
    expect(meanLuma([])).toBe(1);
  });
  it("leaves bright photos alone", () => {
    expect(filterFor(DARK)).toBe("");
    expect(filterFor(0.6)).toBe("");
    expect(filterFor(Number.NaN)).toBe("");
  });
  it("brightens dark photos, more for darker ones, at most 1.6", () => {
    expect(filterFor(0.25)).toBe("brightness(1.20) contrast(1.03)");
    expect(filterFor(0.15)).toBe("brightness(1.40) contrast(1.06)");
    expect(filterFor(0.02)).toBe("brightness(1.60) contrast(1.09)");
    expect(filterFor(0)).toBe("brightness(1.60) contrast(1.09)");
  });
});
