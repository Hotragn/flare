import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createLive, type LiveStatus, type LiveView, OffsetTracker, sseParser } from "../../src/lib/live/index.ts";
import { createStore } from "../../src/lib/store/index.ts";
import { type FakeApi, startFakeApi, type View } from "./fakes/api.ts";

const GROUP = "11111111-1111-4111-8111-111111111111";
const GATH = "22222222-2222-4222-8222-222222222222";
let n = 0;
let api: FakeApi;

const view = (version: number, extra: Partial<View> = {}): View => ({
  id: GATH,
  group_id: GROUP,
  state: "kindling",
  need: 2,
  version,
  server_time: new Date().toISOString(),
  ...extra,
});

async function until(check: () => boolean, ms = 3000) {
  const t = Date.now();
  while (!check()) {
    if (Date.now() - t > ms) throw new Error("timed out");
    await new Promise((r) => setTimeout(r, 10));
  }
}

beforeEach(async () => {
  api = await startFakeApi();
});
afterEach(async () => {
  await api.close();
});

function setup(o: { pollMs?: number; offlineAfterMs?: number; fetch?: typeof fetch } = {}) {
  const store = createStore(`live-test-${++n}`);
  const doc = Object.assign(new EventTarget(), { visibilityState: "visible" as DocumentVisibilityState });
  const events = new EventTarget();
  const gone: (string | null)[] = [];
  const statuses: LiveStatus[] = [];
  const live = createLive({
    store,
    base: api.url,
    document: doc,
    events,
    ...o,
    onGone: (_id, ended) => gone.push(ended),
    onStatus: (_id, s) => statuses.push(s),
  });
  return { store, live, doc, events, gone, statuses };
}

describe("PW4 live view (ADR-0014, A4)", () => {
  it("parses SSE: ids, events, comments, split chunks", () => {
    const got: { id: string | null; event: string; data: string }[] = [];
    const feed = sseParser((e) => got.push(e));
    feed(": keepalive\n\nid: 3\nevent: gath");
    feed('ering\ndata: {"a":\ndata: 1}\n\n');
    feed("event: gone\r\ndata: x\r\n\r\n");
    expect(got).toEqual([
      { id: "3", event: "gathering", data: '{"a":\n1}' },
      { id: "3", event: "gone", data: "x" },
    ]);
  });

  it("BR-TIME-3: offset is the mean of the last 5 views", () => {
    const t = new OffsetTracker();
    for (const d of [1000, 1000, 1000, 1000, 1000, 6000]) t.add(new Date(10_000 + d).toISOString(), 10_000);
    expect(t.value).toBe(2000);
  });

  it("SRS-SOL-3: a change on the server reaches the page by SSE well under 5 s", async () => {
    api.setView(view(1));
    const { live } = setup();
    const views: LiveView[] = [];
    const stop = live.follow(GATH, (v) => views.push(v));
    await until(() => views.length === 1 && api.sseConnects.length === 1);
    const t0 = Date.now();
    api.push(view(2, { need: 1 }));
    await until(() => views.length === 2);
    expect(Date.now() - t0).toBeLessThan(5000);
    expect(views.map((v) => v.need)).toEqual([2, 1]);
    stop();
  });

  it("PW4 done-when: reconnects with Last-Event-ID after a drop", async () => {
    api.setView(view(4));
    const { live } = setup();
    const views: LiveView[] = [];
    const stop = live.follow(GATH, (v) => views.push(v));
    await until(() => api.sseConnects.length === 1);
    await until(() => views.length === 1);
    api.cutStreams();
    await until(() => api.sseConnects.length === 2, 4000);
    expect(api.sseConnects[1]?.lastEventId).toBe("4");
    api.push(view(5));
    await until(() => views.length === 2);
    stop();
  });

  it("A4 version guard: an older view is ignored", async () => {
    api.setView(view(7));
    const { live } = setup();
    const views: LiveView[] = [];
    const stop = live.follow(GATH, (v) => views.push(v));
    await until(() => api.sseConnects.length === 1 && views.length === 1);
    api.push(view(6, { need: 9 }));
    api.push(view(8, { need: 0 }));
    await until(() => views.length === 2);
    expect(views.map((v) => v.version)).toEqual([7, 8]);
    stop();
  });

  it("SRS-TIME-1: reports the server clock offset", async () => {
    api.skewMs = 120_000;
    api.setView(view(1));
    const { live } = setup();
    let offset = 0;
    const stop = live.follow(GATH, (_v, o) => {
      offset = o;
    });
    await until(() => offset !== 0);
    expect(Math.abs(offset - 120_000)).toBeLessThan(500);
    stop();
  });

  it("A4: on gone, closes, deletes lit and conditions, keeps tickets", async () => {
    api.setView(view(1, { state: "lit" }));
    const { live, store, gone } = setup();
    await store.rememberGathering(GATH, GROUP);
    await store.saveLit(GATH, { spot: "pond" });
    await store.saveConditions(GATH, "back by 5");
    await store.saveTicket(GATH, "tk");
    const stop = live.follow(GATH, () => undefined);
    await until(() => api.sseConnects.length === 1);
    api.gone(GATH, "thanks_for_coming");
    await until(() => gone.length === 1);
    expect(gone).toEqual(["thanks_for_coming"]);
    expect(await store.lit(GATH)).toBeNull();
    expect(await store.conditions(GATH)).toBeNull();
    expect(await store.ticket(GATH)).toBe("tk");
    await new Promise((r) => setTimeout(r, 1200));
    expect(api.sseConnects).toHaveLength(1);
    stop();
  });

  it("SRS-OFF-2: says offline once the stream is down past the limit and the poll failed", async () => {
    api.setView(view(1));
    const net = { on: true };
    const f: typeof fetch = (i, init) => (net.on ? fetch(i, init) : Promise.reject(new TypeError("offline")));
    const { live, statuses, events } = setup({ pollMs: 100, offlineAfterMs: 200, fetch: f });
    const stop = live.follow(GATH, () => undefined);
    await until(() => api.sseConnects.length === 1);
    net.on = false;
    api.cutStreams();
    await until(() => statuses.length === 1, 3000);
    expect(statuses[0]?.online).toBe(false);
    expect(statuses[0]?.savedAt).toMatch(/^\d{4}-/);
    net.on = true;
    events.dispatchEvent(new Event("online"));
    await until(() => statuses.length === 2, 3000);
    expect(statuses[1]?.online).toBe(true);
    stop();
  });

  it("polls every 30 s (here 100 ms) as a backstop", async () => {
    api.setView(view(1));
    const { live } = setup({ pollMs: 100 });
    const stop = live.follow(GATH, () => undefined);
    await new Promise((r) => setTimeout(r, 450));
    stop();
    expect(api.gets).toBeGreaterThanOrEqual(4);
  });
});
