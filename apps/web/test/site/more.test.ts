import { describe, expect, it } from "vitest";
import {
  ApiError,
  forgetGroup,
  formToNeeds,
  type HotspotEntryT,
  historyLine,
  loadHotspots,
  mergeHotspots,
  needsToForm,
  rankHotspots,
  readNeeds,
  saveNeeds,
  sparkHistory,
} from "../../src/routes/app/(more)/more.ts";
import { groupIdFrom, pick, STORE_METHODS } from "../../src/routes/app/(more)/wire.ts";
import { fakeCrypto, fakeFetch, fakeStore, GROUP, json } from "./fakes/phone.ts";

const spot = (place_key: string, count: number, last_date: string, spark_id: string | null = null): HotspotEntryT => ({
  place_key,
  place_name: `Place ${place_key}`,
  count,
  last_date,
  spark_id,
});
const SPARK_ID = "44444444-4444-4444-8444-444444444444";
const base = `/api/v1/groups/${GROUP.groupId}`;

async function sealedBlob(places: HotspotEntryT[], aad = `h:${GROUP.groupId}` as const) {
  return fakeCrypto().sealJson(GROUP.key, aad, { v: 1, places });
}

describe("SRS-HOT-1 Hot spots order", () => {
  it("orders by count, then most recent", () => {
    const out = rankHotspots([spot("a", 2, "2026-09-01"), spot("b", 5, "2026-08-01"), spot("c", 2, "2026-10-01")]);
    expect(out.map((p) => p.place_key)).toEqual(["b", "c", "a"]);
  });
});

describe("BR-K-6 merge", () => {
  it("takes the max count per place and keeps the newer Spark", () => {
    const out = mergeHotspots(
      [spot("a", 3, "2026-09-01", null), spot("b", 1, "2026-09-02")],
      [spot("a", 2, "2026-10-01", SPARK_ID)],
    );
    const a = out.find((p) => p.place_key === "a");
    expect(a).toMatchObject({ count: 3, last_date: "2026-10-01", spark_id: SPARK_ID });
    expect(out).toHaveLength(2);
  });
});

describe("BR-K-6 loading the sealed blob", () => {
  it("opens with AAD h:{groupId} and sends the member bearer", async () => {
    const blob_ct = await sealedBlob([spot("a", 1, "2026-09-01"), spot("b", 4, "2026-09-01")]);
    const f = fakeFetch({ [`${base}/hotspots`]: () => json({ blob_ct, version: 3 }) });
    const out = await loadHotspots({ fetch: f.fetch, crypto: fakeCrypto() }, GROUP);
    expect(out.map((p) => p.place_key)).toEqual(["b", "a"]);
    expect(f.calls[0].headers.authorization).toBe(`Bearer ${GROUP.memberId}.${GROUP.token}`);
  });
  it("404 is an empty list", async () => {
    const f = fakeFetch({ [`${base}/hotspots`]: () => json({ code: "not_found" }, 404) });
    expect(await loadHotspots({ fetch: f.fetch, crypto: fakeCrypto() }, GROUP)).toEqual([]);
  });
  it("a blob sealed for another record (wrong AAD) renders as empty, not garbage", async () => {
    const blob_ct = await fakeCrypto().sealJson(GROUP.key, "h:other", { v: 1, places: [spot("a", 1, "2026-09-01")] });
    const f = fakeFetch({ [`${base}/hotspots`]: () => json({ blob_ct, version: 1 }) });
    expect(await loadHotspots({ fetch: f.fetch, crypto: fakeCrypto() }, GROUP)).toEqual([]);
  });
  it("maps failures to copy kinds", async () => {
    const off = fakeFetch({ [`${base}/hotspots`]: () => "offline" });
    await expect(loadHotspots({ fetch: off.fetch, crypto: fakeCrypto() }, GROUP)).rejects.toMatchObject({
      kind: "network",
    });
    const busy = fakeFetch({ [`${base}/hotspots`]: () => json({}, 429) });
    await expect(loadHotspots({ fetch: busy.fetch, crypto: fakeCrypto() }, GROUP)).rejects.toBeInstanceOf(ApiError);
  });
});

describe("BR-K-5 / SRS-SPK-2 history line", () => {
  it("shows nothing below one meetup", () => {
    expect(historyLine([], "a", null)).toBeNull();
  });
  it("shows N and the newest Spark", () => {
    expect(historyLine([spot("a", 3, "2026-09-01")], "a", "  Bring a blanket ")).toEqual({
      times: 3,
      spark: "Bring a blanket",
    });
  });
  it("end to end: hashes the place key, opens the Spark with s:{groupId}:{sparkId}", async () => {
    const c = fakeCrypto();
    const blob_ct = await sealedBlob([spot("osm:node/1", 2, "2026-09-01", SPARK_ID)]);
    const text_ct = await c.seal(
      GROUP.key,
      `s:${GROUP.groupId}:${SPARK_ID}`,
      new TextEncoder().encode("Ducks by the bench"),
    );
    const hash = await c.placeHash(GROUP.key, "osm:node/1");
    const f = fakeFetch({
      [`${base}/hotspots`]: () => json({ blob_ct, version: 1 }),
      [`${base}/sparks?place=${hash}`]: () => json({ sparks: [{ id: SPARK_ID, text_ct, created_on: "2026-09-01" }] }),
    });
    expect(await sparkHistory({ fetch: f.fetch, crypto: c }, GROUP, "osm:node/1")).toEqual({
      times: 2,
      spark: "Ducks by the bench",
    });
    // The place key itself never goes to the server, only its hash.
    expect(f.calls.some((r) => r.url.includes("osm"))).toBe(false);
  });
  it("count alone when the Spark can't be fetched", async () => {
    const blob_ct = await sealedBlob([spot("a", 1, "2026-09-01", SPARK_ID)]);
    const f = fakeFetch({
      [`${base}/hotspots`]: () => json({ blob_ct, version: 1 }),
      [`${base}/sparks`]: () => "offline",
    });
    expect(await sparkHistory({ fetch: f.fetch, crypto: fakeCrypto() }, GROUP, "a")).toEqual({ times: 1, spark: null });
  });
});

describe("SRS-ID-6 Forget this group", () => {
  const route = `${base}/members/${GROUP.memberId}`;
  it("deletes on the server first, then on the phone", async () => {
    const store = fakeStore([GROUP]);
    const f = fakeFetch({ [route]: () => json({ last_member: true, sparks_deleted: 2 }) });
    const out = await forgetGroup({ fetch: f.fetch, store, idemKey: () => "idem-1" }, GROUP, ["t1", "t2"]);
    expect(out).toEqual({ lastMember: true, sparksDeleted: 2 });
    expect(f.calls[0]).toMatchObject({ method: "DELETE" });
    expect(f.calls[0].headers["idempotency-key"]).toBe("idem-1");
    expect(JSON.parse(f.calls[0].body ?? "{}")).toEqual({ spark_delete_tokens: ["t1", "t2"] });
    expect(await store.group(GROUP.groupId)).toBeNull();
  });
  it("keeps the group on this phone when the server can't be reached", async () => {
    const store = fakeStore([GROUP]);
    const f = fakeFetch({ [route]: () => "offline" });
    await expect(forgetGroup({ fetch: f.fetch, store, idemKey: () => "i" }, GROUP)).rejects.toMatchObject({
      kind: "network",
    });
    expect(await store.group(GROUP.groupId)).not.toBeNull();
  });
  it("forgets locally when the server already has nothing (401 or 404)", async () => {
    for (const status of [401, 404]) {
      const store = fakeStore([GROUP]);
      const f = fakeFetch({ [route]: () => json({}, status) });
      await forgetGroup({ fetch: f.fetch, store, idemKey: () => "i" }, GROUP);
      expect(await store.group(GROUP.groupId)).toBeNull();
    }
  });
  it("keeps the group on a 500", async () => {
    const store = fakeStore([GROUP]);
    const f = fakeFetch({ [route]: () => json({}, 500) });
    await expect(forgetGroup({ fetch: f.fetch, store, idemKey: () => "i" }, GROUP)).rejects.toMatchObject({
      kind: "server",
    });
    expect(await store.group(GROUP.groupId)).not.toBeNull();
  });
});

describe("SRS-ACC-1 / BR-A-1 needs profile", () => {
  it("round-trips through the form", () => {
    const n = { avoid_steps: true, rest_gap_m: 200 as const, restroom_300m: false };
    expect(formToNeeds(needsToForm(n))).toEqual(n);
    expect(formToNeeds(needsToForm({ ...n, rest_gap_m: null }))).toEqual({ ...n, rest_gap_m: null });
  });
  it("unanswered counts as no need", () => {
    expect(formToNeeds({ steps: "", rest: "", wc: "" })).toEqual({
      avoid_steps: false,
      rest_gap_m: null,
      restroom_300m: false,
    });
  });
  it("is saved only in the phone store and nothing else is called", async () => {
    const store = fakeStore();
    let fetched = 0;
    const orig = globalThis.fetch;
    globalThis.fetch = (async () => {
      fetched++;
      return new Response();
    }) as typeof fetch;
    try {
      await saveNeeds(store, { steps: "yes", rest: "100", wc: "yes" });
    } finally {
      globalThis.fetch = orig;
    }
    expect(fetched).toBe(0);
    expect(await readNeeds(store)).toEqual({ avoid_steps: true, rest_gap_m: 100, restroom_300m: true });
  });
  it("a damaged profile reads as unset", async () => {
    const store = fakeStore();
    await store.saveNeeds({ avoid_steps: "maybe" });
    expect(await readNeeds(store)).toBeNull();
  });
});

describe("wiring", () => {
  it("accepts a ?g= UUID v4 only", () => {
    expect(groupIdFrom(new URL(`https://x/app/hotspots/?g=${GROUP.groupId}`))).toBe(GROUP.groupId);
    expect(groupIdFrom(new URL("https://x/app/hotspots/?g=../../etc"))).toBeNull();
  });
  it("finds the ICD object by shape, as an export or from a create* factory", async () => {
    const s = fakeStore();
    expect(await pick({ store: s }, STORE_METHODS)).toBe(s);
    expect(await pick({ createStore: () => s }, STORE_METHODS)).toBe(s);
    expect(await pick({ other: {} }, STORE_METHODS)).toBeNull();
  });
});
