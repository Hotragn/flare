// Plain-text forms for SMS and satellite texting (FR-CH-4, BR-CH-2, BR-CH-3), spec in
// docs/architecture/contracts/plain-text.md. Built on the host's phone; the server never
// sees them.
//   FLARE K7Q2M Ford Woods Park pond. Need 1 more. Reply IN K7Q2M. Ends 3:40PM
//   PLAN K7Q2M Fairlane walk at 11? Need 2 more. Reply IN K7Q2M by 10:40AM
//   LIT K7Q2M Fuego is at Ford Woods Park pond.
// At most 200 bytes UTF-8. If the free field is too long it is cut and marked "..."
// (ASCII, so the text stays GSM-7; change request from handoff 06, accepted in ADR-0012).
import { CODE_RE } from "./codes.ts";

export const MAX_BYTES = 200;
const enc = new TextEncoder();
export const byteLength = (s: string): number => enc.encode(s).length;

export type PlainFlare = { code: string; spot: string; need: number; ends: string };
export type PlainPlan = { code: string; ask: string; need: number; by: string };
export type PlainLit = { code: string; host: string; spot: string };

/** Fits `field` between `head` and `tail` in MAX_BYTES, cutting whole code points. */
function fit(head: string, field: string, tail: string): string {
  const room = MAX_BYTES - byteLength(head) - byteLength(tail);
  let text = field.trim().replace(/\s+/g, " ");
  if (byteLength(text) > room) {
    const chars = [...text];
    while (chars.length && byteLength(`${chars.join("").trimEnd()}...`) > room) chars.pop();
    text = `${chars.join("").trimEnd()}...`;
  }
  return `${head}${text}${tail}`;
}

function checkCode(code: string): void {
  if (!CODE_RE.test(code)) throw new Error("bad code");
}

export function encodePlain({ code, spot, need, ends }: PlainFlare): string {
  checkCode(code);
  return fit(`FLARE ${code} `, spot, `. Need ${need} more. Reply IN ${code}. Ends ${ends}`);
}

export function encodePlainPlan({ code, ask, need, by }: PlainPlan): string {
  checkCode(code);
  return fit(`PLAN ${code} `, ask, ` Need ${need} more. Reply IN ${code} by ${by}`);
}

/** Cuts to at most `max` bytes of UTF-8 on a code-point boundary (no cut mark). */
export function capBytes(s: string, max: number): string {
  const chars = [...s];
  while (chars.length && byteLength(chars.join("")) > max) chars.pop();
  return chars.join("");
}

/** The host name is short (40 bytes at most, enforced by the create form); the spot takes the cut. */
export function encodePlainLit({ code, host, spot }: PlainLit): string {
  checkCode(code);
  const name = capBytes(host.trim().replace(/\s+/g, " "), 40).trimEnd();
  return fit(`LIT ${code} ${name} is at `, spot, ".");
}

/** `{time}` for the forms (rule 4): "3:40PM" in the group time zone, no space. */
export function plainTime(at: string | Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone })
    .formatToParts(new Date(at))
    .filter((p) => p.type !== "literal" || p.value === ":");
  return parts.map((p) => (p.type === "dayPeriod" ? p.value.toUpperCase() : p.value)).join("");
}

/** Parses a reply like "IN K7Q2M" (case-insensitive, extra spaces allowed). Returns the code or null. */
export function parseReply(text: string): string | null {
  const m = text
    .trim()
    .toUpperCase()
    .match(/^IN\s+([A-Z0-9]{5})$/);
  return m?.[1] && CODE_RE.test(m[1]) ? m[1] : null;
}
