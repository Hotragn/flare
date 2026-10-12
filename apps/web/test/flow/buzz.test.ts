import { describe, expect, it } from "vitest";
import { t } from "../../src/lib/copy/index.ts";
import { buzzMode, sentBodyKey } from "../../src/lib/push/buzz.ts";

describe("live bug 5: the Sent screen never promises a buzz without push", () => {
  it("no subscription: no buzz promise, Telegram or keep-open instead", () => {
    for (const telegram of [false, true]) {
      const line = t(sentBodyKey(buzzMode({ push: false, telegram })));
      expect(line).not.toMatch(/buzz/i);
    }
    expect(t(sentBodyKey(buzzMode({ push: false, telegram: true })))).toMatch(/Telegram/);
  });
  it("a live subscription keeps the buzz line", () => {
    expect(t(sentBodyKey(buzzMode({ push: true, telegram: false })))).toMatch(/buzz/i);
  });
});
