import { describe, expect, it } from "vitest";
import { scan } from "../lib/secrets.ts";

// Fakes built at run time so this file itself never matches the scanner.
const tg = `${"1234567890"}:${"A".repeat(35)}`;
const mongo = ["mongodb+srv://", "user:", "pw", "@cluster0.example.net"].join("");

describe("secret scan", () => {
  it("finds token shapes and reports no text", () => {
    const f = scan("x.ts", `ok\nconst t = "${tg}";\nconst u = "${mongo}";`);
    expect(f.map((x) => x.rule)).toEqual(["telegram-bot-token", "mongodb-uri-with-password"]);
    expect(JSON.stringify(f)).not.toContain(tg);
  });
  it("finds a known local value anywhere", () => {
    const f = scan("a.md", "the secret is s3cr3t-hub-value-xyz here", [
      { key: "HUB_SECRET", value: "s3cr3t-hub-value-xyz" },
    ]);
    expect(f).toEqual([{ file: "a.md", line: 1, rule: "value-of-HUB_SECRET" }]);
  });
  it("ignores short values and clean text", () => {
    expect(scan("a.md", "PORT=8787", [{ key: "PORT", value: "8787" }])).toEqual([]);
  });
});
