// ADR-0022: the DigitalOcean tier answers only when the hub is absent; photos only with the
// host's opt-in; never with an account-wide token; capped per day.
import { describe, expect, it } from "vitest";
import { buildCtx, createApp } from "../src/app.ts";
import { cloudTier, DO_ENDPOINT } from "../src/cloud.ts";
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
      ladder: true,
      photo_opt_in: true,
    });
  });
});
