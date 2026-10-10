import { describe, expect, it } from "vitest";
import { CODE_RE, newCode } from "../src/codes.ts";
import { byteLength, encodePlain, MAX_BYTES, parseReply } from "../src/plaintext.ts";

describe("plain-text Flare", () => {
  it("matches the PRD example", () => {
    expect(encodePlain({ code: "K7Q2M", spot: "Ford Woods Park pond", need: 1, ends: "3:40PM" })).toBe(
      "FLARE K7Q2M Ford Woods Park pond. Need 1 more. Reply IN K7Q2M. Ends 3:40PM",
    );
  });
  it("never exceeds 200 bytes and truncates with ASCII dots", () => {
    const long = encodePlain({ code: "K7Q2M", spot: "é".repeat(150), need: 3, ends: "11:05AM" });
    expect(byteLength(long)).toBeLessThanOrEqual(MAX_BYTES);
    expect(long).toContain("...");
  });
  it("parses replies", () => {
    expect(parseReply("in k7q2m")).toBe("K7Q2M");
    expect(parseReply(" IN   K7Q2M ")).toBe("K7Q2M");
    expect(parseReply("IN K7Q20")).toBeNull();
    expect(parseReply("yes")).toBeNull();
  });
  it("makes valid short codes", () => {
    for (let i = 0; i < 200; i++) expect(newCode()).toMatch(CODE_RE);
  });
});
