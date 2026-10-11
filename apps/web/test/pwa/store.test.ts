import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { aad, flareCrypto as c } from "../../src/lib/crypto/index.ts";
import { createStore, DAY_MS, type OutboxRecord } from "../../src/lib/store/index.ts";

let n = 0;
const fresh = (clock?: () => number) => createStore(`flare-test-${++n}`, clock);
const GROUP = "11111111-1111-4111-8111-111111111111";
const GATH = "22222222-2222-4222-8222-222222222222";

async function group(s: ReturnType<typeof fresh>) {
  const { key, fragment } = await c.newGroupKey();
  await s.saveGroup({ groupId: GROUP, key, memberId: "m1", token: "t".repeat(22), names: { m1: "Fuego" } });
  return { key, fragment };
}

const item = (idemKey: string, seq: number, path: string, method: OutboxRecord["method"] = "POST"): OutboxRecord => ({
  idemKey,
  seq,
  method,
  path,
  body: {},
  recorded_at: new Date().toISOString(),
  attempts: 0,
  auth: null,
  groupId: GROUP,
});

describe("PW2 store (IndexedDB flare v1)", () => {
  it("SRS-ID-3: keeps the member id, token and a working key across a reopen", async () => {
    const name = `flare-test-${++n}`;
    const s1 = createStore(name);
    const { key, fragment } = await c.newGroupKey();
    await s1.saveGroup({ groupId: GROUP, key, memberId: "m1", token: "tok", names: {} });
    const sealed = await c.sealJson(key, aad.notice(GATH), { v: 1 });
    s1.close();
    const s2 = createStore(name);
    const g = await s2.group(GROUP);
    if (!g) throw new Error("group not saved");
    expect(g.memberId).toBe("m1");
    expect(g.token).toBe("tok");
    expect(g.key.extractable).toBe(false);
    expect(await c.openJson(g.key, aad.notice(GATH), sealed)).toEqual({ v: 1 });
    expect(await c.placeHash(g.key, "p")).toBe(await c.placeHash(key, "p"));
    expect(await s2.fragment(GROUP)).toBe(fragment);
  });

  it("refuses a key with no fragment (it could never make a link)", async () => {
    const s = fresh();
    const raw = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt"]);
    await expect(s.saveGroup({ groupId: GROUP, key: raw, memberId: "m", token: "t", names: {} })).rejects.toThrow(
      /fragment/,
    );
  });

  it("SRS-OFF-1: saves Lit data and drops it 24 h later", async () => {
    let now = 1_000_000;
    const s = fresh(() => now);
    await s.saveLit(GATH, { spot: "pond", target: { lat: 42.3, lon: -83.2 } });
    expect(await s.lit(GATH)).toEqual({ spot: "pond", target: { lat: 42.3, lon: -83.2 } });
    now += DAY_MS + 1;
    expect(await s.lit(GATH)).toBeNull();
  });

  it("A4: at Gone deletes lit and conditions, keeps the ticket; tickets go 24 h after Gone", async () => {
    let now = 5_000_000;
    const s = fresh(() => now);
    await group(s);
    await s.rememberGathering(GATH, GROUP);
    await s.saveLit(GATH, { a: 1 });
    await s.saveConditions(GATH, "only with Amor");
    await s.saveTicket(GATH, "ticket");
    await s.gone(GATH);
    expect(await s.lit(GATH)).toBeNull();
    expect(await s.conditions(GATH)).toBeNull();
    expect(await s.ticket(GATH)).toBe("ticket");
    now += DAY_MS + 1;
    expect(await s.sweep()).toBe(1);
    expect(await s.ticket(GATH)).toBeNull();
  });

  it("A4 version guard: an older version is refused", async () => {
    const s = fresh();
    expect(await s.saveSeen(GATH, 3, GROUP)).toBe(true);
    expect(await s.saveSeen(GATH, 2)).toBe(false);
    expect(await s.seenVersion(GATH)).toBe(3);
    expect(await s.saveSeen(GATH, 4)).toBe(true);
    expect((await s.groupOf(GATH))?.groupId).toBeUndefined();
  });

  it("PW2 done-when: Forget clears everything for that group and keeps its forget request", async () => {
    const s = fresh();
    await group(s);
    await s.rememberGathering(GATH, GROUP);
    await s.saveLit(GATH, { a: 1 });
    await s.saveConditions(GATH, "x");
    await s.saveTicket(GATH, "t");
    await s.saveNeeds({ steps: false });
    await s.outboxPut(item("a".repeat(22), 1, `/api/v1/gatherings/${GATH}/me`));
    await s.outboxPut(item("b".repeat(22), 2, `/api/v1/groups/${GROUP}/members/m1`, "DELETE"));
    await s.outboxPut({ ...item("c".repeat(22), 3, "/api/v1/groups"), groupId: null });
    await s.forget(GROUP);
    expect(await s.group(GROUP)).toBeNull();
    expect(await s.fragment(GROUP)).toBeNull();
    expect(await s.lit(GATH)).toBeNull();
    expect(await s.conditions(GATH)).toBeNull();
    expect(await s.ticket(GATH)).toBeNull();
    expect(await s.seenVersion(GATH)).toBe(0);
    expect((await s.outboxAll()).map((r) => r.idemKey)).toEqual(["b".repeat(22), "c".repeat(22)]);
    expect(await s.needs()).toEqual({ steps: false });
  });

  it("outbox rows come back in creation order and expire after 24 h", async () => {
    const s = fresh(() => Date.now() + DAY_MS + 5);
    await s.outboxPut(item("z".repeat(22), 2, "/b"));
    await s.outboxPut(item("y".repeat(22), 1, "/a"));
    expect((await s.outboxAll()).map((r) => r.path)).toEqual(["/a", "/b"]);
    expect(await s.sweep()).toBe(2);
    expect(await s.outboxAll()).toEqual([]);
  });
});
