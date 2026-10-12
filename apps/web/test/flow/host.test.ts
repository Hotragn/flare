// Host flow (FE2, Plans P1 to P3) over the ICD fakes. Test names carry the rule ids.
import { afterEach, describe, expect, it, vi } from "vitest";
import { HostFlow } from "../../src/lib/screens/flow/host.svelte.ts";
import { LinkFlow } from "../../src/lib/screens/flow/link.svelte.ts";
import { fakeDeps } from "../fakes/index.ts";

const settle = () => new Promise((r) => setTimeout(r, 0));
const JPEG = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" });
const POND = { lat: 42.3196, lon: -83.2129 };

async function sent(quorum = "2") {
  const f = fakeDeps();
  const host = new HostFlow(f.deps);
  host.hostName = "Fuego";
  await host.loadPack("fairlane");
  await host.usePhoto(JPEG, true);
  host.setPosition(POND);
  host.useWords(host.words);
  host.quorum = quorum;
  const ok = await host.send();
  await settle();
  return { f, host, ok };
}

describe("host flow (FE2)", () => {
  it("BR-AI-1: the hub's six words are offered; with the hub out, the host types them", async () => {
    const f = fakeDeps();
    const host = new HostFlow(f.deps);
    await host.usePhoto(JPEG, true);
    expect(host.draft).toBe("drafted");
    expect(host.words).toBe("Golden pond, come sit with me");
    f.server.setHub(false);
    await host.usePhoto(JPEG, true);
    expect(host.draft).toBe("hub-unreachable");
  });

  it("SRS-CRE-3: the spot is named from the map pack, never typed when location is on", async () => {
    const f = fakeDeps();
    const host = new HostFlow(f.deps);
    await host.loadPack("fairlane");
    host.setPosition(POND);
    expect(host.spot?.name).toBe("Ford Woods Park, by the pond");
    expect(host.access?.steps_mapped).toBe(true);
    expect(host.nature).toBe("Sunset 6:57 PM");
  });

  it("SRS-CRE-7, ADR-0008: Send seals everything readable; the server gets ciphertext and counts", async () => {
    const { f, host, ok } = await sent();
    expect(ok).toBe(true);
    expect(host.screen).toBe("sent");
    const create = f.outbox.sent.find((x) => x.path.endsWith("/gatherings"));
    const text = JSON.stringify(create?.body);
    for (const readable of ["Fuego", "Ford Woods", "Golden pond", "42.31"]) expect(text).not.toContain(readable);
    expect(create?.body).toMatchObject({ kind: "flare", quorum: 2, tz: "America/Detroit" });
  });

  it("SRS-ID-2: the link carries the key only after #, and a friend can open it", async () => {
    const { f, host } = await sent();
    expect(host.link).toMatch(/^\/g\/[0-9a-f-]{36}\/#k=[A-Za-z0-9_-]{43}$/);
    const [path, frag] = host.link.split("#k=");
    const id = path?.split("/")[2] ?? "";
    const friend = new LinkFlow(f.deps, id);
    await friend.open(frag ?? null);
    expect(friend.info?.host).toBe("Fuego");
    expect(friend.info?.words).toBe("Golden pond, come sit with me");
  });

  it("SRS-CRE-6: the photo uploads sealed after the gathering", async () => {
    const { f } = await sent();
    await settle();
    const g = [...f.server.gatherings.values()][0];
    expect(g?.has_photo).toBe(true);
    expect([...(g?.photo ?? new Uint8Array()).slice(0, 4)]).not.toEqual([0xff, 0xd8, 0xff, 0xd9]); // sealed, not a JPEG
  });

  it("SRS-IF-6: the plain-text form fits 200 bytes and carries the reply code", async () => {
    const { host } = await sent("3");
    const text = host.plainText();
    expect(new TextEncoder().encode(text).length).toBeLessThanOrEqual(200);
    expect(text).toMatch(/^FLARE K7Q2M .*Need 2 more\. Reply IN K7Q2M/);
  });

  it("SRS-CH-5, BR-ID-6: a text yes counts on the host's phone", async () => {
    const { host } = await sent("3");
    host.pocket();
    expect(host.screen).toBe("kindling");
    await host.textYes("in k7q2m");
    expect(host.textYesUsed).toBe(1);
    expect(host.view?.need).toBe(1);
  });

  it("BR-F-5: Cancel ends it for everyone as Not this time", async () => {
    const { host } = await sent("3");
    await host.cancel();
    expect(host.screen).toBe("gone");
    expect(host.view?.ended).toBe("not_this_time");
  });

  it("BR-H-1, BR-F-5: at Lit the host adds +1 and Done ends with Thanks for coming", async () => {
    const { f, host } = await sent("2");
    const id = host.view?.id ?? "";
    f.server.answerAs(id, "friend-1");
    await settle();
    expect(host.screen).toBe("lit");
    await host.plusOne("someone_else");
    expect(host.view?.headcount).toBe(1);
    await host.done();
    expect(host.screen).toBe("outside");
  });

  it("BR-P-1 to BR-P-3: Plan times are checked before the ladder", async () => {
    const f = fakeDeps();
    const host = new HostFlow(f.deps);
    host.startPlan();
    expect(host.planError()).toBe("");
    const now = f.deps.now();
    host.startAt = now + 60 * 60_000;
    host.deadlineAt = host.startAt - 5 * 60_000;
    expect(host.planError()).toBe("Answers must close 10 min before it starts.");
    host.deadlineAt = now + 5 * 60_000;
    expect(host.planError()).toBe("Give friends at least 10 minutes to answer.");
    host.startAt = now + 40 * 3_600_000;
    expect(host.planError()).toBe("Plans must start within 36 hours.");
  });

  it("BR-P-4: the ladder must shrink step by step; a Plan sends 4 steps", async () => {
    const f = fakeDeps();
    const host = new HostFlow(f.deps);
    host.hostName = "Fuego";
    host.startPlan();
    host.ask = "Fairlane walk at 11?";
    await host.draftLadder(60);
    expect(host.steps.map((s) => s.minutes)).toEqual([60, 30, 15, 10]);
    expect(host.ladderError()).toBe("");
    host.steps = host.steps.map((s, i) => (i === 2 ? { ...s, minutes: 40 } : s));
    expect(host.ladderError()).toBe("Each step must be shorter than the one above.");
    host.steps = host.steps.map((s, i) => (i === 2 ? { ...s, minutes: 15 } : s));
    expect(await host.send("plan")).toBe(true);
    const create = f.outbox.sent.find((x) => x.path.endsWith("/gatherings"));
    expect(
      (create ? (create.body as { plan: { steps: unknown[] } }) : { plan: { steps: [] } }).plan.steps,
    ).toHaveLength(4);
  });
});

describe("place pre-fill (fresh-eyes round 4)", () => {
  it("a position that arrives before the map pack still gets its place name", async () => {
    const f = fakeDeps();
    const host = new HostFlow(f.deps);
    host.setPosition({ lat: 42.3196, lon: -83.2129 }); // no pack yet: no name
    expect(host.spot?.name ?? "").toBe("");
    await host.loadPack("fairlane");
    expect(host.spot?.name).toBe("Ford Woods Park, by the pond");
    expect(host.askLocation).toBe(false);
  });
  it("a typed place is kept when the pack arrives", async () => {
    const f = fakeDeps();
    const host = new HostFlow(f.deps);
    host.typeSpot("the big oak");
    await host.loadPack("fairlane");
    expect(host.spot?.name).toBe("the big oak");
  });
});

describe("share (SRS-CRE-8): the sheet first, Copy link when there is none", () => {
  const stub = (share?: (d: ShareData) => Promise<void>) => {
    const copied: string[] = [];
    vi.stubGlobal("navigator", { share, clipboard: { writeText: async (s: string) => void copied.push(s) } });
    return copied;
  };
  afterEach(() => vi.unstubAllGlobals());

  it("calls navigator.share in the same tick as the tap, before any await", async () => {
    const calls: ShareData[] = [];
    stub(async (d) => void calls.push(d));
    const { host } = await sent();
    void host.share();
    expect(calls).toHaveLength(1); // synchronous: iOS keeps the tap's activation
    expect(calls[0]?.url).toBe(host.link);
    expect(host.linkOnly).toBe(false);
  });

  it("AbortError (the host closed the sheet) changes nothing", async () => {
    stub(() => Promise.reject(new DOMException("closed", "AbortError")));
    const { host } = await sent();
    await host.share();
    expect(host.linkOnly).toBe(false);
    expect(host.note).toBe("");
  });

  it("a failed sheet turns Share into Copy link; the next tap copies and shows a toast", async () => {
    const copied = stub(() => Promise.reject(new DOMException("no tap", "NotAllowedError")));
    const { host } = await sent();
    await host.share();
    expect(host.linkOnly).toBe(true);
    expect(host.note).toBe("Share did not open. Tap Copy link."); // never swallowed
    await host.shareLit();
    expect(copied[0]).toContain(host.link);
    expect(host.note).toBe("Link copied. Paste it in your chat.");
  });

  it("no navigator.share: Copy link from the start, and a blocked clipboard shows the link", async () => {
    const copied = stub(undefined);
    const { host } = await sent();
    expect(host.linkOnly).toBe(true);
    await host.share();
    expect(copied).toHaveLength(1);
    expect(host.note).toBe("Link copied. Paste it in your chat.");
    vi.stubGlobal("navigator", {});
    await host.share();
    expect(host.note).toBe(`Could not copy. Here is the link: ${host.link}`);
  });
});
