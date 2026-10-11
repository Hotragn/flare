// Tier selection, typed fallback, ladder and Plan logic (SRS-AI-1, SRS-AI-4, BR-AI-1, OD4, FE5).
import { describe, expect, it } from "vitest";
import { checkLadder, draftLadder, editStep, MIN_TOTAL, templateLadder } from "../../src/lib/ai/ladder.ts";
import { checkPlanTimes, endsAfterSunset, planAnswer, stepsAllowed } from "../../src/lib/ai/plan.ts";
import { createTierStore, draftPhoto, PHONE_TIMEOUT_MS, recordConditionsRun } from "../../src/lib/ai/tier.ts";
import { checkTyped, templateFor, typedChips } from "../../src/lib/ai/typed.ts";
import { fakeServer, memoryKV } from "../fakes/server.ts";

const jpeg = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" });
const deps = (mode: Parameters<typeof fakeServer>[0], extra: Record<string, unknown> = {}) => {
  const s = fakeServer(mode, extra as { delayMs?: number });
  const kv = memoryKV();
  return { s, kv, d: { fetch: s.fetch, online: () => true, store: createTierStore(kv), ...extra } };
};

describe("SRS-AI-1 photo draft tiers", () => {
  it("hub answers: six words, 'Made on our laptop'", async () => {
    const { d, s } = deps("hub");
    const r = await draftPhoto(jpeg, d);
    expect(r.tier).toBe("hub");
    expect(r.label).toBe("Made on our laptop");
    expect(r.invite).toBe("Golden hour by the pond");
    expect(s.seen).toHaveLength(1);
    expect(s.seen[0]?.url).toBe("/api/v1/drafts");
    expect(s.seen[0]?.contentType).toBe("image/jpeg");
  });

  it("BR-AI-1: server says rules (hub absent or past 6 s): typed fallback, 'Made from a template'", async () => {
    const { d } = deps("rules");
    const r = await draftPhoto(jpeg, d);
    expect(r.tier).toBe("rules");
    expect(r.label).toBe("Made from a template");
    if (r.tier === "rules") {
      expect(r.why).toBe("hub_down");
      expect(r.message).toBe("Tap a place word, or write your own six.");
    }
  });

  it("BR-AI-1: no answer within the phone timeout falls back, near the timeout", async () => {
    const { d } = deps("slow", { timeoutMs: 150 });
    const t0 = performance.now();
    const r = await draftPhoto(jpeg, d);
    const took = performance.now() - t0;
    expect(r.tier).toBe("rules");
    if (r.tier === "rules") expect(r.why).toBe("timeout");
    expect(took).toBeLessThan(1000);
    expect(PHONE_TIMEOUT_MS.photo).toBeGreaterThan(6000); // server budget is 6 s; phone waits a little longer
  });

  it("spike E1: a relay drop (network error) falls back at once", async () => {
    const { d } = deps("drop");
    const r = await draftPhoto(jpeg, d);
    expect(r.tier === "rules" && r.why).toBe("network");
    if (r.tier === "rules") expect(r.message).toBe("No signal, so no draft.");
  });

  it("offline: no request at all, typed fallback", async () => {
    const { d, s } = deps("hub");
    const r = await draftPhoto(jpeg, { ...d, online: () => false });
    expect(r.tier === "rules" && r.why).toBe("offline");
    expect(s.seen).toHaveLength(0);
  });

  it("SRS-AI-2: a hub answer describing a person never shows", async () => {
    const { d } = deps("bad-draft");
    const r = await draftPhoto(jpeg, d);
    expect(r.tier === "rules" && r.why).toBe("unusable");
  });

  it("server errors and garbage fall back", async () => {
    expect((await draftPhoto(jpeg, deps("500").d)).tier).toBe("rules");
    expect((await draftPhoto(jpeg, deps("garbage").d)).tier).toBe("rules");
  });

  it("SRS-AI-4: the last tier per feature is kept, with no content", async () => {
    const { d, kv } = deps("hub");
    await draftPhoto(jpeg, d);
    recordConditionsRun(d.store, 0.2);
    const saved = JSON.stringify(kv.dump());
    expect(saved).not.toContain("Golden");
    expect(saved).not.toContain("pond");
    const again = createTierStore(kv); // survives a reload
    expect(again.all().photo?.tier).toBe("hub");
    expect(again.all().conditions?.tier).toBe("rules");
    expect(createTierStore(null).last()).toBeNull();
  });
});

describe("OD4 typed fallback", () => {
  it("keeps six words, strips emoji and hashtags", () => {
    expect(checkTyped("  pond  bench #now 🔥 ")).toEqual({ ok: true, invite: "pond bench now", words: 3 });
    expect(checkTyped("one two three four five six seven")).toMatchObject({
      ok: false,
      error: "Keep it to six words.",
    });
    expect(checkTyped("🔥")).toMatchObject({ ok: false, error: "Write up to six words." });
  });

  it("FR-AI-1 template and map-pack chips fit six words", () => {
    expect(templateFor("the pond")).toBe("Outside at the pond. Come?");
    expect(templateFor("Ford Woods Park, by the pond")).toBe("Outside right now. Come?");
    const chips = typedChips("Ford Woods", ["Fairlane Green", null, "Ford Woods", "Very Long Place Name Here"]);
    expect(chips).toEqual(["Outside at Ford Woods. Come?", "Outside at Fairlane Green. Come?"]);
    for (const c of chips) expect(checkTyped(c).ok).toBe(true);
  });
});

describe("SRS-PLAN-2 ladder", () => {
  it("template: 60 -> 60, 30, 15, 10 and valid for every total 40 to 600", () => {
    expect(templateLadder(60).map((s) => s.minutes)).toEqual([60, 30, 15, 10]);
    expect(templateLadder(MIN_TOTAL).map((s) => s.minutes)).toEqual([40, 20, 10, 5]);
    for (let total = 40; total <= 600; total++) expect(checkLadder(templateLadder(total)).ok, String(total)).toBe(true);
  });

  it("hub ladder when the hub answers; template when it doesn't", async () => {
    const hub = await draftLadder({ ask: "Fairlane walk at 11?", total_minutes: 60 }, deps("hub").d);
    expect(hub.tier).toBe("hub");
    expect(hub.steps[0]?.label).toBe("Fairlane loop");
    expect(hub.note).toBe("Made on our laptop from OpenStreetMap and today's sunset.");
    const off = await draftLadder(
      { ask: "Fairlane walk at 11?", total_minutes: 60 },
      { ...deps("hub").d, online: () => false },
    );
    expect(off.tier).toBe("rules");
    expect(off.note).toBe("Offline. The steps come from a template.");
    const down = await draftLadder({ ask: "Fairlane walk", total_minutes: 60 }, deps("rules").d);
    expect(down.note).toBe("Made from a template. Edit any step.");
  });

  it("the ask line is clipped to 80 characters and carries nothing else", async () => {
    const { d, s } = deps("hub");
    await draftLadder({ ask: "x".repeat(120), total_minutes: 61 }, d);
    const body = JSON.parse(String(s.seen[0]?.body));
    expect(body.ask).toHaveLength(80);
    expect(Object.keys(body).sort()).toEqual(["ask", "total_minutes"]);
  });

  it("BR-P-4: edits keep steps strictly decreasing, ≥ 5 min, labels ≤ 4 words", () => {
    const l = templateLadder(60);
    expect(editStep(l, 2, { minutes: 70 })).toMatchObject({ ok: false, error: "order" });
    expect(editStep(l, 4, { minutes: 3 })).toMatchObject({ ok: false, error: "minutes" });
    expect(editStep(l, 1, { minutes: 700 })).toMatchObject({ ok: false, error: "total" });
    expect(editStep(l, 3, { label: "a very long step name here" })).toMatchObject({ ok: false, error: "name" });
    expect(editStep(l, 3, { label: "Smiling woman spot" })).toMatchObject({ ok: false, error: "name" });
    const ok = editStep(l, 3, { label: "  Pond   bench " });
    expect(ok.ok && ok.steps[2]?.label).toBe("Pond bench");
  });
});

describe("FE5 Plan logic", () => {
  const created = "2026-10-11T14:00:00.000Z";
  it("BR-P-1 times", () => {
    expect(checkPlanTimes(created, "2026-10-11T16:00:00.000Z", "2026-10-11T15:00:00.000Z").ok).toBe(true);
    expect(checkPlanTimes(created, "2026-10-11T16:00:00.000Z", "2026-10-11T14:05:00.000Z")).toMatchObject({
      error: "tooSoon",
    });
    expect(checkPlanTimes(created, "2026-10-11T16:00:00.000Z", "2026-10-11T15:55:00.000Z")).toMatchObject({
      error: "tooClose",
    });
    expect(checkPlanTimes(created, "2026-10-13T03:00:00.000Z", "2026-10-11T15:00:00.000Z")).toMatchObject({
      error: "tooFar",
    });
  });

  it("BR-P-9 sunset flag per step, off when the host turns it off", () => {
    const l = templateLadder(60);
    const f = endsAfterSunset("2026-10-11T22:30:00.000Z", l, "2026-10-11T23:00:00.000Z");
    expect(f.map((x) => x.afterSunset)).toEqual([true, false, false, false]);
    expect(
      endsAfterSunset("2026-10-11T22:30:00.000Z", l, "2026-10-11T23:00:00.000Z", false).some((x) => x.afterSunset),
    ).toBe(false);
  });

  it("SRS-PLAN-10: the answer names steps from this ladder", () => {
    const ctx = { members: [{ id: "a", name: "Amor" }], tz: "America/Detroit", now: created };
    const r = planAnswer("at least a shorter loop, back by 5", ctx, templateLadder(60));
    expect(r).toMatchObject({ ok: true, readBack: "Got it: step 2 or bigger, back by 5 PM. Right?" });
    if (r.ok) expect(stepsAllowed(r.rules)).toEqual([1, 2]);
    expect(planAnswer("maybe", ctx, templateLadder(60))).toMatchObject({ ok: false });
    expect(stepsAllowed([{ type: "max_step", step: 3 }])).toEqual([3, 4]);
  });
});
