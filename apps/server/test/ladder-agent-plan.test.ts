// ADR-0025 follow-up: the plan's start time and coarse area feed the tools, caches keep the
// tools cheap, and the activity the ask names beats the weather.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { askedActivity, keepAsked } from "../src/agent/constraints.ts";
import { runLadderAgent } from "../src/agent/ladder-agent.ts";
import { clearToolCaches, NWS, resolveArea, sunsetWindow, toolCacheStats, weatherWindow } from "../src/agent/tools.ts";
import { buildCtx, createApp } from "../src/app.ts";
import type { HubRelay } from "../src/hub/relay.ts";

const MORNING = new Date("2026-10-11T14:43:00Z"); // 10:43 EDT
const TOMORROW_11 = new Date("2026-10-12T15:00:00Z"); // 11:00 EDT
const noop = { set() {} };

const STEPS = [
  { step: 1, label: "Walk by Rouge River", minutes: 60 },
  { step: 2, label: "A shorter loop", minutes: 30 },
  { step: 3, label: "A quick lap", minutes: 15 },
  { step: 4, label: "Sit by the water", minutes: 10 },
];
const RAINY = [
  { step: 1, label: "Indoor activity", minutes: 50 },
  { step: 2, label: "Short walk", minutes: 25 },
  { step: 3, label: "Sit down", minutes: 15 },
  { step: 4, label: "Quick look", minutes: 10 },
];
const PERIODS = [
  {
    startTime: "2026-10-11T14:00:00Z",
    endTime: "2026-10-11T16:00:00Z",
    temperature: 50,
    temperatureUnit: "F",
    probabilityOfPrecipitation: { value: 90 },
  },
  {
    startTime: "2026-10-12T15:00:00Z",
    endTime: "2026-10-12T17:00:00Z",
    temperature: 66,
    temperatureUnit: "F",
    probabilityOfPrecipitation: { value: 5 },
  },
];

type Job = { ask: string; total_minutes: number; weather?: { rain_likely?: boolean } };
function fakeRelay(reply: unknown = { ok: true, model: "gemma4", ladder: STEPS }) {
  const jobs: Job[] = [];
  const relay = {
    status: "connected",
    async ladder(job: Job) {
      jobs.push(job);
      return reply;
    },
  };
  return { relay: relay as unknown as HubRelay, jobs };
}
function fakeNws(periods: unknown[]) {
  const urls: string[] = [];
  const f = (async (url: string) => {
    urls.push(url);
    if (url.includes("/points/"))
      return Response.json({ properties: { forecastHourly: `${NWS}/gridpoints/DTX/60,40/forecast/hourly` } });
    return Response.json({ properties: { periods } });
  }) as unknown as typeof fetch;
  return { f, urls };
}

beforeEach(() => clearToolCaches());
afterEach(() => vi.unstubAllGlobals());

describe("plan time and area", () => {
  it("resolves an area label to its 0.1° cell; unknown labels fall back to the pack centre", () => {
    expect(resolveArea(undefined)).toEqual({ label: "fairlane", cell: { lat: 42.3, lon: -83.2 }, known: true });
    expect(resolveArea("FAIRLANE")?.known).toBe(true);
    const hines = resolveArea("Hines Parkway");
    expect(hines).toMatchObject({ label: "Hines Parkway", known: true });
    expect(hines?.cell).toEqual({ lat: 42.4, lon: -83.4 });
    expect(resolveArea("Somewhere else")).toMatchObject({ label: "fairlane", known: false });
  });

  it("the weather window follows start_at, not now", async () => {
    const n = fakeNws(PERIODS);
    expect(await weatherWindow(60, MORNING, { fetch: n.f, now: MORNING })).toEqual({ rain_likely: true, temp_f: 50 });
    expect(await weatherWindow(60, TOMORROW_11, { fetch: n.f, now: MORNING })).toEqual({
      rain_likely: false,
      temp_f: 66,
    });
  });

  it("sunset is for the plan's day and start", () => {
    const evening = new Date("2026-10-12T22:30:00Z"); // 18:30 EDT tomorrow
    expect(sunsetWindow(60, evening).ends_after_dark).toBe(true);
    expect(sunsetWindow(60, TOMORROW_11).ends_after_dark).toBe(false);
  });

  it("caches the forecast per (cell, 15 minutes) and sunset per (cell, start bucket); failures are not cached", async () => {
    const n = fakeNws(PERIODS);
    await weatherWindow(60, MORNING, { fetch: n.f, now: MORNING });
    await weatherWindow(90, TOMORROW_11, { fetch: n.f, now: new Date(MORNING.getTime() + 60_000) });
    expect(n.urls).toHaveLength(2); // one points call and one forecast call
    await weatherWindow(60, MORNING, { fetch: n.f, now: new Date(MORNING.getTime() + 20 * 60_000) });
    expect(n.urls).toHaveLength(4); // next bucket: fetched again
    await weatherWindow(60, MORNING, { fetch: n.f, now: MORNING, at: { lat: 42.37, lon: -83.36 } });
    expect(n.urls).toHaveLength(6); // another cell
    const down = vi.fn(async () => new Response("", { status: 503 }));
    const later = new Date(MORNING.getTime() + 60 * 60_000);
    await weatherWindow(60, MORNING, { fetch: down as unknown as typeof fetch, now: later });
    await weatherWindow(60, MORNING, { fetch: down as unknown as typeof fetch, now: later });
    expect(down).toHaveBeenCalledTimes(2);
    sunsetWindow(60, MORNING);
    sunsetWindow(120, new Date(MORNING.getTime() + 60_000));
    expect(toolCacheStats()).toMatchObject({ sunset_misses: 1, sunset_hits: 1, weather_hits: 1 });
  });

  it("the agent reads weather for start_at and area, and sends the hub neither", async () => {
    const n = fakeNws(PERIODS);
    const { relay, jobs } = fakeRelay();
    const out = await runLadderAgent(
      { relay, cloud: null, budgetMs: 8000, now: () => MORNING, fetch: n.f },
      { ask: "Walk by the rouge river", total_minutes: 60, start_at: TOMORROW_11.toISOString(), area: "fairlane" },
      noop,
    );
    expect(out.weather).toBe("tool");
    expect(jobs[0]).toEqual({
      ask: "Walk by the Rouge River",
      total_minutes: 60,
      weather: { rain_likely: false, temp_f: 66 },
    });
    expect(n.urls[0]).toBe(`${NWS}/points/42.3,-83.2`);
  });

  it("without start_at the agent keeps today's behaviour (from now)", async () => {
    const n = fakeNws(PERIODS);
    const { relay, jobs } = fakeRelay();
    await runLadderAgent(
      { relay, cloud: null, budgetMs: 8000, now: () => MORNING, fetch: n.f },
      { ask: "walk", total_minutes: 60 },
      noop,
    );
    expect(jobs[0]?.weather).toEqual({ rain_likely: true, temp_f: 50 });
  });

  it("the route accepts start_at and area, and refuses an area that looks like coordinates", async () => {
    vi.stubGlobal("fetch", async () => new Response("", { status: 503 }));
    const deps = { relay: fakeRelay().relay, db: null, version: "t", ladderTimeoutMs: 8000, ladderAgent: true };
    const a = createApp(deps, buildCtx(deps));
    const post = (body: unknown) =>
      a.request("/api/v1/drafts/ladder", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": "agent-test-key-0000002" },
        body: JSON.stringify(body),
      });
    const ok = await post({
      ask: "walk",
      total_minutes: 60,
      start_at: "2026-10-12T11:00:00-04:00",
      area: "Ford Woods Park",
    });
    expect(ok.status).toBe(200);
    expect((await post({ ask: "walk", total_minutes: 60, area: "42.3,-83.2" })).status).toBe(400);
    expect((await post({ ask: "walk", total_minutes: 60, start_at: "tomorrow" })).status).toBe(400);
  });
});

describe("user constraints beat weather", () => {
  it("finds the asked activity and condition", () => {
    expect(askedActivity("Kite flying if windy")).toEqual({
      label: "Kite flying if windy",
      stem: "kite",
      condition: "if windy",
    });
    expect(askedActivity("Morning bike ride, easy pace")?.label).toBe("Bike ride");
    expect(askedActivity("Frisbee on the big lawn")?.label).toBe("Frisbee");
    expect(askedActivity("Coffee then a walk")).toBeNull();
    expect(askedActivity("Rainy day stroll near the mall")).toBeNull();
  });

  it("puts the asked activity back on step 1 and leaves the other steps to the weather", () => {
    const k = keepAsked(RAINY, "Kite flying if windy", true);
    expect(k.changed).toBe(true);
    expect(k.ladder[0]?.label).toBe("Kite flying if windy");
    expect(k.ladder.slice(1)).toEqual(RAINY.slice(1));
    expect(keepAsked(RAINY, "Frisbee on the big lawn", true).ladder[0]?.label).toBe("Frisbee if dry");
    expect(keepAsked(RAINY, "Frisbee on the big lawn", false).ladder[0]?.label).toBe("Frisbee");
    const already = [{ step: 1, label: "Kite flying", minutes: 50 }, ...RAINY.slice(1)];
    expect(keepAsked(already, "Kite flying if windy", true).changed).toBe(false);
    expect(keepAsked(RAINY, "Coffee then a walk", true).changed).toBe(false);
  });

  it("the agent keeps 'Kite flying if windy' when the forecast says rain", async () => {
    const n = fakeNws([
      {
        startTime: "2026-10-11T14:00:00Z",
        endTime: "2026-10-11T16:00:00Z",
        temperature: 52,
        temperatureUnit: "F",
        probabilityOfPrecipitation: { value: 80 },
      },
    ]);
    const { relay, jobs } = fakeRelay({ ok: true, ladder: RAINY });
    const out = await runLadderAgent(
      { relay, cloud: null, budgetMs: 8000, now: () => MORNING, fetch: n.f },
      { ask: "Kite flying if windy", total_minutes: 50 },
      noop,
    );
    expect(jobs[0]?.weather).toEqual({ rain_likely: true, temp_f: 52 });
    expect(out.kept).toBe(true);
    expect(out.tier).toBe("hub");
    expect(out.steps?.map((s) => s.label)).toEqual(["Kite flying if windy", "Short walk", "Sit down", "Quick look"]);
  });
});
