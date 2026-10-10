// Plain-text form of a Flare for SMS and satellite texting (FR-CH-4, BR-CH-2, BR-CH-3).
//   FLARE K7Q2M Ford Woods Park pond. Need 1 more. Reply IN K7Q2M. Ends 3:40PM
// At most 200 bytes UTF-8. If the spot name is too long it is cut and marked "..."
// (ASCII, so the text stays GSM-7; change request from handoff 06, accepted in ADR-0012).
import { CODE_RE } from "./codes.ts";

export const MAX_BYTES = 200;
const enc = new TextEncoder();
export const byteLength = (s: string): number => enc.encode(s).length;

export type PlainFlare = { code: string; spot: string; need: number; ends: string };

export function encodePlain({ code, spot, need, ends }: PlainFlare): string {
  if (!CODE_RE.test(code)) throw new Error("bad code");
  const tail = ` Need ${need} more. Reply IN ${code}. Ends ${ends}`;
  const head = `FLARE ${code} `;
  const room = MAX_BYTES - byteLength(head) - byteLength(tail) - 1; // 1 for the period after the spot
  let name = spot.trim().replace(/\s+/g, " ");
  if (byteLength(name) > room) {
    const chars = [...name];
    while (chars.length && byteLength(`${chars.join("")}...`) > room) chars.pop();
    name = `${chars.join("").trimEnd()}...`;
  }
  return `${head}${name}.${tail}`;
}

/** Parses a reply like "IN K7Q2M" (case-insensitive, extra spaces allowed). Returns the code or null. */
export function parseReply(text: string): string | null {
  const m = text
    .trim()
    .toUpperCase()
    .match(/^IN\s+([A-Z0-9]{5})$/);
  return m?.[1] && CODE_RE.test(m[1]) ? m[1] : null;
}
