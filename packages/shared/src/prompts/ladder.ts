// Plan ladder draft (FR-AI-9, SRS-PLAN-2, BR-P-4). Text in, 4 steps out, on the hub tier.
// The job carries only the ask, the total minutes and coarse weather (asyncapi ladderJob);
// places come from the phone's map pack, so the model writes labels and minutes only.
import { z } from "zod";
import { clipWords, countWords, extractJson, hasPersonWords, type PromptSpec } from "./guard.ts";

/** v1 used {"steps":[{step,label,minutes}...]} and took 6.4 to 8.8 s; v2 asks for two short arrays (docs/ml/model-cards.md). */
export const LADDER_PROMPT_VERSION = 2;

/** Fixed labels for the template tier. Same text as copy keys ladder.template.step1 to step4. */
export const TEMPLATE_LABELS = ["The full plan", "A shorter loop", "A quick lap", "Just say hi"] as const;

export const LADDER_SYSTEM = [
  "You plan short outings for Flare, an app that gets close friends outside.",
  "A Plan has 4 steps. Step 1 is the biggest version, step 4 the smallest. Friends pick the biggest step everyone can do.",
  "Reply with one JSON object only. No code fences, no other text.",
  '{"labels": ["...", "...", "...", "..."], "minutes": [60, 30, 15, 10]}',
  "labels: 4 labels, biggest first. Each is 2 to 4 plain words, lower case except the first letter. Say what the group does, like a walk, a loop or a sit.",
  "minutes: 4 whole numbers in the same order. Step 1 uses the total minutes given. Each step is shorter than the one before. Step 4 is at least 5.",
  "Use only places named in the ask. Never invent place names, shops, food or events.",
  "If rain is likely, prefer covered or short steps. Never mention people, names, faces, age or gender.",
].join("\n");

export const LadderInput = z.object({
  ask: z.string().max(80),
  total_minutes: z.number().int().min(40).max(600),
  weather: z.object({ rain_likely: z.boolean().optional(), temp_f: z.number().int().optional() }).optional(),
});
export type LadderInputT = z.infer<typeof LadderInput>;

export const LadderStep = z.object({
  step: z.number().int().min(1).max(4),
  label: z.string().min(1),
  minutes: z.number().int().min(5),
});
/** The guarded ladder (asyncapi result.ladder): 4 steps, 1..4 in order, strictly decreasing, labels ≤ 4 words. */
export const Ladder = z
  .array(LadderStep)
  .length(4)
  .refine((l) => l.every((s, i) => s.step === i + 1), "steps must be 1 to 4 in order")
  .refine((l) => l.every((s, i) => i === 0 || s.minutes < (l[i - 1]?.minutes ?? 0)), "minutes must decrease")
  .refine((l) => l.every((s) => countWords(s.label) <= 4), "labels ≤ 4 words");
export type LadderT = z.infer<typeof Ladder>;

/** Remove quotes and line breaks from the ask so it reads as data inside the prompt. */
export const cleanAsk = (ask: string): string =>
  ask
    .replace(/[\r\n\t"`{}<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);

export function ladderUserPrompt(input: LadderInputT): string {
  const lines = [`Ask: "${cleanAsk(input.ask)}"`, `Total minutes for step 1: ${input.total_minutes}`];
  const w = input.weather;
  if (w && (w.rain_likely !== undefined || w.temp_f !== undefined)) {
    const parts = [w.rain_likely ? "rain likely" : w.rain_likely === false ? "no rain expected" : null];
    if (w.temp_f !== undefined) parts.push(`${w.temp_f} F`);
    lines.push(`Weather: ${parts.filter(Boolean).join(", ")}`);
  }
  lines.push("Reply with the JSON.");
  return lines.join("\n");
}

export const LADDER_PROMPT: PromptSpec = {
  id: "ladder-draft",
  version: LADDER_PROMPT_VERSION,
  system: LADDER_SYSTEM,
  budgetMs: 8000,
  numPredict: 80,
};

const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);

/** Template minutes: total × 1, 0.5, 0.25, 0.125, rounded to 5, kept strictly decreasing (60 → 60, 30, 15, 10). */
export function templateMinutes(total: number): number[] {
  const m = [1, 0.5, 0.25, 0.125].map((f) => round5(total * f));
  m[0] = total;
  for (let i = 1; i < 4; i++) {
    const prev = m[i - 1] ?? 5;
    if ((m[i] ?? 0) >= prev) m[i] = prev - 5;
  }
  return m;
}

/** The template tier ladder (BR-AI-1 floor). Always valid for total_minutes 40 to 600. */
export function templateLadder(total: number): LadderT {
  const mins = templateMinutes(total);
  return TEMPLATE_LABELS.map((label, i) => ({ step: (i + 1) as 1 | 2 | 3 | 4, label, minutes: mins[i] ?? 5 }));
}

const STOP = new Set(["A", "An", "The", "I", "OK"]);

/**
 * Capitalised words not at the start of the label and not in the ask look like invented
 * place names (guardrail: never invent places). "Walk to Fairlane" passes when the ask says Fairlane.
 */
export function inventsNames(label: string, ask: string): boolean {
  const askWords = new Set((ask.match(/[\p{L}']+/gu) ?? []).map((w) => w.toLowerCase()));
  const words = label.match(/[\p{L}']+/gu) ?? [];
  return words.some((w, i) => i > 0 && /^\p{Lu}/u.test(w) && !STOP.has(w) && !askWords.has(w.toLowerCase()));
}

/** Accept v2 {labels, minutes}, v1 {steps: [...]}, or a bare array of steps. */
function toSteps(raw: unknown): unknown[] | null {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as { steps?: unknown; labels?: unknown; minutes?: unknown };
  if (Array.isArray(o.steps)) return o.steps;
  if (Array.isArray(o.labels)) {
    const mins = Array.isArray(o.minutes) ? o.minutes : [];
    return o.labels.map((label, i) => ({ label, minutes: mins[i] }));
  }
  return null;
}

export type LadderDraft = { ladder: LadderT; repaired: string[]; templateSteps: number };

/**
 * Guard a ladder answer (SRS-AI-2). Per step: a label that is empty, too long after clipping,
 * names a person or invents a place is replaced by the template label (FR-PLAN-4). Minutes
 * that break BR-P-4 are replaced as a set by the template minutes. Returns null when the
 * answer is not usable JSON or no model label survives, so the caller uses templateLadder().
 */
export function enforceLadder(text: string, input: LadderInputT): LadderDraft | null {
  const raw = extractJson(text);
  const list = toSteps(raw);
  if (!Array.isArray(list) || list.length < 4) return null;
  const repaired: string[] = [];
  if (list.length > 4) repaired.push(`steps:clipped ${list.length}->4`);
  const items = list.slice(0, 4) as { label?: unknown; minutes?: unknown }[];
  let templateSteps = 0;
  const seen = new Set<string>();
  const labels = items.map((it, i) => {
    const fallback = TEMPLATE_LABELS[i] ?? "Just say hi";
    if (typeof it?.label !== "string") {
      templateSteps++;
      repaired.push(`step${i + 1}:label template`);
      return fallback;
    }
    const l = clipWords(it.label, 4, `step${i + 1}`, repaired).replace(/[.!]+$/, "");
    const key = l.toLowerCase();
    const dup = seen.has(key);
    seen.add(key);
    // A repeated label would make two steps look the same on the ladder.
    if (!l || dup || hasPersonWords(l) || inventsNames(l, input.ask)) {
      templateSteps++;
      repaired.push(`step${i + 1}:label template`);
      return fallback;
    }
    return l;
  });
  if (templateSteps === 4) return null;
  let minutes = items.map((it) => (typeof it?.minutes === "number" ? Math.round(it.minutes) : Number.NaN));
  if (minutes[0] !== input.total_minutes && Number.isFinite(minutes[0])) {
    repaired.push(`step1:minutes ${minutes[0]}->${input.total_minutes}`);
    minutes[0] = input.total_minutes;
  }
  const ok = minutes.every((m, i) => Number.isFinite(m) && m >= 5 && (i === 0 || m < (minutes[i - 1] ?? 0)));
  if (!ok) {
    repaired.push("minutes:template");
    minutes = templateMinutes(input.total_minutes);
  }
  const ladder = labels.map((label, i) => ({ step: (i + 1) as 1 | 2 | 3 | 4, label, minutes: minutes[i] ?? 5 }));
  const checked = Ladder.safeParse(ladder);
  if (!checked.success) return null;
  return { ladder: checked.data, repaired, templateSteps };
}
