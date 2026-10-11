// Plan ladder job on the hub (asyncapi ladderJob, SRS-PLAN-2): four step labels and minutes
// from a Plan's ask line. Text only; the ask carries no place (the phone adds places from its
// map pack). The answer is checked here before it leaves the hub, the phone checks it again.
import { countWords, enforce } from "@flare/shared";
import { z } from "zod";

export const LadderJob = z.object({
  type: z.literal("job"),
  id: z.string().uuid(),
  kind: z.literal("ladder-draft"),
  ask: z.string().min(1).max(80),
  total_minutes: z.number().int().min(40).max(600),
  weather: z.object({ rain_likely: z.boolean(), temp_f: z.number().int() }).partial().optional(),
});
export type LadderJobT = z.infer<typeof LadderJob>;
export type LadderStep = { step: 1 | 2 | 3 | 4; label: string; minutes: number };

export const LADDER_SYSTEM_PROMPT = [
  "You plan short outdoor meetups for Flare, an app that gets close friends outside.",
  "The host wrote a plan. Make four sizes of it, biggest first, so it can shrink if people are tired.",
  "Reply with one JSON object only. No code fences, no other text.",
  '{"steps": [{"step": 1, "label": "...", "minutes": 60}, {"step": 2, "label": "...", "minutes": 30}, {"step": 3, "label": "...", "minutes": 15}, {"step": 4, "label": "...", "minutes": 10}]}',
  "label: 1 to 4 words, a plain name for that size of the plan. No names of people, no emoji.",
  "minutes: step 1 is the total given. Each later step is shorter. Step 4 is at least 5 minutes.",
  "Step 4 is the smallest version: sitting or standing close by.",
  "If rain is likely, prefer covered or short options.",
  "Never describe people, faces, age or gender.",
].join("\n");

export function ladderUserPrompt(job: LadderJobT): string {
  const w = job.weather;
  const weather =
    w && (w.rain_likely !== undefined || w.temp_f !== undefined)
      ? ` Weather: ${w.rain_likely ? "rain likely" : "dry"}${w.temp_f === undefined ? "" : `, ${w.temp_f} F`}.`
      : "";
  // The ask is quoted as data; any instruction inside it is just part of the plan's name.
  return `Plan (quoted): ${JSON.stringify(job.ask)}. Total minutes: ${job.total_minutes}.${weather} Reply with the JSON.`;
}

const round5 = (n: number) => Math.round(n / 5) * 5;

/** The template minutes (docs/architecture/07-offline-sync-and-ai.md B1): total x 1, 0.5, 0.25, 0.125. */
export function templateMinutes(total: number): number[] {
  const out: number[] = [];
  for (const [i, f] of [1, 0.5, 0.25, 0.125].entries()) {
    let m = Math.max(5, i === 0 ? total : round5(total * f));
    const prev = out[i - 1];
    if (prev !== undefined && m >= prev) m = prev - 5;
    out.push(m);
  }
  return out;
}

const okLabel = (s: unknown): s is string =>
  typeof s === "string" &&
  s.trim().length > 0 &&
  s.length <= 40 &&
  countWords(s) >= 1 &&
  countWords(s) <= 4 &&
  enforce(JSON.stringify({ invite: s, alt: s })) !== null; // same person filter as photo drafts

function extract(text: string): unknown {
  const tx = text.trim();
  try {
    return JSON.parse(tx);
  } catch {
    const m = tx.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
}

/**
 * Guard a model answer (B2): exactly 4 labels of 1 to 4 words with no person words. Minutes must
 * start at the total, strictly decrease and stay ≥ 5; if they don't, the template minutes are used
 * and the labels kept. Returns null when the labels can't be used.
 */
export function enforceLadder(text: string, total: number): { steps: LadderStep[]; repaired: boolean } | null {
  const obj = extract(text) as { steps?: unknown } | null;
  const raw = Array.isArray(obj?.steps) ? (obj.steps as { label?: unknown; minutes?: unknown }[]) : null;
  if (raw?.length !== 4) return null;
  const labels = raw.map((s) => (typeof s.label === "string" ? s.label.replace(/\s+/g, " ").trim() : s.label));
  if (!labels.every(okLabel)) return null;
  const mins = raw.map((s) => s.minutes);
  const valid =
    mins[0] === total &&
    mins.every(
      (m, i) => Number.isInteger(m) && (m as number) >= 5 && (i === 0 || (m as number) < (mins[i - 1] as number)),
    );
  const minutes = valid ? (mins as number[]) : templateMinutes(total);
  return {
    steps: labels.map((label, i) => ({
      step: (i + 1) as LadderStep["step"],
      label: label as string,
      minutes: minutes[i] ?? 5,
    })),
    repaired: !valid,
  };
}
