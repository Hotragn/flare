// ADR-0022: the DigitalOcean tier answers only when the hub is absent; photos only with the
// host's opt-in; never with an account-wide token; capped per day.
import { describe, expect, it } from "vitest";
import { buildCtx, createApp } from "../src/app.ts";
import { cloudTier, DO_ENDPOINT, GOOGLE_ENDPOINT, GOOGLE_MODEL } from "../src/cloud.ts";
import type { HubRelay } from "../src/hub/relay.ts";
import { fakeJpeg } from "./helpers.ts";

const SCOPED = { DO_MODEL_ACCESS_KEY: "sk-do-scoped-model-key-for-tests-0001" };
type Call = { url: string; body: { model: string; messages: { role: string; content: unknown }[] } };

function fakeDo(reply: string) {
  const calls: Call[] = [];
  const f = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)) });
    return new Response(JSON.stringify({ choices: [{ message: { content: reply } }] }), { status: 200 });
  }) as unknown as typeof fetch;
  return { f, calls };
}
const relay = (status: "connected" | "absent") =>
  ({ status, draft: async () => null, ladder: async () => null, close() {} }) as unknown as HubRelay;
function app(status: "connected" | "absent", reply: string, env: NodeJS.ProcessEnv = SCOPED) {
  const d = fakeDo(reply);
  const deps = { relay: relay(status), db: null, version: "t", cloud: cloudTier(env, d.f), ladderTimeoutMs: 50 };
  return { app: createApp(deps, buildCtx(deps)), calls: d.calls };
}
const photo = (a: ReturnType<typeof createApp>, q = "") =>
  a.request(`/api/v1/drafts${q}`, { method: "POST", headers: { "content-type": "image/jpeg" }, body: fakeJpeg() });
const ladder = (a: ReturnType<typeof createApp>) =>
  a.request("/api/v1/drafts/ladder", {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": "cloud-test-key-000001" },
    body: JSON.stringify({ ask: "Fairlane walk at 11?", total_minutes: 60 }),
  });

const LADDER = JSON.stringify({
  steps: [
    { label: "Fairlane walk", minutes: 60 },
    { label: "Fairlane loop", minutes: 30 },
    { label: "Fairlane stroll", minutes: 15 },
    { label: "Fairlane sit", minutes: 10 },
  ],
});
const PHOTO = JSON.stringify({
  invite: "Sunset at the park bench",
  alt: "A wooden bench under round trees at sunset.",
});

describe("DigitalOcean cloud tier (ADR-0022)", () => {
  it("stays off without a key or with an account-wide token", () => {
    expect(cloudTier({})).toBeNull();
    expect(cloudTier({ DO_MODEL_ACCESS_KEY: ["dop", "v1", "x".repeat(64)].join("_") })).toBeNull();
    expect(cloudTier(SCOPED)).not.toBeNull();
  });
  it("answers a ladder when the hub is absent", async () => {
    const { app: a, calls } = app("absent", LADDER);
    const r = await (await ladder(a)).json();
    expect(r.tier).toBe("cloud");
    expect(r.steps[0].label).toBe("Fairlane walk");
    expect(calls[0]?.url).toBe(DO_ENDPOINT);
    expect(calls[0]?.body.model).toBe("gemma-4-31B-it");
  });
  it("never sends a photo without the host's opt-in", async () => {
    const { app: a, calls } = app("absent", PHOTO);
    expect((await (await photo(a)).json()).tier).toBe("rules");
    expect(calls).toHaveLength(0);
  });
  it("sends an opted-in photo when the hub is absent, image only plus the fixed prompt", async () => {
    const { app: a, calls } = app("absent", PHOTO);
    const r = await (await photo(a, "?cloud=1")).json();
    expect(r.tier).toBe("cloud");
    expect(r.invite).toBe("Sunset at the park bench");
    const user = calls[0]?.body.messages[1]?.content as { type: string }[];
    expect(user.map((p) => p.type)).toEqual(["text", "image_url"]);
  });
  it("does not use the cloud while the hub is up, even with opt-in", async () => {
    const { app: a, calls } = app("connected", PHOTO);
    expect((await (await photo(a, "?cloud=1")).json()).tier).toBe("rules");
    expect((await (await ladder(a)).json()).tier).toBe("rules");
    expect(calls).toHaveLength(0);
  });
  it("caps calls per day", async () => {
    const d = fakeDo(LADDER);
    const t = cloudTier({ ...SCOPED, DO_DAILY_MAX_CALLS: "2" }, d.f);
    for (let i = 0; i < 3; i++) await t?.ladder({ ask: "walk", total_minutes: 60 });
    expect(d.calls).toHaveLength(2);
    expect(t?.left()).toBe(0);
  });
  it("tells the phone through /config", async () => {
    const { app: a } = app("absent", PHOTO);
    expect((await (await a.request("/api/v1/config")).json()).cloud_ai).toEqual({
      provider: "digitalocean",
      providers: ["digitalocean"],
      ladder: true,
      photo_opt_in: true,
    });
  });
});

// ADR-0026: Google AI Studio (Gemma 4 on the Gemini API) after DigitalOcean.
const GKEY = { GEMINI_API_KEY: "test-gemini-key-not-real-0001" };
function fakeBoth(doStatus: number, reply: string) {
  const calls: { url: string; headers: Record<string, string>; body: Record<string, unknown> }[] = [];
  const f = (async (url: string, init: RequestInit) => {
    calls.push({ url, headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) });
    if (url === DO_ENDPOINT) return new Response('{"error":"This account has been blocked"}', { status: doStatus });
    return new Response(
      JSON.stringify({ candidates: [{ content: { parts: [{ text: "planning", thought: true }, { text: reply }] } }] }),
      { status: 200 },
    );
  }) as unknown as typeof fetch;
  return { f, calls };
}

describe("Google AI Studio fallback (ADR-0026)", () => {
  it("runs alone with only a Gemini key, Gemma 4 by name, key in a header", async () => {
    const d = fakeBoth(200, LADDER);
    const t = cloudTier(GKEY, d.f);
    expect(t?.providers).toEqual(["google"]);
    const l = await t?.ladder({ ask: "Fairlane walk at 11?", total_minutes: 60 });
    expect(l?.[0]?.label).toBe("Fairlane walk");
    expect(d.calls[0]?.url).toBe(`${GOOGLE_ENDPOINT}/${GOOGLE_MODEL}:generateContent`);
    expect(d.calls[0]?.url).not.toContain("key=");
    expect(d.calls[0]?.headers["x-goog-api-key"]).toBe(GKEY.GEMINI_API_KEY);
    expect(t?.last()).toEqual({ provider: "google", model: GOOGLE_MODEL });
    expect(d.calls[0]?.body.generationConfig).toMatchObject({ thinkingConfig: { thinkingLevel: "minimal" } });
  });
  it("answers from Google when DigitalOcean refuses, and skips DigitalOcean for an hour", async () => {
    const d = fakeBoth(402, LADDER);
    const t = cloudTier({ ...SCOPED, ...GKEY }, d.f);
    expect(t?.providers).toEqual(["digitalocean", "google"]);
    expect(await t?.ladder({ ask: "walk", total_minutes: 60 })).not.toBeNull();
    expect(d.calls.map((c) => c.url === DO_ENDPOINT)).toEqual([true, false]);
    await t?.ladder({ ask: "walk", total_minutes: 60 });
    expect(d.calls.filter((c) => c.url === DO_ENDPOINT)).toHaveLength(1);
    expect(t?.last()?.provider).toBe("google");
  });
  it("tries Google after a DigitalOcean server error, without marking DigitalOcean down", async () => {
    const d = fakeBoth(503, LADDER);
    const t = cloudTier({ ...SCOPED, ...GKEY }, d.f);
    await t?.ladder({ ask: "walk", total_minutes: 60 });
    await t?.ladder({ ask: "walk", total_minutes: 60 });
    expect(d.calls.filter((c) => c.url === DO_ENDPOINT)).toHaveLength(2);
  });
  it("sends an opted-in photo to Google as inline JPEG plus the fixed prompt", async () => {
    const d = fakeBoth(200, PHOTO);
    const t = cloudTier(GKEY, d.f);
    expect((await t?.photo(fakeJpeg()))?.invite).toBe("Sunset at the park bench");
    const contents = (d.calls[0]?.body.contents ?? []) as { parts: Record<string, unknown>[] }[];
    const parts = contents[0]?.parts ?? [];
    expect(parts.map((p) => Object.keys(p)[0])).toEqual(["text", "inline_data"]);
  });
  it("shares one daily cap across providers", async () => {
    const d = fakeBoth(402, LADDER);
    const t = cloudTier({ ...SCOPED, ...GKEY, CLOUD_DAILY_MAX_CALLS: "1" }, d.f);
    await t?.ladder({ ask: "walk", total_minutes: 60 });
    expect(await t?.ladder({ ask: "walk", total_minutes: 60 })).toBeNull();
    expect(t?.left()).toBe(0);
  });
});
