// Calls Ollama with the settings the lab proved (report 02): GGUF tag, think:false,
// prompt-only (no format), temperature 0, seed 42. The photo prompt is v2 (photo.ts); the
// ladder prompt and guard are ML's (packages/shared/src/prompts/ladder.ts, prompt v2).
// The image is passed as base64 in the request body and lives only in memory.
import {
  type Draft,
  enforce,
  enforceLadder,
  LADDER_PROMPT,
  type LadderJobT,
  type LadderT,
  ladderUserPrompt,
  SYSTEM_PROMPT,
  USER_PROMPT,
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

/** Ask line to four steps with ML's ladder prompt v2 and enforceLadder(). Retries once. */
export async function ladderFromAsk(cfg: OllamaConfig, job: LadderJobT, signal?: AbortSignal): Promise<LadderT | null> {
  const input = { ask: job.ask, total_minutes: job.total_minutes, ...(job.weather ? { weather: job.weather } : {}) };
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await post(
      cfg,
      [
        { role: "system", content: LADDER_PROMPT.system },
        { role: "user", content: ladderUserPrompt(input) },
      ],
      LADDER_PROMPT.numPredict,
      signal,
    );
    const d = enforceLadder(text, input);
    if (d) return d.ladder;
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
