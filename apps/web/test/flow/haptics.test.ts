// Haptics on the iPhone (device check, iPhone 16 Pro Max, iOS 26.6.1): a switch toggled by the
// tester's own finger was not felt, and WebKit ignores script clicks on a switch from 26.5. So
// the script path is skipped there, and every moment with a haptic also has a sound.
import { afterEach, describe, expect, it, vi } from "vitest";

const IOS_26_6 =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6.1 Mobile/15E148 Safari/604.1";
const IOS_26_4 = IOS_26_6.replace("Version/26.6.1", "Version/26.4");

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("haptics paths", () => {
  it("reads the Safari version from the user agent", async () => {
    const { iosSafariVersion, scriptSwitchWorks } = await import("../../src/lib/motion/haptics.ts");
    expect(iosSafariVersion(IOS_26_6)).toBeCloseTo(26.06);
    expect(scriptSwitchWorks(IOS_26_6)).toBe(false);
    expect(scriptSwitchWorks(IOS_26_4)).toBe(true);
    expect(scriptSwitchWorks("Mozilla/5.0 (Linux; Android 15) Chrome/140")).toBe(true);
  });

  it("every haptic moment also plays its sound, facing included", async () => {
    const played: string[] = [];
    const felt: string[] = [];
    vi.doMock("../../src/lib/motion/sound.ts", () => ({ play: (n: string) => played.push(n) }));
    vi.doMock("../../src/lib/motion/haptics.ts", () => ({
      haptic: (k: string) => {
        felt.push(k);
        return "vibrate";
      },
    }));
    const { feedback } = await import("../../src/lib/motion/feedback.ts");
    for (const m of ["yes", "lit", "facing"] as const) feedback(m);
    expect(felt).toEqual(["tap", "success", "facing"]);
    expect(played).toEqual(["yes", "lit", "facing"]); // even when the vibration worked
  });
});
