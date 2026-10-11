// Shared output guards for every model answer (BR-AI-2, FR-AI-4, FR-AI-5).
// Deterministic and model-free: the same checks run on the hub and again on the server.

/** Face and expression words. Any hit makes the answer unusable. */
export const FACE =
  /\b(faces?|facial|smil(e|es|ing)|grin(s|ning)?|eyes|expressions?|beards?|mustaches?|frown(s|ing)?)\b/i;

/**
 * Identity, age, gender, race, body and clothing words. "people", "a person" and "a group" are allowed.
 * Place words that look like people words stay allowed on purpose: "kids' playground", "tall trees",
 * "a body of water", "a couple of benches" (eval set photo-v2, failure modes in docs/ml/failure-modes.md).
 */
export const IDENTITY =
  /\b(man|men|woman|women|boys?|girls?|guys?|lady|ladies|gentlem[ae]n|he|she|his|her|hers|him|male|female|elderly|teen(ager)?s?|young (man|woman|people)|old (man|woman)|blonde?|brunette|caucasian|asian|black (man|woman|people)|white (man|woman|people)|hispanic|latin[oa]|african|ethnic\w*|bald|skinny|overweight|shirts?|jackets?|hats?|jeans|hoodies?|wearing|dressed|moms?|dads?|mothers?|fathers?|daughters?|wife|husband)\b/i;

/** True when the text mentions faces, identity, age, race, gender, bodies or clothing. */
export const hasPersonWords = (s: string): boolean => FACE.test(s) || IDENTITY.test(s);

/** Words that carry letters or digits; punctuation-only tokens do not count. */
export const countWords = (s: string): number =>
  (s.trim().match(/[^\s]+/g) ?? []).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

/** Parse a JSON value from model text, tolerating code fences and stray prose around one object or array. */
export function extractJson(text: string): unknown {
  const t = text.trim();
  try {
    return JSON.parse(t);
  } catch {
    const m = t.match(/[[{][\s\S]*[\]}]/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
}

const EMOJI_HASH = /[#\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]|\u{FE0F}|\u{200D}/gu;

/** Strip emoji and hashtags, collapse spaces, clip to n words. Pushes a repair note when clipped. */
export function clipWords(s: string, n: number, key: string, repaired: string[]): string {
  const w = s.replace(EMOJI_HASH, "").trim().split(/\s+/).filter(Boolean);
  if (w.length > n) repaired.push(`${key}:clipped ${w.length}->${n}`);
  return w
    .slice(0, n)
    .join(" ")
    .replace(/[,;:-]+$/, "");
}

/** Ollama request options shared by every hub prompt (lab 02, architecture 07 B3). */
export const OLLAMA_OPTIONS = { temperature: 0, seed: 42, num_predict: 128 } as const;

/** Model the hub runs. Changing it needs a new eval report (docs/ml/model-selection.md). */
export const HUB_MODEL = "gemma4:e4b-it-q4_K_M";

/** A versioned prompt: what the hub sends, with the guard that checks the answer. */
export type PromptSpec = {
  id: string;
  version: number;
  system: string;
  /** Hub budget in ms before the job falls to the next tier (BR-AI-1). */
  budgetMs: number;
  numPredict: number;
};
