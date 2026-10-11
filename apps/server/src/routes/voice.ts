// POST /api/v1/voice/spark (ADR-0027): a person's own 10-second Spark, said instead of typed.
// The audio is passed to ElevenLabs Scribe once, zero-filled, never stored or logged; only the
// words come back. 503 when the server has no ElevenLabs key; 200 with text null when Scribe
// gave nothing usable (the phone then asks the person to type).
import type { Hono } from "hono";
import type { Ctx } from "../core/deps.ts";
import { ApiError } from "../http/errors.ts";
import { limitWrite, type RateLimiter } from "../http/middleware.ts";
import { clientIp } from "../http/write.ts";
import { MAX_SPARK_AUDIO_BYTES, SPARK_AUDIO_TYPES } from "../voice.ts";

export function mountVoice(app: Hono, ctx: Ctx, rl: RateLimiter): void {
  app.post("/api/v1/voice/spark", async (c) => {
    limitWrite(rl, { anon: clientIp(c) });
    if (!ctx.voice) throw new ApiError(503, "not_configured", "Say it is off on this server");
    const type = (c.req.header("content-type") ?? "").split(";")[0]?.trim() ?? "";
    if (!SPARK_AUDIO_TYPES.includes(type)) throw new ApiError(415, "not_audio", "Send audio");
    if (Number(c.req.header("content-length") ?? "0") > MAX_SPARK_AUDIO_BYTES)
      throw new ApiError(413, "too_large", "10 seconds at most");
    const buf = new Uint8Array(await c.req.arrayBuffer());
    try {
      if (buf.length === 0 || buf.length > MAX_SPARK_AUDIO_BYTES)
        throw new ApiError(413, "too_large", "10 seconds at most");
      const text = await ctx.voice.transcribe(buf, type);
      return c.json({ text });
    } finally {
      buf.fill(0);
    }
  });
}
