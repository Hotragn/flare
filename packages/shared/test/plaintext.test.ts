import { describe, expect, it } from "vitest";
import { CODE_RE, newCode } from "../src/codes.ts";
import {
  byteLength,
  capBytes,
  encodePlain,
  encodePlainLit,
  encodePlainPlan,
  MAX_BYTES,
  parseReply,
  plainTime,
} from "../src/plaintext.ts";

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

describe("plain-text contract cases (plain-text.md rules 1 to 6)", () => {
  it("BR-CH-2: a long Plan ask is cut and the tail stays whole", () => {
    const s = encodePlainPlan({ code: "K7Q2M", ask: "Long walk around the lake? ".repeat(10), need: 4, by: "10:40AM" });
    expect(byteLength(s)).toBeLessThanOrEqual(MAX_BYTES);
    expect(s.endsWith("... Need 4 more. Reply IN K7Q2M by 10:40AM")).toBe(true);
    expect(s).toMatch(GSM7);
  });
  it("rule 1: the host name is capped at 40 bytes without breaking a character", () => {
    const s = encodePlainLit({ code: "K7Q2M", host: "Ñ".repeat(30), spot: "pond" });
    expect(s).toBe(`LIT K7Q2M ${"Ñ".repeat(20)} is at pond.`);
    expect(capBytes("😀😀😀", 9)).toBe("😀😀");
  });
  it("rule 2: a cut never ends in the one-character ellipsis", () => {
    const s = encodePlain({ code: "K7Q2M", spot: "a ".repeat(300), need: 1, ends: "3:40PM" });
    expect(s).not.toContain("\u2026");
    expect(byteLength(s)).toBeLessThanOrEqual(MAX_BYTES);
  });
  it("rule 3: refuses codes with 0, 1, I, L, O or the wrong length", () => {
    for (const code of ["K7Q2", "K7Q2MM", "K7QI2", "K7QL2", "K7QO2", "K7Q12", "k7q2m"])
      expect(() => encodePlain({ code, spot: "a", need: 1, ends: "1:00PM" })).toThrow();
  });
  it("rule 4: time is h:mmAM in the group time zone with no space", () => {
    expect(plainTime("2026-10-11T19:40:00.000Z", "America/Detroit")).toBe("3:40PM");
    expect(plainTime("2026-10-11T14:40:00.000Z", "America/Detroit")).toBe("10:40AM");
    expect(plainTime("2026-10-11T04:05:00.000Z", "America/Detroit")).toBe("12:05AM");
    expect(plainTime("2026-10-11T19:40:00.000Z", "Europe/London")).toBe("8:40PM");
  });
  it("rule 5: runs of whitespace and line breaks in a field become one space", () => {
    expect(encodePlain({ code: "K7Q2M", spot: "  Ford\n\tWoods   Park  ", need: 1, ends: "3:40PM" })).toBe(
      "FLARE K7Q2M Ford Woods Park. Need 1 more. Reply IN K7Q2M. Ends 3:40PM",
    );
    expect(encodePlainLit({ code: "K7Q2M", host: " Fu  ego ", spot: "pond" })).toBe("LIT K7Q2M Fu ego is at pond.");
  });
  it("rule 6: reply parsing accepts tabs and line breaks, refuses anything extra", () => {
    expect(parseReply("In\tK7q2m\n")).toBe("K7Q2M");
    expect(parseReply("IN K7Q2M please")).toBeNull();
    expect(parseReply("INK7Q2M")).toBeNull();
    expect(parseReply("IN K7QI2")).toBeNull();
    expect(parseReply("")).toBeNull();
  });
  it("BR-CH-2: every form is at most 200 bytes for 500 random long inputs", () => {
    const pool = ["a", "é", "😀", " ", "Ford", "中"];
    for (let i = 0; i < 500; i++) {
      const field = Array.from({ length: 50 + (i % 200) }, (_, j) => pool[(i * 7 + j) % pool.length]).join("");
      const code = newCode();
      for (const s of [
        encodePlain({ code, spot: field, need: 4, ends: "11:59PM" }),
        encodePlainPlan({ code, ask: field, need: 5, by: "11:59PM" }),
        encodePlainLit({ code, host: field, spot: field }),
      ]) {
        expect(byteLength(s)).toBeLessThanOrEqual(MAX_BYTES);
        expect(s).not.toContain("\uFFFD");
      }
    }
  });
});
