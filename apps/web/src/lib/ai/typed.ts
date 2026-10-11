// OD4: the typed fallback (rules tier for the photo draft). A six-word field with chips made
// from the map pack's named places near the spot. Works offline: no network, no model.
import { countWords, TEMPLATE_INVITE } from "@flare/shared";
import { t } from "./copy.ts";

export const MAX_INVITE_WORDS = 6; // SRS-AI-2, BR-AI-2
const MAX_CHIPS = 4;

export type TypedCheck = { ok: true; invite: string; words: number } | { ok: false; words: number; error: string };

/** Cleans what the person typed: no emoji or hashtags, single spaces, at most six words. */
export function checkTyped(text: string): TypedCheck {
  const invite = text
    .replace(/[#\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]|\u{FE0F}|\u{200D}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  const words = countWords(invite);
  if (words === 0) return { ok: false, words, error: t("develop.empty") };
  if (words > MAX_INVITE_WORDS) return { ok: false, words, error: t("develop.tooLong") };
  return { ok: true, invite, words };
}

/** The template line for a spot, if it fits six words; else the plain template (FR-AI-1). */
export function templateFor(spot: string | null): string {
  if (spot) {
    const line = t("develop.template", { spot: spot.trim() });
    if (countWords(line) <= MAX_INVITE_WORDS) return line;
  }
  return TEMPLATE_INVITE;
}

/**
 * Chips for the typed field: the spot's template first, then up to three more named places
 * from the map pack (nearest first, as the caller orders them). Each chip fits six words.
 */
export function typedChips(spot: string | null, nearbyNames: (string | null)[]): string[] {
  const out: string[] = [templateFor(spot)];
  for (const name of nearbyNames) {
    if (out.length >= MAX_CHIPS) break;
    if (!name || name === spot) continue;
    const line = templateFor(name);
    if (line !== TEMPLATE_INVITE && !out.includes(line)) out.push(line);
  }
  return out;
}
