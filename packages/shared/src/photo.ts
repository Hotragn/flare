// Photo-to-invite task: prompt v2 and the deterministic guard.
// Ported from the lab spike (lab/spikes/common/validate.mjs, report 02): prompt v2 gave
// 20/20 parsed answers on gemma4:e4b-it-q4_K_M and enforce() made 20/20 usable.

import { z } from "zod";
import { clipWords, countWords, extractJson, hasPersonWords, type PromptSpec } from "./prompts/guard.ts";

export { countWords, extractJson };

/** Prompt version. Any change to SYSTEM_PROMPT bumps it and needs a new evals/reports/photo run. */
export const PHOTO_PROMPT_VERSION = 2;

export const SYSTEM_PROMPT = [
  "You write invites for Flare, an app that gets close friends to meet up outside, right now.",
  "Look at the photo of the spot. Reply with one JSON object only. No code fences, no other text.",
  '{"invite": "...", "alt": "..."}',
  "invite: 3 to 6 words, never more. A warm call to meet at this exact spot.",
  "alt: 8 to 20 words. A plain spoken description of the place for a friend who cannot see the photo.",
  "Mention only things clearly visible. Do not invent water, food, drinks or activities you cannot see.",
  'Describe the place only. Never describe faces, bodies, clothing, age, gender or who anyone is. If people appear, say "people" or "a group".',
  "No names, no emoji, no hashtags.",
  'Example: {"invite": "Golden hour at the rooftop garden", "alt": "A rooftop garden with raised flower beds, wooden chairs and a low railing above the city."}',
].join("\n");

export const USER_PROMPT = "Here is the photo. Reply with the JSON.";

/** Template used when the hub is unreachable or the answer can't be used (FR-AI-1 rules tier). */
export const TEMPLATE_INVITE = "Outside right now. Come?";

/** Raw answer shape before the guard. Extra keys are ignored. */
export const PhotoAnswer = z.object({ invite: z.string(), alt: z.string() });

/** Guarded draft shape the hub returns and the server re-checks (asyncapi result.draft). */
export const PhotoDraft = z.object({
  invite: z
    .string()
    .min(1)
    .refine((s) => countWords(s) <= 6, "invite over 6 words"),
  alt: z
    .string()
    .min(1)
    .refine((s) => countWords(s) <= 20, "alt over 20 words"),
});

export type Draft = { invite: string; alt: string; repaired: string[] };

/**
 * Guard every model answer before it is shown or spoken (SRS-AI-2, SRS-AI-3, BR-AI-2).
 * Clips to 6 and 20 words, strips emoji and hashtags, and rejects any answer that
 * describes faces or identity. Returns null when the answer can't be used.
 */
export function enforce(text: string): Draft | null {
  const parsed = PhotoAnswer.safeParse(extractJson(text));
  if (!parsed.success) return null;
  const repaired: string[] = [];
  const invite = clipWords(parsed.data.invite, 6, "invite", repaired).replace(/[.]+$/, "");
  const alt = clipWords(parsed.data.alt, 20, "alt", repaired);
  if (!invite || !alt) return null;
  if (hasPersonWords(`${invite} ${alt}`)) return null;
  return { invite, alt, repaired };
}

/** The photo prompt as a versioned spec for the hub (ODAI calls it; budget from BR-AI-1). */
export const PHOTO_PROMPT: PromptSpec & { user: string } = {
  id: "photo-invite",
  version: PHOTO_PROMPT_VERSION,
  system: SYSTEM_PROMPT,
  user: USER_PROMPT,
  budgetMs: 6000,
  numPredict: 128,
};
