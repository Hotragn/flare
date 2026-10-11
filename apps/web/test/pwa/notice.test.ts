import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { aad, flareCrypto as c } from "../../src/lib/crypto/index.ts";
import { buildNotice, parsePayload } from "../../src/lib/push/notice.ts";
import copy from "../../src/lib/push/push-copy.json" with { type: "json" };
import { createStore } from "../../src/lib/store/index.ts";

const GROUP = "11111111-1111-4111-8111-111111111111";
const GATH = "22222222-2222-4222-8222-222222222222";
let n = 0;

async function phone(withKey = true) {
  const store = createStore(`notice-test-${++n}`);
  const { key, fragment } = await c.newGroupKey();
  if (withKey) {
    await store.saveGroup({ groupId: GROUP, key, memberId: "m1", token: "t", names: {} });
    await store.rememberGathering(GATH, GROUP);
  }
  const notice_ct = await c.sealJson(key, aad.notice(GATH), {
    v: 1,
    host: "Fuego",
    spot: "Ford Woods Park pond",
    benches: { c1: "the bench by the lot" },
    steps: { "step:1": "Long walk", "step:2": "Short walk" },
  });
  return { store, key, fragment, notice_ct };
}

const payload = (event: string, extra: Record<string, unknown> = {}) => ({
  v: 1,
  g: GATH,
  kind: "flare",
  event,
  ...extra,
});

describe("PW5 push notice (ADR-0014, SRS-IF-3)", () => {
  it("copy: push-copy.json matches the deck's push.* strings exactly", () => {
    const deck = JSON.parse(
      readFileSync(new URL("../../../../design/prototype/src/lib/copy/deck.json", import.meta.url), "utf8"),
    ).strings as Record<string, { text: string }>;
    const fromDeck = Object.fromEntries(
      Object.entries(deck)
        .filter(([k]) => k.startsWith("push."))
        .map(([k, v]) => [k, v.text]),
    );
    expect(copy).toEqual(fromDeck);
  });

  it("ADR-0014: opens notice_ct with the key from IndexedDB and writes the readable notice", async () => {
    const { store, notice_ct, fragment } = await phone();
    const nt = await buildNotice(payload("lit", { notice_ct }), store);
    expect(nt.title).toBe("Fuego's Flare");
    expect(nt.body).toBe("It's lit. Fuego is at Ford Woods Park pond.");
    expect(nt.tag).toBe(`flare-${GATH}`);
    expect(nt.url).toBe(`/g/${GATH}/#k=${fragment}`);
  });

  it("ADR-0014: no key on this phone gives the fallback with no names or places", async () => {
    const { store, notice_ct } = await phone(false);
    const nt = await buildNotice(payload("lit", { notice_ct }), store);
    expect(nt).toEqual({
      title: "Flare",
      body: "It's lit. Open Flare to see where.",
      tag: `flare-${GATH}`,
      url: `/g/${GATH}/`,
    });
  });

  it("ADR-0014: a wrong or damaged notice_ct gives the fallback", async () => {
    const { store } = await phone();
    const other = await c.newGroupKey();
    const foreign = await c.sealJson(other.key, aad.notice(GATH), { v: 1, host: "X", spot: "Y" });
    expect((await buildNotice(payload("lit", { notice_ct: foreign }), store)).body).toBe(
      "It's lit. Open Flare to see where.",
    );
    expect((await buildNotice(payload("lit", { notice_ct: "garbage" }), store)).body).toBe(
      "It's lit. Open Flare to see where.",
    );
    expect((await buildNotice(payload("ember", { label: "c1" }), store)).body).toBe(
      "Your Flare changed. Open it to see how.",
    );
  });

  it("covers every event in the contract", async () => {
    const { store, notice_ct } = await phone();
    const at = "2026-10-11T15:30:00.000Z";
    const b = async (event: string, extra: Record<string, unknown>) =>
      (await buildNotice({ ...payload(event, { notice_ct, ...extra }), kind: "plan" }, store, "America/Detroit")).body;
    expect(await b("ember", { label: "c1" })).toBe("Smaller plan: 15 min at the bench by the lot.");
    expect(await b("plan_on", { step: 1, at })).toBe("It's on: Long walk at 11:30 AM.");
    expect(await b("plan_ember", { label: "step:2", at })).toBe("Smaller plan: Short walk at 11:30 AM.");
    expect(await b("plan_smaller", { step: 2 })).toBe("Smaller plan: Short walk.");
    expect(await b("still_coming", { step: 2 })).toBe("Plan changed to Short walk. Still coming?");
    expect(await b("gone", {})).toBe("Not this time.");
    const plan = await buildNotice({ ...payload("plan_on", { notice_ct, step: 1, at }), kind: "plan" }, store);
    expect(plan.title).toBe("Fuego's Plan");
  });

  it("a payload that breaks the contract still shows a notice", async () => {
    const { store } = await phone();
    expect(parsePayload({ v: 2 })).toBeNull();
    expect(parsePayload(payload("party"))).toBeNull();
    const nt = await buildNotice("not json", store);
    expect(nt).toEqual({ title: "Flare", body: "It's lit. Open Flare to see where.", tag: "flare", url: "/app/" });
  });
});
