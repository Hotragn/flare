// Calls Ollama with the settings the lab proved (report 02): GGUF tag, think:false,
// prompt-only (no format), temperature 0, seed 42. The photo prompt is v2 (photo.ts); the
// ladder prompt and guard are ML's (packages/shared/src/prompts/ladder.ts, prompt v2).
// The image is passed as base64 in the request body and lives only in memory.
import {
  type Draft,
  enforce,
  enforceLadder,
  enforceOsmTags,
  enforceSummary,
  LADDER_PROMPT,
  type LadderJobT,
  type LadderT,
  ladderUserPrompt,
  OSM_PROMPT,
  SUMMARY_SYSTEM,
  SYSTEM_PROMPT,
  summaryUserPrompt,
  USER_PROMPT,
  VOICE_SYSTEM_PROMPT,
  VOICE_USER_PROMPT,
} from "@flare/shared";
import { WARM_IMAGE_BASE64 } from "./warm-image.ts";

export type OllamaConfig = { url: string; model: string; timeoutMs: number };

async function post(cfg: OllamaConfig, messages: unknown[], numPredict: number, signal?: AbortSignal): Promise<string> {
  const res = await fetch(`${cfg.url}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: cfg.model,
      stream: false,
      think: false,
      keep_alive: "30m",
      messages,
      options: { temperature: 0, seed: 42, num_predict: numPredict },
    }),
    signal: signal ?? AbortSignal.timeout(cfg.timeoutMs),
  });
  if (!res.ok) throw new Error(`ollama ${res.status}`);
  const json = (await res.json()) as { message?: { content?: string } };
  return json.message?.content ?? "";
}

/** The photo task: system prompt v2 plus one image. */
export function chat(cfg: OllamaConfig, imageBase64: string, signal?: AbortSignal, numPredict = 128): Promise<string> {
  return post(
    cfg,
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: USER_PROMPT, images: [imageBase64] },
    ],
    numPredict,
    signal,
  );
}

/**
 * Warm the model the way photos use it: the real system prompt plus an image, 4 tokens out.
 * A text-only warm-up left the vision path cold, and the first photos took 12 to 17 s (ML F16).
 */
export function warm(cfg: OllamaConfig): Promise<string> {
  return chat(cfg, WARM_IMAGE_BASE64, AbortSignal.timeout(120_000), 4);
}

/** One photo in, one guarded draft out. Retries once on an unusable answer (report 02). */
export async function draftFromPhoto(cfg: OllamaConfig, jpeg: Uint8Array, signal?: AbortSignal): Promise<Draft | null> {
  const b64 = Buffer.from(jpeg).toString("base64");
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await chat(cfg, b64, signal);
    const d = enforce(text);
    if (d) return d;
  }
  return null;
}

/**
 * Voice Flare (ADR-0028): what the host said, as WAV, to the same guarded draft as a photo.
 * Gemma 4 takes audio through Ollama's `images` field (checked on Ollama 0.40.2). No retry: at
 * temperature 0 a second try gives the same answer, and the host can type instead.
 */
export async function draftFromVoice(cfg: OllamaConfig, wav: Uint8Array, signal?: AbortSignal): Promise<Draft | null> {
  const text = await post(
    cfg,
    [
      { role: "system", content: VOICE_SYSTEM_PROMPT },
      { role: "user", content: VOICE_USER_PROMPT, images: [Buffer.from(wav).toString("base64")] },
    ],
    128,
    signal,
  );
  return enforce(text);
}

/** Remember this (ADR-0031): a consented transcript to one guarded line, or null. */
export async function summaryFromTranscript(
  cfg: OllamaConfig,
  text: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const out = await post(
    cfg,
    [
      { role: "system", content: SUMMARY_SYSTEM },
      { role: "user", content: summaryUserPrompt(text) },
    ],
    96,
    signal,
  );
  return enforceSummary(out);
}

/** Ask line to four steps with ML's ladder prompt v2 and enforceLadder(). No retry by default (ADR-0025). */
export async function ladderFromAsk(
  cfg: OllamaConfig,
  job: LadderJobT,
  signal?: AbortSignal,
  opts: { retry?: LadderRetry; deadline?: number } = {},
): Promise<LadderT | null> {
  const input = { ask: job.ask, total_minutes: job.total_minutes, ...(job.weather ? { weather: job.weather } : {}) };
  const messages: { role: string; content: string }[] = [
    { role: "system", content: LADDER_PROMPT.system },
    { role: "user", content: ladderUserPrompt(input) },
  ];
  const t0 = performance.now();
  const text = await post(cfg, messages, LADDER_PROMPT.numPredict, signal);
  const d = enforceLadder(text, input);
  if (d) return d.ladder;
  // At temperature 0 the same prompt gives the same answer, so a plain retry only costs time
  // (about 3.5 s, eval 2026-10-11). "corrective" retries once with a correction, only if one
  // more call of the same length fits before the deadline. The default is "none": in the eval
  // Gemma kept the same labels after the correction, so the template takes over at once.
  const retry = opts.retry ?? LADDER_RETRY;
  const took = performance.now() - t0;
  if (retry === "none" || (opts.deadline !== undefined && performance.now() + took > opts.deadline)) return null;
  const again = await post(
    cfg,
    [...messages, { role: "assistant", content: text }, { role: "user", content: LADDER_CORRECTION }],
    LADDER_PROMPT.numPredict,
    signal,
  );
  return enforceLadder(again, input)?.ladder ?? null;
}

export type LadderRetry = "corrective" | "none";
/** Chosen by the ladder-agent eval (ADR-0025): see docs/handoffs/10-mastra-plan.md. */
export const LADDER_RETRY: LadderRetry = "none";
/** The second turn when the first answer failed enforceLadder(). Names the usual failures. */
export const LADDER_CORRECTION =
  "That answer could not be used. Reply with the JSON object only: 4 labels of 2 to 4 plain words in sentence case (only the first letter upper case), only places named in the ask, and 4 whole minutes that go down.";

/**
 * ICR-ML5: one photo to a guarded OSM tag draft with ML's osm-tags prompt v1 and
 * enforceOsmTags(). Retries once when the answer is not JSON. Empty tags is a valid answer.
 */
export async function tagsFromPhoto(
  cfg: OllamaConfig,
  jpeg: Uint8Array,
  signal?: AbortSignal,
): Promise<Record<string, string> | null> {
  const b64 = Buffer.from(jpeg).toString("base64");
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await post(
      cfg,
      [
        { role: "system", content: OSM_PROMPT.system },
        { role: "user", content: OSM_PROMPT.user, images: [b64] },
      ],
      OSM_PROMPT.numPredict,
      signal,
    );
    const d = enforceOsmTags(text);
    if (d) return d.tags;
  }
  return null;
}

export async function isModelReady(cfg: OllamaConfig): Promise<boolean> {
  try {
    const res = await fetch(`${cfg.url}/api/tags`, { signal: AbortSignal.timeout(3000) });
    const tags = (await res.json()) as { models?: { name: string }[] };
    return !!tags.models?.some((m) => m.name === cfg.model);
  } catch {
    return false;
  }
}
