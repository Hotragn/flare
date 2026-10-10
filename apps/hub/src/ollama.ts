// Calls Ollama for the photo task with the settings the lab proved (report 02):
// GGUF tag, think:false, prompt-only (no format), temperature 0, num_predict 128.
// The image is passed as base64 in the request body and lives only in memory.
import { type Draft, enforce, SYSTEM_PROMPT, USER_PROMPT } from "@flare/shared";

export type OllamaConfig = { url: string; model: string; timeoutMs: number };

export async function chat(cfg: OllamaConfig, imageBase64: string | null, signal?: AbortSignal): Promise<string> {
  const body = {
    model: cfg.model,
    stream: false,
    think: false,
    keep_alive: "30m",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      imageBase64
        ? { role: "user", content: USER_PROMPT, images: [imageBase64] }
        : { role: "user", content: "Reply with {}" },
    ],
    options: { temperature: 0, seed: 42, num_predict: 128 },
  };
  const res = await fetch(`${cfg.url}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: signal ?? AbortSignal.timeout(cfg.timeoutMs),
  });
  if (!res.ok) throw new Error(`ollama ${res.status}`);
  const json = (await res.json()) as { message?: { content?: string } };
  return json.message?.content ?? "";
}

/** One photo in, one guarded draft out. Retries once on an unusable answer (report 02). */
export async function draftFromPhoto(cfg: OllamaConfig, jpeg: Uint8Array): Promise<Draft | null> {
  const b64 = Buffer.from(jpeg).toString("base64");
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await chat(cfg, b64);
    const d = enforce(text);
    if (d) return d;
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
