// ADR-0027: Voice Spark. A person's own audio goes once to Scribe, comes back as words, and the
// buffer is zero-filled; off without a key; audio only, 400 KB at most; a daily cap.
import { describe, expect, it } from "vitest";
import { buildCtx, createApp } from "../src/app.ts";
import type { HubRelay } from "../src/hub/relay.ts";
import { SCRIBE_ENDPOINT, voiceTier } from "../src/voice.ts";

const KEY = { ELEVENLABS_API_KEY: "test-elevenlabs-key-not-real" };
const relay = {
  status: "absent",
  draft: async () => null,
  ladder: async () => null,
  close() {},
} as unknown as HubRelay;
function fake(text: string | null, status = 200) {
  const calls: { url: string; headers: Record<string, string>; form: FormData; bytes: Uint8Array }[] = [];
  const f = (async (url: string, init: RequestInit) => {
    const form = init.body as FormData;
    const file = form.get("file") as Blob;
    calls.push({
      url,
      headers: init.headers as Record<string, string>,
      form,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
    return new Response(JSON.stringify({ text }), { status });
  }) as unknown as typeof fetch;
  return { f, calls };
}
function app(env: NodeJS.ProcessEnv, f: typeof fetch) {
  const deps = { relay, db: null, version: "t", voice: voiceTier(env, f) };
  return createApp(deps, buildCtx(deps));
}
const audio = (n = 2000): Uint8Array<ArrayBuffer> => new Uint8Array(new ArrayBuffer(n)).fill(7);
const post = (a: ReturnType<typeof createApp>, body: Uint8Array<ArrayBuffer>, type = "audio/webm") =>
  a.request("/api/v1/voice/spark", { method: "POST", headers: { "content-type": type }, body });

describe("Voice Spark (ADR-0027)", () => {
  it("is off without a key: 503 and /config says so", async () => {
    const d = fake("x");
    const a = app({}, d.f);
    expect((await post(a, audio())).status).toBe(503);
    expect((await (await a.request("/api/v1/config")).json()).voice).toEqual({ spark: false });
    expect(d.calls).toHaveLength(0);
  });
  it("turns the person's audio into words with Scribe, key in a header", async () => {
    const d = fake("  The light on   the water at 5 ");
    const a = app(KEY, d.f);
    const r = await post(a, audio());
    expect(await r.json()).toEqual({ text: "The light on the water at 5" });
    expect(d.calls[0]?.url).toBe(SCRIBE_ENDPOINT);
    expect(d.calls[0]?.headers["xi-api-key"]).toBe(KEY.ELEVENLABS_API_KEY);
    expect(d.calls[0]?.form.get("model_id")).toBe("scribe_v2");
    expect(d.calls[0]?.bytes.length).toBe(2000);
    expect((await (await a.request("/api/v1/config")).json()).voice).toEqual({ spark: true });
  });
  it("refuses anything that isn't audio, and anything over 400 KB", async () => {
    const d = fake("x");
    const a = app(KEY, d.f);
    expect((await post(a, audio(), "image/jpeg")).status).toBe(415);
    expect((await post(a, audio(400_001))).status).toBe(413);
    expect(d.calls).toHaveLength(0);
  });
  it("returns null when Scribe fails, so the phone asks to type", async () => {
    const a = app(KEY, fake(null, 500).f);
    expect(await (await post(a, audio())).json()).toEqual({ text: null });
  });
  it("caps transcriptions per day", async () => {
    const d = fake("ok");
    const t = voiceTier({ ...KEY, VOICE_SPARK_DAILY_MAX: "2" }, d.f);
    for (let i = 0; i < 3; i++) await t?.transcribe(audio(), "audio/webm");
    expect(d.calls).toHaveLength(2);
    expect(t?.left()).toBe(0);
  });
});
