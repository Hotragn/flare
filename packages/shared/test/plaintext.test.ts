import { describe, expect, it } from "vitest";
import { CODE_RE, newCode } from "../src/codes.ts";
import { byteLength, encodePlain, encodePlainLit, encodePlainPlan, MAX_BYTES, parseReply } from "../src/plaintext.ts";

const GSM7 = /^[A-Za-z0-9 @$_!"#%&'()*+,\-./:;<=>?\n]*$/;

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
  it("keeps an ASCII spot in GSM-7 even when cut", () => {
    const cut = encodePlain({
      code: "K7Q2M",
      spot: "Henry Ford Academy and Windmill Park ".repeat(6),
      need: 2,
      ends: "3:40PM",
    });
    expect(byteLength(cut)).toBeLessThanOrEqual(MAX_BYTES);
    expect(cut).toMatch(GSM7);
    expect(cut).toContain(".... Need 2 more."); // the "..." cut mark, then the period after the spot
    expect(cut.endsWith(". Need 2 more. Reply IN K7Q2M. Ends 3:40PM")).toBe(true);
  });
  it("never splits a multi-byte character", () => {
    const s = encodePlain({ code: "K7Q2M", spot: "😀".repeat(80), need: 1, ends: "3:40PM" });
    expect(s).not.toContain("\uFFFD");
    expect(new TextDecoder("utf-8", { fatal: true }).decode(new TextEncoder().encode(s))).toBe(s);
  });
  it("formats a Plan and a Lit line", () => {
    expect(encodePlainPlan({ code: "K7Q2M", ask: "Fairlane walk at 11?", need: 2, by: "10:40AM" })).toBe(
      "PLAN K7Q2M Fairlane walk at 11? Need 2 more. Reply IN K7Q2M by 10:40AM",
    );
    expect(encodePlainLit({ code: "K7Q2M", host: "Fuego", spot: "Ford Woods Park pond" })).toBe(
      "LIT K7Q2M Fuego is at Ford Woods Park pond.",
    );
    expect(byteLength(encodePlainLit({ code: "K7Q2M", host: "Fuego", spot: "x".repeat(400) }))).toBe(MAX_BYTES);
  });
  it("refuses a bad code", () => {
    expect(() => encodePlain({ code: "K7Q20", spot: "a", need: 1, ends: "1PM" })).toThrow();
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
