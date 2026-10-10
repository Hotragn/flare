// Photo-to-invite task: prompt v2 and the deterministic guard.
// Ported from the lab spike (lab/spikes/common/validate.mjs, report 02): prompt v2 gave
// 20/20 parsed answers on gemma4:e4b-it-q4_K_M and enforce() made 20/20 usable.

const FACE = /\b(faces?|facial|smil(e|es|ing)|grin(s|ning)?|eyes|expressions?|beards?|mustaches?|frown(s|ing)?)\b/i;
const IDENTITY =
  /\b(man|men|woman|women|boys?|girls?|guys?|lady|ladies|gentlem[ae]n|he|she|his|her|hers|him|male|female|elderly|teen(ager)?s?|young (man|woman|people)|old (man|woman)|blonde?|brunette|caucasian|asian|black (man|woman|people)|white (man|woman|people)|hispanic|latin[oa]|african|ethnic\w*|bald)\b/i;

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

export const countWords = (s: string): number =>
  (s.trim().match(/[^\s]+/g) ?? []).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

export function extractJson(text: string): unknown {
  const t = text.trim();
  try {
    return JSON.parse(t);
  } catch {
    const m = t.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
}

export type Draft = { invite: string; alt: string; repaired: string[] };

/**
 * Guard every model answer before it is shown or spoken (SRS-AI-2, SRS-AI-3, BR-AI-2).
 * Clips to 6 and 20 words, strips emoji and hashtags, and rejects any answer that
 * describes faces or identity. Returns null when the answer can't be used.
 */
export function enforce(text: string): Draft | null {
  const obj = extractJson(text) as { invite?: unknown; alt?: unknown } | null;
  if (!obj || typeof obj.invite !== "string" || typeof obj.alt !== "string") return null;
  const repaired: string[] = [];
  const clip = (s: string, n: number, key: string) => {
    const w = s
      .replace(/[#\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (w.length > n) repaired.push(`${key}:clipped ${w.length}->${n}`);
    return w
      .slice(0, n)
      .join(" ")
      .replace(/[,;:-]+$/, "");
  };
  const invite = clip(obj.invite, 6, "invite").replace(/[.]+$/, "");
  const alt = clip(obj.alt, 20, "alt");
  if (!invite || !alt) return null;
  if (FACE.test(`${invite} ${alt}`) || IDENTITY.test(`${invite} ${alt}`)) return null;
  return { invite, alt, repaired };
}
