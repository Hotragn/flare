// Remember this, summary prompt v1 (ADR-0031): Gemma 4 on the hub turns a short, consented
// transcript into one plain line. Hub only; with the hub off there is no summary and the
// transcript is never sent to a cloud model.

export const SUMMARY_SYSTEM = [
  "You read a short transcript of a few friends talking outside. Speakers are labelled Speaker 1, Speaker 2 and so on.",
  'Reply with one JSON object only, no other text: {"line": "..."}',
  "line: one sentence of 5 to 14 words saying what the moment was about, warm and plain.",
  "No names, no speaker labels, no phone numbers, addresses, health or money details, no quotes.",
  'If nothing clear was said, reply {"line": ""}.',
].join("\n");

export const summaryUserPrompt = (transcript: string) =>
  `Transcript:\n${transcript.slice(0, 4000)}\n\nReply with the JSON.`;

/** The guard both the hub and the server run. Returns the line or null. */
export function enforceSummary(raw: string): string | null {
  const m = /\{[\s\S]*\}/.exec(raw);
  if (!m) return null;
  let line: unknown;
  try {
    line = (JSON.parse(m[0]) as { line?: unknown }).line;
  } catch {
    return null;
  }
  if (typeof line !== "string") return null;
  const s = line.replace(/["“”]/g, "").replace(/\s+/g, " ").trim();
  const words = s.split(" ").filter(Boolean).length;
  if (words < 3 || words > 16) return null;
  if (/speaker\s*\d/i.test(s) || /\d[\d\s-]{6,}\d/.test(s) || /@|https?:/i.test(s)) return null;
  return s.slice(0, 140);
}
