// ADR-0025: the Mastra Plan agent. Tools are pure (weather takes a fake fetch), the model
// adapter talks only to a fake relay, and the route keeps today's contract and guard.
import { templateLadder } from "@flare/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runLadderAgent } from "../src/agent/ladder-agent.ts";
import { DARK_HINT, planJob, relayModel } from "../src/agent/model.ts";
import {
  clearToolCaches,
  coarse,
  loadPlaces,
  NWS,
  nearbyPlaces,
  stepTemplates,
  sunsetWindow,
  weatherWindow,
  withPackSpelling,
} from "../src/agent/tools.ts";
import { buildCtx, createApp } from "../src/app.ts";
import type { HubRelay } from "../src/hub/relay.ts";

const MORNING = new Date("2026-10-11T14:43:00Z"); // 10:43 EDT
const EVENING = new Date("2026-10-11T22:30:00Z"); // 18:30 EDT
const noop = { set() {} };

const STEPS = [
  { step: 1, label: "Walk by Rouge River", minutes: 60 },
  { step: 2, label: "A shorter loop", minutes: 30 },
  { step: 3, label: "A quick lap", minutes: 15 },
  { step: 4, label: "Sit by the water", minutes: 10 },
];

type Job = { ask: string; total_minutes: number; weather?: unknown };
function fakeRelay(status: "connected" | "absent", reply: unknown = { ok: true, model: "gemma4", ladder: STEPS }) {
  const jobs: { job: Job; timeoutMs: number }[] = [];
  const relay = {
    status,
    async ladder(job: Job, timeoutMs: number) {
      jobs.push({ job, timeoutMs });
      return typeof reply === "function" ? (reply as () => unknown)() : reply;
    },
  };
  return { relay: relay as unknown as HubRelay, jobs };
}

function fakeNws(periods: unknown[], hourly = `${NWS}/gridpoints/DTX/60,40/forecast/hourly`) {
  const urls: string[] = [];
  const f = (async (url: string) => {
    urls.push(url);
    if (url.includes("/points/")) return Response.json({ properties: { forecastHourly: hourly } });
    return Response.json({ properties: { periods } });
  }) as unknown as typeof fetch;
  return { f, urls };
}

afterEach(() => vi.unstubAllGlobals());
beforeEach(() => clearToolCaches());

describe("agent tools", () => {
  it("sunset: about 18:57 in Dearborn on 11 Oct, and knows a plan that ends after dark", () => {
    const m = sunsetWindow(60, MORNING);
    expect(m.sunset_local).toMatch(/^18:5\d$/);
    expect(m.ends_after_dark).toBe(false);
    expect(m.minutes_to_sunset).toBeGreaterThan(400);
    expect(sunsetWindow(60, EVENING).ends_after_dark).toBe(true);
    expect(sunsetWindow(60, MORNING, null).sunset_local).toBeNull();
  });

  it("places: names from the pack the ask mentions, closest named places, labels only", () => {
    const p = nearbyPlaces("Long walk by the rouge river trail");
    expect(p.named).toEqual(["Rouge River"]);
    expect(p.nearby).toHaveLength(5);
    expect(p.shelters).toBeGreaterThan(0);
    expect(JSON.stringify(p)).not.toMatch(/\d+\.\d{3,}/); // no coordinates
    expect(nearbyPlaces("Ford Woods Park loop after lunch").named).toEqual(["Ford Woods Park"]);
    expect(nearbyPlaces("Frisbee on the big lawn").named).toEqual([]);
    expect(nearbyPlaces("anything", null)).toEqual({ area: "", named: [], nearby: [], shelters: 0, benches: 0 });
  });

  it("places: the pack is read once and a missing pack gives nothing", () => {
    expect(loadPlaces()).toBe(loadPlaces());
    expect(loadPlaces(new URL("file:///nope/fairlane.json"))).toBeNull();
  });

  it("uses the pack's spelling for named places", () => {
    expect(withPackSpelling("walk by the rouge river, then tea", ["Rouge River"])).toBe(
      "walk by the Rouge River, then tea",
    );
    expect(withPackSpelling("Coffee then a walk", [])).toBe("Coffee then a walk");
  });

  it("weather: 0.1° rounding, reduced to rain and °F for the window", async () => {
    const n = fakeNws([
      { startTime: "2026-10-11T14:00:00Z", endTime: "2026-10-11T15:00:00Z", temperature: 50, temperatureUnit: "F" },
      {
        startTime: "2026-10-11T15:00:00Z",
        endTime: "2026-10-11T16:00:00Z",
        temperature: 54,
        temperatureUnit: "F",
        probabilityOfPrecipitation: { value: 60 },
      },
      { startTime: "2026-10-11T20:00:00Z", endTime: "2026-10-11T21:00:00Z", temperature: 90, temperatureUnit: "F" },
    ]);
    const w = await weatherWindow(60, MORNING, { fetch: n.f });
    expect(w).toEqual({ rain_likely: true, temp_f: 52 });
    expect(n.urls[0]).toBe(`${NWS}/points/42.3,-83.2`);
    expect(coarse({ lat: 42.3169092, lon: -83.2229394 })).toEqual({ lat: 42.3, lon: -83.2 });
  });

  it("weather: skips on failure or a forecast URL off api.weather.gov", async () => {
    const down = (async () => new Response("", { status: 503 })) as unknown as typeof fetch;
    expect(await weatherWindow(60, MORNING, { fetch: down })).toBeNull();
    const thrown = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    expect(await weatherWindow(60, MORNING, { fetch: thrown })).toBeNull();
    const evil = fakeNws([], "https://example.com/hourly");
    expect(await weatherWindow(60, MORNING, { fetch: evil.f })).toBeNull();
    expect(evil.urls).toHaveLength(1);
  });

  it("step templates are the template ladder", () => {
    expect(stepTemplates(90)).toEqual(templateLadder(90));
  });
});

describe("relay model adapter", () => {
  const prompt = (req: unknown) => [{ role: "user", content: [{ type: "text", text: JSON.stringify(req) }] }];
  const tools = ["sunset", "weather_window", "nearby_places", "step_templates"].map((name) => ({
    type: "function",
    name,
  }));

  it("step one asks for every context tool, skipping weather the phone already sent", async () => {
    const m = relayModel(async () => null, "t");
    const a = await m.doGenerate({ prompt: prompt({ ask: "walk", total_minutes: 60 }), tools });
    expect(a.finishReason).toBe("tool-calls");
    expect(a.content.map((c) => (c.type === "tool-call" ? c.toolName : c.type))).toEqual([
      "sunset",
      "weather_window",
      "nearby_places",
      "step_templates",
    ]);
    const weather = { rain_likely: false, temp_f: 60 };
    const b = await m.doGenerate({ prompt: prompt({ ask: "walk", total_minutes: 60, weather }), tools });
    expect(b.content.some((c) => c.type === "tool-call" && c.toolName === "weather_window")).toBe(false);
  });

  it("step two sends one relay job built from the tool results and returns its text", async () => {
    const seen: unknown[] = [];
    const m = relayModel(async (j) => {
      seen.push(j);
      return '{"steps":[]}';
    }, "t");
    const results = {
      role: "tool",
      content: [
        {
          type: "tool-result",
          toolName: "nearby_places",
          output: { type: "json", value: { named: ["Rouge River"], nearby: [], shelters: 0, benches: 0, area: "" } },
        },
        {
          type: "tool-result",
          toolName: "weather_window",
          output: { type: "json", value: { rain_likely: true, temp_f: 49 } },
        },
      ],
    };
    const r = await m.doGenerate({
      prompt: [...prompt({ ask: "walk by the rouge river", total_minutes: 60 }), results],
    });
    expect(r.content).toEqual([{ type: "text", text: '{"steps":[]}' }]);
    expect(seen).toEqual([
      { ask: "walk by the Rouge River", total_minutes: 60, weather: { rain_likely: true, temp_f: 49 } },
    ]);
  });

  it("streams the same answer", async () => {
    const m = relayModel(async () => null, "t");
    const { stream } = await m.doStream({ prompt: prompt({ ask: "walk", total_minutes: 60 }), tools });
    const parts: { type: string }[] = [];
    for await (const p of stream as ReadableStream<{ type: string }>) parts.push(p);
    expect(parts.filter((p) => p.type === "tool-call")).toHaveLength(4);
    expect(parts.at(-1)?.type).toBe("finish");
  });

  it("planJob: phone weather wins; the dark hint only when there is room", () => {
    const after = { ends_after_dark: true, sunset_local: "18:57", minutes_to_sunset: 10 };
    const tool = { rain_likely: true, temp_f: 40 };
    const phone = { rain_likely: false, temp_f: 60 };
    expect(planJob({ ask: "walk", total_minutes: 60, weather: phone }, { weather_window: tool }).weather).toEqual(
      phone,
    );
    expect(planJob({ ask: "walk", total_minutes: 60 }, { sunset: after }).ask).toBe(`walk${DARK_HINT}`);
    expect(planJob({ ask: "Sunset sit", total_minutes: 60 }, { sunset: after }).ask).toBe("Sunset sit");
    const long = "x".repeat(75);
    expect(planJob({ ask: long, total_minutes: 60 }, { sunset: after }).ask).toBe(long);
  });
});

describe("runLadderAgent", () => {
  it("drafts on the hub through the relay with the tools' context, inside the budget", async () => {
    const n = fakeNws([
      { startTime: "2026-10-11T14:00:00Z", endTime: "2026-10-11T16:00:00Z", temperature: 58, temperatureUnit: "F" },
    ]);
    const { relay, jobs } = fakeRelay("connected");
    const out = await runLadderAgent(
      { relay, cloud: null, budgetMs: 8000, now: () => MORNING, fetch: n.f },
      { ask: "Walk by the rouge river", total_minutes: 60 },
      noop,
    );
    expect(out.tier).toBe("hub");
    expect(out.weather).toBe("tool");
    expect(out.steps?.map((s) => s.minutes)).toEqual([60, 30, 15, 10]);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.job).toEqual({
      ask: "Walk by the Rouge River",
      total_minutes: 60,
      weather: { rain_likely: false, temp_f: 58 },
    });
    expect(jobs[0]?.timeoutMs).toBeLessThanOrEqual(8000);
  });

  it("guards the answer against the phone's ask: invented names and person words become template labels", async () => {
    const bad = [
      { step: 1, label: "Walk to Paris", minutes: 60 },
      { step: 2, label: "A shorter loop", minutes: 30 },
      { step: 3, label: "A quick lap", minutes: 15 },
      { step: 4, label: "A quick hello", minutes: 10 },
    ];
    const { relay } = fakeRelay("connected", { ok: true, ladder: bad });
    const out = await runLadderAgent(
      { relay, cloud: null, budgetMs: 8000, now: () => MORNING, fetch: null },
      { ask: "Fairlane walk", total_minutes: 60 },
      noop,
    );
    expect(out.tier).toBe("hub");
    expect(out.steps?.[0]?.label).toBe("The full plan");
    expect(out.repaired).toBeGreaterThan(0);
  });

  it("reports timeout, hub error and invalid like the plain route", async () => {
    const run = async (reply: unknown) =>
      runLadderAgent(
        { relay: fakeRelay("connected", reply).relay, cloud: null, budgetMs: 8000, now: () => MORNING, fetch: null },
        { ask: "walk", total_minutes: 60 },
        noop,
      );
    expect(await run(null)).toMatchObject({ steps: null, tier: null, fallback: "timeout" });
    expect(await run({ ok: false, error: "x" })).toMatchObject({ steps: null, fallback: "hub_error" });
    const empty = [1, 2, 3, 4].map((step) => ({ step, label: "", minutes: 5 }));
    expect(await run({ ok: true, ladder: empty })).toMatchObject({ steps: null, fallback: "invalid" });
  });

  it("uses DigitalOcean only when the hub is absent", async () => {
    const calls: unknown[] = [];
    const cloud = {
      model: "gemma-4-31B-it",
      async ladder(i: unknown) {
        calls.push(i);
        return templateLadder(60).map((s, i) => ({
          ...s,
          label: ["Long walk", "Short walk", "Lap", "Hello"][i] ?? "",
        }));
      },
    };
    const absent = await runLadderAgent(
      { relay: fakeRelay("absent").relay, cloud, budgetMs: 8000, now: () => MORNING, fetch: null },
      { ask: "walk", total_minutes: 60 },
      noop,
    );
    expect(absent).toMatchObject({ tier: "cloud" });
    expect(calls).toEqual([{ ask: "walk", total_minutes: 60 }]);
    const up = fakeRelay("connected", null);
    const timedOut = await runLadderAgent(
      { relay: up.relay, cloud, budgetMs: 8000, now: () => MORNING, fetch: null },
      { ask: "walk", total_minutes: 60 },
      noop,
    );
    expect(timedOut.fallback).toBe("timeout");
    expect(calls).toHaveLength(1); // hub up but slow: no cloud call (ADR-0022)
    const none = await runLadderAgent(
      { relay: fakeRelay("absent").relay, cloud: null, budgetMs: 8000, now: () => MORNING, fetch: null },
      { ask: "walk", total_minutes: 60 },
      noop,
    );
    expect(none).toMatchObject({ steps: null, fallback: "hub_absent" });
  });

  it("stops at the budget when the hub hangs", async () => {
    const hang = fakeRelay("connected", () => new Promise(() => {}));
    const t = performance.now();
    const out = await runLadderAgent(
      { relay: hang.relay, cloud: null, budgetMs: 300, now: () => MORNING, fetch: null },
      { ask: "walk", total_minutes: 60 },
      noop,
    );
    expect(out.steps).toBeNull();
    expect(performance.now() - t).toBeLessThan(2000);
  });
});

describe("POST /api/v1/drafts/ladder with LADDER_AGENT on", () => {
  const post = (a: ReturnType<typeof createApp>, body: unknown) =>
    a.request("/api/v1/drafts/ladder", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "agent-test-key-0000001" },
      body: JSON.stringify(body),
    });
  const app = (relay: HubRelay) => {
    const deps = { relay, db: null, version: "t", ladderTimeoutMs: 8000, ladderAgent: true };
    return createApp(deps, buildCtx(deps));
  };

  it("keeps the contract {steps, tier, ms} and calls nothing but the relay and api.weather.gov", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", async (u: string) => {
      urls.push(String(u));
      return new Response("", { status: 503 });
    });
    const { relay, jobs } = fakeRelay("connected");
    const r = await (await post(app(relay), { ask: "Long walk by the Rouge River trail", total_minutes: 60 })).json();
    expect(Object.keys(r).sort()).toEqual(["ms", "steps", "tier"]);
    expect(r.tier).toBe("hub");
    expect(r.steps).toHaveLength(4);
    expect(jobs).toHaveLength(1);
    expect(urls.every((u) => u.startsWith(`${NWS}/`))).toBe(true);
  });

  it("shows the template when the hub is absent and there is no cloud tier", async () => {
    vi.stubGlobal("fetch", async () => new Response("", { status: 503 }));
    const r = await (await post(app(fakeRelay("absent").relay), { ask: "walk", total_minutes: 90 })).json();
    expect(r.tier).toBe("rules");
    expect(r.steps).toEqual(templateLadder(90));
  });

  it("does not fetch weather when the phone sent it", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", async (u: string) => {
      urls.push(String(u));
      return new Response("", { status: 503 });
    });
    const { relay } = fakeRelay("connected");
    const weather = { rain_likely: true, temp_f: 49 };
    await post(app(relay), { ask: "walk", total_minutes: 60, weather });
    expect(urls).toHaveLength(0);
  });
});
