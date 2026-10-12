// ICD-7: the on-phone conditions parser (work package ODAI), used by the frontend.
// Frozen v1. Rules only, no model (ADR-0007, lab 07: 40/40 core, 15/20 hard).
import type { Iso, Rule, Step } from "./engine.ts";

export type ParseContext = {
  /** Members' names already opened on this phone, to resolve with(...) (BR-C-3). */
  members: { id: string; name: string }[];
  tz: string; // group time zone (BR-TIME-2)
  now: Iso; // server-corrected now
  kind: "flare" | "plan";
  steps?: { step: Step; name: string }[]; // Plans: for "the short one", "step 3 or smaller"
  host?: string; // the host's name: "only with you" means them (live bug, Oct 11)
};

export type ParseResult =
  | { ok: true; rules: Rule[]; readBack: string; missed?: string } // ≤ 12 words (SRS-COND-5); missed: words it couldn't read
  | { ok: false; reason: "didnt_catch" | "not_in_group" | "too_many"; name?: string };

export interface Conditions {
  parse(text: string, ctx: ParseContext): ParseResult;
  readBack(rules: Rule[], ctx: ParseContext): string;
  /** Tap-to-fill rules after a miss (optional; live bug, Oct 11). */
  suggestions?(ctx: ParseContext): { label: string; text: string }[];
}
