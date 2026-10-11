// Small pure pieces of the bot: settings, the secret check, link building, clock format.
import { describe, expect, it } from "vitest";
import { parseChatIds, secretOk, telegramEnv } from "../../src/telegram/index.ts";
import { clock, withQuery } from "../../src/telegram/render.ts";

const TOKEN = "123456789:AAfakeTokenForTestsOnly_abcdefghijklmn";

describe("bot settings", () => {
  it("BR-CH-1: parses the allow-list and ignores junk", () => {
    expect([...parseChatIds(" -1001, -1002 ,x, ,42")]).toEqual([-1001, -1002, 42]);
    expect(parseChatIds(undefined).size).toBe(0);
  });
  it("telegramEnv is null unless token, secret and username are all valid", () => {
    expect(telegramEnv({})).toBeNull();
    expect(telegramEnv({ TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_BOT_USERNAME: "B" })).toBeNull();
    const ok = telegramEnv({
      TELEGRAM_BOT_TOKEN: TOKEN,
      TELEGRAM_BOT_USERNAME: "FairlaneFlareBot",
      TELEGRAM_WEBHOOK_SECRET: "s".repeat(32),
      TELEGRAM_ALLOWED_CHAT_IDS: "-100123",
    });
    expect(ok?.allowedChatIds.has(-100123)).toBe(true);
  });
  it("SRS-CH-1: the secret check needs an exact match of any length", () => {
    expect(secretOk("abc_defghijklmnop", "abc_defghijklmnop")).toBe(true);
    expect(secretOk("abc_defghijklmno", "abc_defghijklmnop")).toBe(false);
    expect(secretOk(undefined, "abc")).toBe(false);
    expect(secretOk("", "")).toBe(false);
  });
});

describe("links and times", () => {
  it("adds query parameters before the key fragment", () => {
    expect(withQuery("https://f.test/g/1#k=abc", { via: "tg", bind: "t" })).toBe(
      "https://f.test/g/1?via=tg&bind=t#k=abc",
    );
    expect(withQuery("https://f.test/g/1?x=1#k=abc", { via: "tg" })).toBe("https://f.test/g/1?x=1&via=tg#k=abc");
  });
  it("formats times in the group time zone with a plain space", () => {
    expect(clock("2026-10-11T18:44:00.000Z", "America/Detroit")).toBe("2:44 PM");
    expect(clock("2026-10-11T18:44:00.000Z", "America/Los_Angeles")).toBe("11:44 AM");
  });
});
