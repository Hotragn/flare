// DigitalOcean Serverless Inference as a cloud tier (ADR-0022). Off unless DO_MODEL_ACCESS_KEY
// holds a scoped model access key (an account token is refused, scripts/lib/token-guard.ts).
//   - Plan ladders (non-personal text, at most 80 characters, no place) use it when the hub is
//     absent.
//   - A photo uses it only when the hub is absent AND the host opted in for that Flare
//     (`?cloud=1` on POST /api/v1/drafts). Nothing else ever goes to DigitalOcean.
// Same guards as the hub (enforce(), enforceLadder()). Nothing is stored or logged; the photo
// buffer is zero-filled by the caller. No per-key spend cap exists at DigitalOcean (prepaid
// balance only), so the server caps calls per UTC day and tokens per call.
import { enforce, enforceLadder, type LadderT, SYSTEM_PROMPT, USER_PROMPT } from "@flare/shared";
import { LADDER_PROMPT, ladderUserPrompt } from "@flare/shared/prompts/ladder";
import { accountToken } from "@flare/shared/token-guard";

export const DO_ENDPOINT = "https://inference.do-ai.run/v1/chat/completions";
export const DO_MODEL = "gemma-4-31B-it"; // open Gemma 4, accepts images (probe 2026-10-11: ladder 20.9 s, photo 27.2 s)
export const CLOUD_BUDGET_MS = 35_000;

export type CloudTier = {
  model: string;
  photo(jpeg: Uint8Array): Promise<{ invite: string; alt: string } | null>;
  ladder(input: { ask: string; total_minutes: number }): Promise<LadderT | null>;
  /** Calls left today under the server's cap. */
  left(): number;
};

export function cloudTier(env: NodeJS.ProcessEnv = process.env, fetchImpl: typeof fetch = fetch): CloudTier | null {
  const key = env.DO_MODEL_ACCESS_KEY ?? "";
  if (!key || accountToken(key)) return null;
  const model = env.DO_MODEL ?? DO_MODEL;
  const cap = Number(env.DO_DAILY_MAX_CALLS ?? 60);
  let day = "";
  let used = 0;
  const take = () => {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== day) {
      day = today;
      used = 0;
    }
    if (used >= cap) return false;
    used++;
    return true;
  };

  async function chat(messages: unknown[]): Promise<string | null> {
    if (!take()) return null;
    try {
      const r = await fetchImpl(DO_ENDPOINT, {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({ model, messages, temperature: 0, max_tokens: 200 }),
        signal: AbortSignal.timeout(CLOUD_BUDGET_MS),
      });
      if (!r.ok) return null;
      const j = (await r.json()) as { choices?: { message?: { content?: string } }[] };
      return j.choices?.[0]?.message?.content ?? null;
    } catch {
      return null; // timeout, network: the template takes over
    }
  }

  return {
    model,
    left: () => Math.max(0, cap - (day === new Date().toISOString().slice(0, 10) ? used : 0)),
    async photo(jpeg) {
      const b64 = Buffer.from(jpeg).toString("base64");
      const text = await chat([
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: USER_PROMPT },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64}` } },
          ],
        },
      ]);
      const d = text ? enforce(text) : null;
      return d ? { invite: d.invite, alt: d.alt } : null;
    },
    async ladder(input) {
      const text = await chat([
        { role: "system", content: LADDER_PROMPT.system },
        { role: "user", content: ladderUserPrompt(input) },
      ]);
      return text ? (enforceLadder(text, input)?.ladder ?? null) : null;
    },
  };
}
