// The cloud tier (ADR-0022, ADR-0026): open Gemma 4 served in the cloud, used only when the hub
// is absent. Two providers, tried in order:
//   1. DigitalOcean Serverless Inference (DO_MODEL_ACCESS_KEY, a scoped model access key; an
//      account token is refused, scripts/lib/token-guard.ts).
//   2. Google AI Studio, the Gemini API (GEMINI_API_KEY), serving Gemma 4 on its free tier.
// A provider that answers 401, 402 or 403 (for example a blocked or unpaid account) is skipped
// for an hour, so the next one answers without paying its timeout first.
//   - Plan ladders (non-personal text, at most 80 characters, no place) use it when the hub is
//     absent.
//   - A photo uses it only when the hub is absent AND the host opted in for that Flare
//     (`?cloud=1` on POST /api/v1/drafts). Nothing else ever goes to a cloud provider.
// Same guards as the hub (enforce(), enforceLadder()). Nothing is stored or logged; the photo
// buffer is zero-filled by the caller. The server caps calls per UTC day across providers.
import { enforce, enforceLadder, type LadderT, SYSTEM_PROMPT, USER_PROMPT } from "@flare/shared";
import { LADDER_PROMPT, ladderUserPrompt } from "@flare/shared/prompts/ladder";
import { accountToken } from "@flare/shared/token-guard";

export const DO_ENDPOINT = "https://inference.do-ai.run/v1/chat/completions";
export const DO_MODEL = "gemma-4-31B-it"; // open Gemma 4, accepts images (probe 2026-10-11: ladder 20.9 s, photo 27.2 s)
export const GOOGLE_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
export const GOOGLE_MODEL = "gemma-4-26b-a4b-it"; // open Gemma 4 MoE (4B active) on the Gemini API; accepts images
export const CLOUD_BUDGET_MS = 35_000;
export const DOWN_FOR_MS = 60 * 60_000;

export type Provider = "digitalocean" | "google";
type Ask = { system: string; user: string; jpeg?: Uint8Array };
type Backend = { provider: Provider; model: string; call(a: Ask): Promise<{ text: string | null; refused: boolean }> };

export type CloudTier = {
  /** The first provider's model (for tracing); `last()` says who answered. */
  model: string;
  providers: Provider[];
  last(): { provider: Provider; model: string } | null;
  photo(jpeg: Uint8Array): Promise<{ invite: string; alt: string } | null>;
  ladder(input: { ask: string; total_minutes: number }): Promise<LadderT | null>;
  /** Calls left today under the server's cap. */
  left(): number;
};

function digitalOcean(key: string, model: string, fetchImpl: typeof fetch): Backend {
  return {
    provider: "digitalocean",
    model,
    async call({ system, user, jpeg }) {
      const content = jpeg
        ? [
            { type: "text", text: user },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${Buffer.from(jpeg).toString("base64")}` } },
          ]
        : user;
      const r = await fetchImpl(DO_ENDPOINT, {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content },
          ],
          temperature: 0,
          max_tokens: 200,
        }),
        signal: AbortSignal.timeout(CLOUD_BUDGET_MS),
      });
      if (!r.ok) return { text: null, refused: [401, 402, 403].includes(r.status) };
      const j = (await r.json()) as { choices?: { message?: { content?: string } }[] };
      return { text: j.choices?.[0]?.message?.content ?? null, refused: false };
    },
  };
}

function google(key: string, model: string, fetchImpl: typeof fetch): Backend {
  return {
    provider: "google",
    model,
    async call({ system, user, jpeg }) {
      // Gemma on the Gemini API takes no separate system instruction: it leads the user turn.
      const parts: unknown[] = [{ text: `${system}\n\n${user}` }];
      if (jpeg) parts.push({ inline_data: { mime_type: "image/jpeg", data: Buffer.from(jpeg).toString("base64") } });
      const send = () =>
        fetchImpl(`${GOOGLE_ENDPOINT}/${model}:generateContent`, {
          method: "POST",
          headers: { "x-goog-api-key": key, "content-type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts }],
            // Gemma 4 here thinks by default (22 s and an empty answer at 200 tokens, probe
            // 2026-10-11); "minimal" answered the ladder in 1.4 s.
            generationConfig: { temperature: 0, maxOutputTokens: 400, thinkingConfig: { thinkingLevel: "minimal" } },
          }),
          signal: AbortSignal.timeout(CLOUD_BUDGET_MS),
        });
      // "minimal" thinking now and then answers 500 in under a second; one retry is cheap.
      let r = await send();
      if (r.status >= 500) r = await send();
      if (!r.ok) return { text: null, refused: [401, 402, 403].includes(r.status) };
      const j = (await r.json()) as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] };
      const text = (j.candidates?.[0]?.content?.parts ?? [])
        .filter((p) => !p.thought)
        .map((p) => p.text ?? "")
        .join("");
      return { text: text || null, refused: false };
    },
  };
}

export function cloudTier(env: NodeJS.ProcessEnv = process.env, fetchImpl: typeof fetch = fetch): CloudTier | null {
  const backends: Backend[] = [];
  const doKey = env.DO_MODEL_ACCESS_KEY ?? "";
  if (doKey && !accountToken(doKey)) backends.push(digitalOcean(doKey, env.DO_MODEL ?? DO_MODEL, fetchImpl));
  const gKey = env.GEMINI_API_KEY ?? "";
  if (gKey) backends.push(google(gKey, env.GOOGLE_MODEL ?? GOOGLE_MODEL, fetchImpl));
  if (!backends.length) return null;
  const cap = Number(env.CLOUD_DAILY_MAX_CALLS ?? env.DO_DAILY_MAX_CALLS ?? 60);
  const downUntil = new Map<Provider, number>();
  let last: { provider: Provider; model: string } | null = null;
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

  async function chat(a: Ask): Promise<string | null> {
    if (!take()) return null;
    for (const b of backends) {
      if ((downUntil.get(b.provider) ?? 0) > Date.now()) continue;
      try {
        const r = await b.call(a);
        if (r.refused) downUntil.set(b.provider, Date.now() + DOWN_FOR_MS);
        if (r.text) {
          last = { provider: b.provider, model: b.model };
          return r.text;
        }
      } catch {
        // timeout, network: try the next provider, then the template takes over
      }
    }
    return null;
  }

  return {
    model: (backends[0] as Backend).model,
    providers: backends.map((b) => b.provider),
    last: () => last,
    left: () => Math.max(0, cap - (day === new Date().toISOString().slice(0, 10) ? used : 0)),
    async photo(jpeg) {
      const text = await chat({ system: SYSTEM_PROMPT, user: USER_PROMPT, jpeg });
      const d = text ? enforce(text) : null;
      return d ? { invite: d.invite, alt: d.alt } : null;
    },
    async ladder(input) {
      const text = await chat({ system: LADDER_PROMPT.system, user: ladderUserPrompt(input) });
      return text ? (enforceLadder(text, input)?.ladder ?? null) : null;
    },
  };
}
