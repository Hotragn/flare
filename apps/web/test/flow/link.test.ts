// Invitee link page flow (FE3) over the ICD fakes. Test names carry the rule ids.
import { describe, expect, it } from "vitest";
import { LinkFlow } from "../../src/lib/screens/flow/link.svelte.ts";
import { fakeDeps } from "../fakes/index.ts";
import { seedFlare } from "../fakes/seed.ts";

const settle = () => new Promise((r) => setTimeout(r, 0));

async function opened(opts: Parameters<typeof seedFlare>[1] = {}) {
  const f = fakeDeps();
  const s = await seedFlare(f, opts);
  const flow = new LinkFlow(f.deps, s.id);
  await flow.open(s.fragment);
  return { f, s, flow };
}

describe("link page (FE3)", () => {
  it("SRS-RES-1: opens with no account and shows invite, spot and Need N more", async () => {
    const { flow } = await opened();
    expect(flow.screen).toBe("invite");
    expect(flow.info?.words).toBe("Golden pond, come sit with me");
    expect(flow.info?.spot).toBe("Ford Woods Park, by the pond");
    expect(flow.view?.need).toBe(1);
    expect(flow.have).toBe(1);
  });

  it("SRS-RES-2: a missing key shows the missing-key screen and no photo", async () => {
    const f = fakeDeps();
    const s = await seedFlare(f, { photo: true });
    const flow = new LinkFlow(f.deps, s.id);
    await flow.open(null);
    expect(flow.screen).toBe("missing-key");
    expect(flow.photo).toBe("");
    expect(flow.sealed).toBeNull();
  });

  it("SRS-RES-2: a wrong key reads as a missing key", async () => {
    const f = fakeDeps();
    const s = await seedFlare(f);
    const other = await f.crypto.newGroupKey();
    const flow = new LinkFlow(f.deps, s.id);
    await flow.open(other.fragment);
    expect(flow.screen).toBe("missing-key");
    expect(flow.info).toBeNull();
  });

  it("SRS-ID-3, SRS-ID-4: first I'm in asks for a name, joins with a sealed name and a fresh member id", async () => {
    const { f, s, flow } = await opened();
    flow.yes();
    expect(flow.screen).toBe("join");
    await flow.join("Amor");
    const rec = await f.store.group(s.groupId);
    expect(f.store.remembered.get(s.id)).toBe(s.groupId); // the service worker finds the key for push
    expect(rec?.memberId).toMatch(/^[0-9a-f-]{36}$/);
    const join = f.outbox.sent.find((x) => x.path.endsWith("/members"));
    expect(JSON.stringify(join?.body)).not.toContain("Amor"); // only ciphertext leaves the phone
  });

  it("SRS-RES-3: You're in shows before the server answers, then the server confirms", async () => {
    const { f, flow } = await opened();
    flow.yes();
    const joining = flow.join("Amor");
    await joining;
    expect(flow.screen === "in" || flow.screen === "lit").toBe(true);
    await settle();
    expect(f.outbox.sent.some((x) => x.method === "PUT" && x.path.endsWith("/me"))).toBe(true);
  });

  it("SRS-RES-3: the optimistic screen comes within 500 ms of the tap", async () => {
    const { flow } = await opened({ quorum: 3 });
    flow.yes();
    await flow.join("Amor");
    flow.screen = "invite";
    const t0 = performance.now();
    flow.yes(); // already a member: no join step
    const ms = performance.now() - t0;
    expect(flow.screen).toBe("in");
    expect(ms).toBeLessThan(500);
  });

  it("BR-Q-1, BR-Q-4: quorum 2 with the host lights on the first yes", async () => {
    const { flow } = await opened({ quorum: 2 });
    flow.yes();
    await flow.join("Amor");
    await settle();
    expect(flow.view?.state).toBe("lit");
    expect(flow.screen).toBe("lit");
  });

  it("SRS-RES-6: before Lit, Take it back removes the yes", async () => {
    const { f, flow } = await opened({ quorum: 3 });
    flow.yes();
    await flow.join("Amor");
    await settle();
    await flow.takeBack();
    expect(flow.takenBack).toBe(true);
    expect(f.outbox.sent.at(-1)?.method).toBe("DELETE");
    expect(flow.view?.need).toBe(2);
  });

  it("SRS-RES-6: after Lit, Can't make it keeps the state Lit", async () => {
    const { flow } = await opened({ quorum: 2 });
    flow.yes();
    await flow.join("Amor");
    await settle();
    await flow.cantMakeIt();
    expect(flow.me?.answer).toBe("cant_make_it");
    expect(flow.view?.state).toBe("lit");
  });

  it("SRS-COND-5, BR-C-10: a condition goes through the read-back; only rules are sent", async () => {
    const { f, flow } = await opened({ quorum: 3 });
    flow.yes();
    await flow.join("Amor");
    flow.screen = "invite";
    flow.startCondition();
    flow.check("back by 5");
    expect(flow.screen).toBe("readback");
    expect(flow.readBack.split(/\s+/).length).toBeLessThanOrEqual(12);
    expect(flow.chips).toEqual(["Back by 5:00 PM"]);
    flow.confirmReadBack();
    await settle();
    const put = f.outbox.sent.filter((x) => x.method === "PUT").at(-1);
    expect(put?.body).toMatchObject({ answer: "yes", rules: [{ type: "back_by" }] });
    expect(JSON.stringify(put?.body)).not.toContain("back by 5");
  });

  it("SRS-COND-2: a name not in the group gets the not-in-group line", async () => {
    const { flow } = await opened();
    flow.startCondition();
    flow.check("only if Kai comes");
    expect(flow.screen).toBe("condition");
    expect(flow.condError).toBe("Kai isn't in this group.");
  });

  it("SRS-ACC-3, BR-A-3: a spot that fails a need offers a closer one and sends only the flag", async () => {
    const { f, flow } = await opened({ quorum: 3 });
    await f.store.saveNeeds({ avoid_steps: true, rest_gap_m: 200, restroom_300m: true });
    await flow.loadNeeds();
    await flow.loadPack("fairlane");
    flow.yes();
    await flow.join("Amor");
    expect(flow.screen).toBe("not-suit");
    expect(flow.notSuit.map((r) => r.icon)).toEqual(["steps", "bench", "restroom"]);
    flow.closerOne();
    await settle();
    const put = f.outbox.sent.filter((x) => x.method === "PUT").at(-1);
    expect(put?.body).toMatchObject({
      answer: "yes",
      ember_only: true,
      checks: { results: { spot: false, c1: false } },
    });
    expect(JSON.stringify(put?.body)).not.toMatch(/avoid_steps|restroom/);
  });

  it("SRS-OFF-1, SRS-OFF-2: Lit is saved and opens with no signal, with the saved time", async () => {
    const { f, s, flow } = await opened({ quorum: 2 });
    flow.yes();
    await flow.join("Amor");
    await settle();
    expect(f.store.lits.has(s.id)).toBe(true);
    f.server.setOffline(true);
    const again = new LinkFlow(f.deps, s.id);
    await again.open(s.fragment);
    expect(again.screen).toBe("lit");
    expect(again.savedAt).toMatch(/\d:\d\d [AP]M/);
  });

  it("SRS-RES-4, BR-Q-5: the view the phone keeps has counts only, no member ids", async () => {
    const { flow, s } = await opened({ quorum: 3 });
    const text = JSON.stringify(flow.view);
    expect(text).not.toContain(s.hostId);
  });

  it("SRS-ST-3: Gone shows the same Not this time for everyone", async () => {
    const { f, s, flow } = await opened();
    f.server.setState(s.id, "gone", { ended: "not_this_time" });
    await settle();
    await settle();
    expect(flow.screen).toBe("gone");
  });

  it("BR-H-2, BR-K-1: I'm here counts the arrival and offers one Spark", async () => {
    const { f, flow } = await opened({ quorum: 2 });
    flow.yes();
    await flow.join("Amor");
    await settle();
    await flow.here();
    expect(flow.screen).toBe("here");
    flow.afterHere();
    expect(flow.screen).toBe("spark");
    await flow.saveSpark("Geese took our bench.");
    expect(flow.screen).toBe("spark-saved");
    const spark = f.outbox.sent.find((x) => x.path.endsWith("/sparks"));
    expect(JSON.stringify(spark?.body)).not.toContain("Geese");
  });

  it("SRS-PLAN-3: a Plan opens on the ladder; Short one only sends max_step 4 (smallest step only)", async () => {
    const { f, flow } = await opened({ kind: "plan", quorum: 3 });
    expect(flow.screen).toBe("plan-invite");
    expect(flow.steps.map((x) => x.minutes)).toEqual([60, 30, 15, 10]);
    flow.shortOnly();
    await flow.join("Amor");
    await settle();
    const put = f.outbox.sent.filter((x) => x.method === "PUT").at(-1);
    expect(put?.body).toMatchObject({ rules: [{ type: "max_step", step: 4 }] });
  });

  it("BR-P-7: I'm fading makes the Plan one step smaller, once", async () => {
    const { f, s, flow } = await opened({ kind: "plan", quorum: 2 });
    flow.yes();
    await flow.join("Amor");
    await settle();
    f.server.setState(s.id, "lit", {
      plan: { ...(flow.view?.plan as NonNullable<typeof flow.view>["plan"] & object), current_step: 1 },
    });
    await settle();
    await settle();
    expect(flow.screen).toBe("plan-lit");
    expect(await flow.fade()).toBe(true);
    expect(flow.view?.plan?.current_step).toBe(2);
    expect(await flow.fade()).toBe(false);
    expect(flow.error).toBe("You already made this one smaller.");
  });

  it("SRS-IF-1: a yes with no signal is kept and the queued line shows", async () => {
    const { f, flow } = await opened({ quorum: 3 });
    flow.yes();
    await flow.join("Amor");
    await settle();
    flow.screen = "invite";
    f.server.setOffline(true);
    flow.yes();
    await settle();
    expect(flow.queued).toBe(true);
    expect(await f.outbox.size()).toBe(1);
  });
});
