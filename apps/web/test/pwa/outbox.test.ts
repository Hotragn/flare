import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { flareCrypto as c } from "../../src/lib/crypto/index.ts";
import { createOutbox, OutboxRejected } from "../../src/lib/outbox/index.ts";
import { createStore, DAY_MS } from "../../src/lib/store/index.ts";
import { type FakeApi, startFakeApi } from "./fakes/api.ts";

const GROUP = "11111111-1111-4111-8111-111111111111";
const GATH = "22222222-2222-4222-8222-222222222222";
let n = 0;
let api: FakeApi;

beforeEach(async () => {
  api = await startFakeApi();
});
afterEach(async () => {
  await api.close();
});

/** A fetch that can be switched off, like airplane mode. */
function radio() {
  const r: { on: boolean; fetch: typeof fetch } = {
    on: true,
    fetch: ((input: RequestInfo | URL, init?: RequestInit) =>
      r.on ? fetch(input, init) : Promise.reject(new TypeError("Failed to fetch"))) as typeof fetch,
  };
  return r;
}

async function setup(now?: () => number) {
  const store = createStore(`outbox-test-${++n}`, now);
  const { key } = await c.newGroupKey();
  await store.saveGroup({ groupId: GROUP, key, memberId: "m1", token: "tok_tok_tok_tok_tok_to", names: {} });
  await store.rememberGathering(GATH, GROUP);
  const net = radio();
  const dropped: number[] = [];
  const outbox = createOutbox({ store, fetch: net.fetch, base: api.url, now, onDropped: (k) => dropped.push(k) });
  return { store, net, outbox, dropped };
}

const me = (answer: string) => ({ method: "PUT" as const, path: `/api/v1/gatherings/${GATH}/me`, body: { answer } });

describe("PW3 outbox (ADR-0010, A3)", () => {
  it("A3-1: stores before sending and sends with the idempotency key and member auth", async () => {
    const { outbox } = await setup();
    const res = await outbox.send<{ ok: boolean }>(me("yes"));
    expect(res).toEqual({ ok: true, n: 1 });
    expect(api.effects).toHaveLength(1);
    expect(api.effects[0]?.idem).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(await outbox.size()).toBe(0);
  });

  it("SRS-OFF-3: offline taps queue, resolve null, and go out once in order on reconnect", async () => {
    const { outbox, net } = await setup();
    net.on = false;
    expect(await outbox.send(me("yes"))).toBeNull();
    expect(await outbox.send({ method: "DELETE", path: `/api/v1/gatherings/${GATH}/me`, body: undefined })).toBeNull();
    expect(await outbox.size()).toBe(2);
    expect(api.effects).toHaveLength(0);
    net.on = true;
    expect(await outbox.flush()).toEqual({ sent: 2, dropped: 0, left: 0 });
    expect(api.effects.map((e) => e.method)).toEqual(["PUT", "DELETE"]);
    expect(await outbox.flush()).toEqual({ sent: 0, dropped: 0, left: 0 });
    expect(api.effects).toHaveLength(2);
  });

  it("T-OFF-2 / SRS-REL-2: a lost response is retried with the same key and has one effect", async () => {
    const { outbox } = await setup();
    api.faults = ["drop"];
    expect(await outbox.send(me("yes"))).toBeNull();
    expect(api.effects).toHaveLength(1);
    const r = await outbox.flush();
    expect(r).toEqual({ sent: 1, dropped: 0, left: 0 });
    expect(api.effects).toHaveLength(1);
    expect(api.replays).toBe(1);
  });

  it("A3-4: a 5xx stops the flush so a take-back can't overtake its yes", async () => {
    const { outbox } = await setup();
    api.faults = ["error", "error"];
    expect(await outbox.send(me("yes"))).toBeNull();
    expect(await outbox.send({ method: "DELETE", path: `/api/v1/gatherings/${GATH}/me`, body: undefined })).toBeNull();
    expect(api.effects).toHaveLength(0);
    await outbox.flush();
    expect(api.effects.map((e) => e.method)).toEqual(["PUT", "DELETE"]);
  });

  it("A3-3: a 4xx removes the item and rejects with the error code", async () => {
    const { outbox } = await setup();
    const p = outbox.send({ method: "POST", path: `/api/v1/gatherings/${GATH}/reject`, body: {} });
    await expect(p).rejects.toBeInstanceOf(OutboxRejected);
    await expect(p).rejects.toMatchObject({ status: 409, code: "already_lit" });
    expect(await outbox.size()).toBe(0);
  });

  it("A3-6: items older than 24 h are dropped and the person is told once", async () => {
    let now = Date.now();
    const { outbox, net, dropped } = await setup(() => now);
    net.on = false;
    await outbox.send(me("yes"));
    await outbox.send(me("cant_make_it"));
    now += DAY_MS + 1000;
    net.on = true;
    expect(await outbox.flush()).toEqual({ sent: 0, dropped: 2, left: 0 });
    expect(dropped).toEqual([2]);
    expect(api.effects).toHaveLength(0);
  });

  it("T-OFF-2 under a flaky network: 20 taps, random drops and errors, every tap applied exactly once", async () => {
    const { outbox, net } = await setup();
    let seed = 42;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed / 2 ** 31;
    };
    api.faults = Array.from({ length: 200 }, () => {
      const x = rand();
      return x < 0.3 ? "drop" : x < 0.45 ? "error" : "none";
    });
    for (let i = 0; i < 20; i++) {
      net.on = rand() > 0.2;
      await outbox.send({ method: "POST", path: `/api/v1/gatherings/${GATH}/arrivals`, body: { i } });
    }
    net.on = true;
    for (let k = 0; k < 50 && (await outbox.size()) > 0; k++) await outbox.flush();
    expect(await outbox.size()).toBe(0);
    expect(api.effects.map((e) => (e.body as { i: number }).i)).toEqual(Array.from({ length: 20 }, (_, i) => i));
    expect(new Set(api.effects.map((e) => e.idem)).size).toBe(20);
  });

  it("a queued forget still authenticates after the group record is gone", async () => {
    const { outbox, net, store } = await setup();
    net.on = false;
    await outbox.send({ method: "DELETE", path: `/api/v1/groups/${GROUP}/members/m1`, body: {} });
    await store.forget(GROUP);
    net.on = true;
    expect(await outbox.flush()).toMatchObject({ sent: 1, left: 0 });
    expect(api.effects[0]?.path).toBe(`/api/v1/groups/${GROUP}/members/m1`);
  });

  it("A3-5: start() flushes on the online event", async () => {
    const { outbox, net } = await setup();
    net.on = false;
    await outbox.send(me("yes"));
    const target = new EventTarget();
    const stop = outbox.start(target);
    net.on = true;
    target.dispatchEvent(new Event("online"));
    for (let k = 0; k < 50 && api.effects.length === 0; k++) await new Promise((r) => setTimeout(r, 10));
    stop();
    expect(api.effects).toHaveLength(1);
  });
});
