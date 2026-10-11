// Minimal Ollama client for evals, with the hub's settings (lab 02, architecture 07 B3).
// Calls are sequential by design: the Ollama on this Mac is shared by several agents.
import { HUB_MODEL, OLLAMA_OPTIONS } from "../../packages/shared/src/prompts/guard.ts";

export const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
export const MODEL = process.env.EVAL_MODEL ?? HUB_MODEL;

export type ChatIn = { system: string; user: string; imageBase64?: string; numPredict?: number; timeoutMs?: number };
export type ChatOut = { text: string; ms: number; error?: string };

export async function chat(input: ChatIn): Promise<ChatOut> {
  const body = {
    model: MODEL,
    stream: false,
    think: false,
    keep_alive: "10m",
    messages: [
      { role: "system", content: input.system },
      input.imageBase64
        ? { role: "user", content: input.user, images: [input.imageBase64] }
        : { role: "user", content: input.user },
    ],
    options: { ...OLLAMA_OPTIONS, num_predict: input.numPredict ?? OLLAMA_OPTIONS.num_predict },
  };
  const t0 = performance.now();
  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(input.timeoutMs ?? 60_000),
    });
    const ms = Math.round(performance.now() - t0);
    if (!res.ok) return { text: "", ms, error: `http ${res.status}` };
    const json = (await res.json()) as { message?: { content?: string } };
    return { text: json.message?.content ?? "", ms };
  } catch (e) {
    return { text: "", ms: Math.round(performance.now() - t0), error: (e as Error).name };
  }
}

export async function modelReady(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) });
    const tags = (await res.json()) as { models?: { name: string }[] };
    return !!tags.models?.some((m) => m.name === MODEL);
  } catch {
    return false;
  }
}

/** One untimed request so the cold load (7 to 14 s, lab 02) is not counted in latency. */
export async function warm(): Promise<number> {
  const r = await chat({ system: "Reply with {}", user: "{}", numPredict: 4, timeoutMs: 120_000 });
  return r.ms;
}

/**
 * Vision jobs need an image warm-up too: after a text-only warm-up the first 3 photo calls
 * took 12 to 13 s against 3 to 4 s for the rest (eval run 2026-10-10, failure mode F16).
 */
const warmedImage = { done: false };
export async function warmImage(system: string, imageBase64: string): Promise<number> {
  if (warmedImage.done) return 0;
  const r = await chat({ system, user: "{}", imageBase64, numPredict: 4, timeoutMs: 120_000 });
  warmedImage.done = true;
  return r.ms;
}
