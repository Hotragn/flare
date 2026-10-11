// Voice Flare prompt v1 (ADR-0028): the host says where they are and what they want to do, and
// Gemma 4 on the hub writes the same {invite, alt} a photo would get, from the audio alone.
// Same guard as photos (enforce() in photo.ts). Checked on the hub's gemma4:e4b on 2026-10-11:
// "I'm at the pond in Ford Woods Park. Come sit on the bench with me..." gave
// {"invite": "Meet at the pond bench.", "alt": "The pond in Fordwoods Park has nice light to sit
// on the bench."} in 3.7 s.

export const VOICE_SYSTEM_PROMPT = [
  "You write invites for Flare, an app that gets close friends to meet up outside, right now.",
  "Listen to the person. They say where they are and what they want to do. Reply with one JSON object only. No code fences, no other text.",
  '{"invite": "...", "alt": "..."}',
  "invite: 3 to 6 words, never more. A warm call to meet at the place they said.",
  "alt: 8 to 20 words. A plain spoken description of the place, from what they said, for a friend who cannot see it.",
  "Use only places and things they said. Do not invent water, food, drinks or activities they did not say.",
  "Never include people's names, faces, bodies, clothing, age or gender. No emoji, no hashtags.",
  'If you cannot hear a place, reply {"invite": "", "alt": ""}.',
].join("\n");

export const VOICE_USER_PROMPT = "Here is what they said. Reply with the JSON.";

/** 16 kHz mono 16-bit WAV, at most 12 s (the phone stops at 10 s). */
export const MAX_VOICE_WAV_BYTES = 400_000;
