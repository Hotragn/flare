import { describe, expect, it } from "vitest";
import { check, failed, format } from "../lib/env-spec.ts";

const SECRET = "s3cr3t-value-that-must-never-print-0123456789";
const TOKEN = "123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsawZ";

describe("env check", () => {
  it("reports set and missing without values", () => {
    const lines = check({ HUB_SECRET: SECRET, PUBLIC_BASE_URL: "https://flare.example" }, ["server", "hub"]);
    const text = format(lines);
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain("flare.example");
    expect(lines.find((l) => l.key === "HUB_SECRET" && l.app === "hub")?.status).toBe("set");
    expect(lines.find((l) => l.key === "DATABASE_URL")?.status).toBe("default");
    expect(failed(lines)).toBe(false);
  });
  it("fails on a required key that is missing", () => {
    const lines = check({}, ["bot"]);
    expect(lines.find((l) => l.key === "TELEGRAM_BOT_TOKEN")?.status).toBe("missing");
    expect(failed(lines)).toBe(true);
  });
  it("flags a bad shape with a reason that does not echo the value", () => {
    const lines = check({ HUB_SECRET: "short", TELEGRAM_BOT_TOKEN: "nope-token", DATABASE_URL: "mysql://x" }, ["server", "bot"]);
    const text = format(lines);
    expect(text).toContain("shorter than 32 characters");
    expect(text).toContain("not a bot token shape");
    expect(text).toContain("scheme must be postgres or postgresql");
    expect(text).not.toContain("short\n");
    expect(text).not.toContain("nope-token");
    expect(text).not.toContain("mysql");
  });
  it("accepts a real token shape", () => {
    const lines = check({ TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_BOT_USERNAME: "flare_bot", PUBLIC_BASE_URL: "http://localhost:8787" }, ["bot"]);
    expect(failed(lines)).toBe(false);
    expect(format(lines)).not.toContain(TOKEN);
  });
});
