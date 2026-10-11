// Flare machine rows F1 to F14 (docs/architecture/04-state-machines.md section 1).
import { describe, expect, it } from "vitest";
import { createFlare, engine } from "../src/index.ts";
import { answer, at, atMs, effects, expectError, flare, HOST, m, run, step, T0, yes } from "./helpers.ts";

describe("F1 create", () => {
  it("F1: Kindling, version 1, job ember at t0+30:00, expiry t0+5 h", () => {
    const r = createFlare(
      { id: "g", group_id: "x", host: HOST, group_size: 5, quorum: 3, ember_candidates: ["c1", "c2"] },
      T0,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.gathering.state).toBe("kindling");
    expect(r.gathering.created_at).toBe(T0);
    expect(r.gathering.ember_candidates).toEqual(["c1", "c2"]);
    expect(r.effects).toEqual([
      { type: "schedule", job: "ember", at: at(30) },
      { type: "counter", name: "flares_created" },
    ]);
    expect(r.expires_at).toBe(at(300));
  });
  it("F1 BR-Q-2: quorum must be 2, 3 or 4", () => {
    for (const quorum of [1, 5, 2.5]) {
      const r = createFlare({ id: "g", group_id: "x", host: HOST, group_size: 5, quorum, ember_candidates: [] }, T0);
      expect(r).toEqual({ ok: false, error: "quorum_range" });
    }
  });
  it("F1 BR-S-4: groups larger than 12 are rejected", () => {
    const r = createFlare({ id: "g", group_id: "x", host: HOST, group_size: 13, quorum: 2, ember_candidates: [] }, T0);
    expect(r).toEqual({ ok: false, error: "group_full" });
  });
  it("F1: candidate labels must be c1..c12 and unique", () => {
    for (const ember_candidates of [["spot"], ["c1", "c1"], ["c13"]]) {
      const r = createFlare(
        // biome-ignore lint/suspicious/noExplicitAny: testing bad input from outside the type system
        { id: "g", group_id: "x", host: HOST, group_size: 5, quorum: 2, ember_candidates: ember_candidates as any },
        T0,
      );
      expect(r).toEqual({ ok: false, error: "bad_request" });
    }
  });
});

describe("F2 Kindling to Lit", () => {
  it("F2 BR-Q-1 BR-Q-3: host plus one yes lights a quorum-2 Flare", () => {
    const w = run(flare(), [[yes(1), at(5)]]);
    expect(w.g.state).toBe("lit");
    expect(w.g.lit_at).toBe(at(5));
    expect(w.g.state_since).toBe(at(5));
    expect(w.g.chosen_set).toEqual([HOST, m(1)]);
    expect(w.g.headcount).toBe(1);
    expect(w.g.version).toBe(2);
    expect(effects(w.last)).toEqual([
      { type: "unschedule", job: "ember" },
      { type: "counter", name: "flares_lit" },
      { type: "schedule", job: "gone", at: at(240) },
      { type: "push", event: "lit", to: "set", label: "spot" },
      { type: "telegram", action: "lit" },
      { type: "sse" },
    ]);
  });
  it("F2 BR-ID-6: anonymous text yeses count toward quorum", () => {
    const w = run(flare({ quorum: 3 }), [
      [{ type: "text_yes" }, at(1)],
      [{ type: "text_yes" }, at(2)],
    ]);
    expect(w.g.state).toBe("lit");
    expect(w.g.chosen_set).toEqual([HOST]);
    expect(w.g.text_yes).toBe(2);
  });
  it("F2 BR-C-7: a checks event that clears a failing check lights it", () => {
    const g = flare();
    const w = run(g, [[yes(1), at(1)]], [answer(1, [], { status: "taken_back", checks: { spot: false } })]);
    expect(w.g.state).toBe("kindling");
    const r = step(w, { type: "checks", member_id: m(1), results: { spot: true } }, at(2));
    expect(r.g.state).toBe("lit");
    expect(r.answers[0]?.checks_at).toBe(at(2));
  });
  it("F2 race BR-F-2: an answer at t0+30:00.000 lights even if the ember timer is queued", () => {
    const w = run(flare(), [[yes(1), atMs(30 * 60_000)]]);
    expect(w.g.state).toBe("lit");
    const after = step(w, { type: "timer", job: "ember" }, atMs(30 * 60_000 + 5));
    expect(after.g.state).toBe("lit");
    expect(effects(after.last)).toEqual([]);
    expect(after.g.version).toBe(w.g.version);
  });
  it("F2 race BR-F-2: an answer at t0+30:00.001 belongs to Ember and does not light in Kindling", () => {
    const w = run(flare(), [[yes(1), atMs(30 * 60_000 + 1)]]);
    expect(w.g.state).toBe("kindling");
    expect(w.answers).toHaveLength(1);
    const e = step(w, { type: "timer", job: "ember" }, atMs(30 * 60_000 + 2));
    expect(e.g.state).toBe("lit"); // Ember with no candidates picks spot and lights at once (F4 then F6)
    expect(effects(e.last)).toContainEqual({ type: "counter", name: "embers_lit" });
  });
});

describe("F3 Kindling stays Kindling", () => {
  it("F3: below quorum publishes the count", () => {
    const w = run(flare({ quorum: 3 }), [[yes(1), at(1)]]);
    expect(w.g.state).toBe("kindling");
    expect(engine.view(w.g, w.answers, at(1)).need).toBe(1);
    expect(effects(w.last)).toEqual([{ type: "telegram", action: "edit_count" }, { type: "sse" }]);
  });
  it("F3: take-back shrinks the set", () => {
    const w = run(flare({ quorum: 3 }), [
      [yes(1), at(1)],
      [{ type: "take_back", member_id: m(1) }, at(2)],
    ]);
    expect(w.answers[0]?.status).toBe("taken_back");
    expect(engine.view(w.g, w.answers, at(2)).need).toBe(2);
  });
  it("F3: take-back of an answer already taken back changes nothing", () => {
    const w = run(flare({ quorum: 3 }), [
      [yes(1), at(1)],
      [{ type: "take_back", member_id: m(1) }, at(2)],
    ]);
    const r = step(w, { type: "take_back", member_id: m(1) }, at(3));
    expect(r.g.version).toBe(w.g.version);
    expect(effects(r.last)).toEqual([]);
  });
  it("F3: take-back from someone who never answered is unknown_member", () => {
    expectError(engine.transition(flare(), [], { type: "take_back", member_id: m(4) }, at(1)), "unknown_member");
  });
  it("F3: a rule change replaces rules (yes again with a new rule)", () => {
    const w = run(flare({ quorum: 3 }), [
      [yes(1, [{ type: "with", member_id: m(2) }]), at(1)],
      [yes(1), at(2)],
      [yes(2), at(3)],
    ]);
    expect(w.g.state).toBe("lit");
    expect(w.answers.find((a) => a.member_id === m(1))?.rules).toEqual([]);
  });
  it("F3: a can't-make-it answer before Lit is not a yes", () => {
    const w = run(flare(), [
      [{ type: "answer", member_id: m(1), answer: "cant_make_it", rules: [], ember_only: false }, at(1)],
    ]);
    expect(w.g.state).toBe("kindling");
  });
  it("F3: the host cannot answer; the host is always in", () => {
    expectError(engine.transition(flare(), [], yes(0), at(1)), "wrong_state");
  });
  it("F3 BR-Q-6: an Ember-only yes is not counted in Kindling", () => {
    const w = run(flare(), [[yes(1, [], true), at(1)]]);
    expect(w.g.state).toBe("kindling");
    expect(engine.view(w.g, w.answers, at(1)).need).toBe(1);
  });
  it("F3: a member who leaves is removed; their with-dependents drop", () => {
    const w = run(flare({ quorum: 4 }), [
      [yes(1), at(1)],
      [yes(2, [{ type: "with", member_id: m(1) }]), at(1)],
      [{ type: "member_left", member_id: m(1) }, at(2)],
    ]);
    expect(w.answers.map((a) => a.member_id)).toEqual([m(2)]);
    expect(engine.solve(w.g, w.answers, at(2)).set).toEqual([HOST]);
  });
  it("F3: a member who leaves without answering just refreshes the count", () => {
    const w = run(flare({ quorum: 4 }), [[{ type: "member_left", member_id: m(9) }, at(2)]]);
    expect(w.g.version).toBe(1);
    expect(effects(w.last)).toEqual([{ type: "telegram", action: "edit_count" }, { type: "sse" }]);
  });
});

describe("F4 Kindling to Ember", () => {
  it("F4: timer ember at t0+30:00 enters Ember with quorum 2, pick job, gone job", () => {
    const w = run(flare({ quorum: 4, candidates: ["c1", "c2"] }), [[{ type: "timer", job: "ember" }, at(30)]]);
    expect(w.g.state).toBe("ember");
    expect(w.g.quorum).toBe(2);
    expect(w.g.ember_choice).toBeNull();
    expect(effects(w.last)).toEqual([
      { type: "counter", name: "embers" },
      { type: "schedule", job: "gone", at: at(60) },
      { type: "schedule", job: "ember_pick", at: atMs(30 * 60_000 + 60_000) },
      { type: "sse" },
    ]);
  });
  it("F4 BR-E-2: no candidates means the spot, announced at once", () => {
    const w = run(flare({ quorum: 4 }), [[{ type: "timer", job: "ember" }, at(30)]]);
    expect(w.g.ember_choice).toBe("spot");
    expect(effects(w.last)).toContainEqual({ type: "push", event: "ember", to: "all", label: "spot" });
    expect(effects(w.last)).toContainEqual({ type: "telegram", action: "ember" });
  });
  it("F4: an early ember timer (before t0+30:00) does nothing", () => {
    const w = run(flare(), [[{ type: "timer", job: "ember" }, atMs(30 * 60_000 - 1)]]);
    expect(w.g.state).toBe("kindling");
    expect(w.g.version).toBe(1);
  });
});

describe("F5 Ember pick (BR-E-1 to BR-E-4)", () => {
  it("F5: picks the first candidate every yes passed once all have reported", () => {
    const g = flare({ quorum: 4, candidates: ["c1", "c2", "c3"] });
    const w = run(g, [
      [yes(1), at(1)],
      [{ type: "timer", job: "ember" }, at(30)],
      [{ type: "checks", member_id: m(1), results: { c1: false, c2: true, c3: true } }, at(30.2)],
      [{ type: "checks", member_id: HOST, results: { c1: true, c2: true, c3: false } }, at(30.3)],
    ]);
    // all in: lights at c2 straight away (host + m1 = 2)
    expect(w.g.ember_choice).toBe("c2");
    expect(w.g.state).toBe("lit");
    expect(effects(w.last)).toContainEqual({ type: "unschedule", job: "ember_pick" });
    expect(effects(w.last)).toContainEqual({ type: "push", event: "lit", to: "set", label: "c2" });
  });
  it("F5 BR-E-4: at the pick timer, missing checks count as pass", () => {
    const g = flare({ quorum: 4, candidates: ["c1", "c2"] });
    const w = run(g, [
      [{ type: "timer", job: "ember" }, at(30)],
      [{ type: "checks", member_id: HOST, results: { c1: false } }, at(30.2)],
      [{ type: "timer", job: "ember_pick" }, at(31)],
    ]);
    expect(w.g.ember_choice).toBe("c2");
    expect(w.g.state).toBe("ember");
    expect(effects(w.last)).toContainEqual({ type: "push", event: "ember", to: "all", label: "c2" });
  });
  it("F5 BR-E-2: no candidate passes for all means the spot", () => {
    const g = flare({ quorum: 4, candidates: ["c1", "c2"] });
    const w = run(g, [
      [{ type: "timer", job: "ember" }, at(30)],
      [{ type: "checks", member_id: HOST, results: { c1: false, c2: false } }, at(30.2)],
    ]);
    expect(w.g.ember_choice).toBe("spot");
  });
  it("F5: a second pick timer after the choice changes nothing", () => {
    const g = flare({ quorum: 4 });
    const w = run(g, [[{ type: "timer", job: "ember" }, at(30)]]);
    const r = step(w, { type: "timer", job: "ember_pick" }, at(31));
    expect(r.g.version).toBe(w.g.version);
  });
  it("F5: before the pick, Ember waits for a place and does not light", () => {
    const g = flare({ quorum: 4, candidates: ["c1"] });
    const w = run(g, [
      [{ type: "timer", job: "ember" }, at(30)],
      [yes(1), at(30.2)],
    ]);
    expect(w.g.state).toBe("ember");
    const p = step(w, { type: "timer", job: "ember_pick" }, at(31));
    expect(p.g.state).toBe("lit");
    expect(p.g.ember_choice).toBe("c1");
  });
});

describe("F6 Ember to Lit", () => {
  it("F6 BR-Q-6 BR-E-6: an Ember-only yes counts at Ember and lighting counts embers_lit", () => {
    const g = flare({ quorum: 3 });
    const w = run(g, [
      [yes(1, [], true), at(5)],
      [{ type: "timer", job: "ember" }, at(30)],
    ]);
    expect(w.g.state).toBe("lit");
    expect(w.g.chosen_set).toEqual([HOST, m(1)]);
    expect(effects(w.last)).toContainEqual({ type: "counter", name: "embers_lit" });
    expect(effects(w.last)).toContainEqual({ type: "schedule", job: "gone", at: at(240) });
  });
  it("F6: a yes during Ember lights with quorum 2", () => {
    const w = run(flare({ quorum: 4 }), [
      [{ type: "timer", job: "ember" }, at(30)],
      [yes(3), at(40)],
    ]);
    expect(w.g.state).toBe("lit");
    expect(w.g.lit_at).toBe(at(40));
  });
});

describe("F7 Ember to Gone", () => {
  it("F7 BR-F-4: timer gone at t0+60:00 ends with not_this_time", () => {
    const w = run(flare({ quorum: 4 }), [
      [{ type: "timer", job: "ember" }, at(30)],
      [{ type: "timer", job: "gone" }, at(60)],
    ]);
    expect(w.g.state).toBe("gone");
    expect(w.g.ended).toBe("not_this_time");
    expect(effects(w.last)).toEqual([
      { type: "schedule", job: "delete", at: atMs(61 * 60_000) },
      { type: "push", event: "gone", to: "all" },
      { type: "telegram", action: "final" },
      { type: "sse" },
    ]);
  });
  it("F7: a gone timer in Ember before t0+60:00 does nothing", () => {
    const w = run(flare({ quorum: 4 }), [[{ type: "timer", job: "ember" }, at(30)]]);
    expect(step(w, { type: "timer", job: "gone" }, at(59)).g.state).toBe("ember");
  });
  it("F7: a gone timer in Kindling does nothing", () => {
    expect(run(flare(), [[{ type: "timer", job: "gone" }, at(61)]]).g.state).toBe("kindling");
  });
});

describe("F8 cancel", () => {
  it("F8 BR-F-6: the host cancels in Kindling", () => {
    const w = run(flare({ quorum: 3 }), [[{ type: "cancel", by: HOST }, at(3)]]);
    expect(w.g.state).toBe("gone");
    expect(w.g.ended).toBe("not_this_time");
    expect(effects(w.last)[0]).toEqual({ type: "unschedule", job: "ember" });
  });
  it("F8: the host cancels in Ember before the pick (both jobs cancelled)", () => {
    const w = run(flare({ quorum: 3, candidates: ["c1"] }), [
      [{ type: "timer", job: "ember" }, at(30)],
      [{ type: "cancel", by: HOST }, at(31)],
    ]);
    expect(w.g.state).toBe("gone");
    expect(effects(w.last).slice(0, 2)).toEqual([
      { type: "unschedule", job: "ember_pick" },
      { type: "unschedule", job: "gone" },
    ]);
  });
  it("F8: the host cancels in Ember after the pick", () => {
    const w = run(flare({ quorum: 3 }), [
      [{ type: "timer", job: "ember" }, at(30)],
      [{ type: "cancel", by: HOST }, at(31)],
    ]);
    expect(effects(w.last)[0]).toEqual({ type: "unschedule", job: "gone" });
  });
  it("F8: only the host may cancel", () => {
    expectError(engine.transition(flare(), [], { type: "cancel", by: m(1) }, at(3)), "not_host");
  });
  it("F8: cancel is refused once Lit", () => {
    const w = run(flare(), [[yes(1), at(1)]]);
    expectError(engine.transition(w.g, w.answers, { type: "cancel", by: HOST }, at(2)), "wrong_state");
  });
  it("F8: the host leaving the group before Lit ends it", () => {
    const w = run(flare(), [[{ type: "member_left", member_id: HOST }, at(2)]]);
    expect(w.g.state).toBe("gone");
    expect(w.g.ended).toBe("not_this_time");
  });
});

describe("F9 Lit to Gone", () => {
  it("F9: host Done ends with thanks_for_coming and counters", () => {
    const w = run(flare(), [
      [yes(1), at(1)],
      [{ type: "arrival", by: m(1), who: { for: "self" }, recorded_at: at(10) }, at(10)],
      [{ type: "done", by: HOST }, at(91)],
    ]);
    expect(w.g.state).toBe("gone");
    expect(w.g.ended).toBe("thanks_for_coming");
    expect(w.g.done_at).toBe(at(91));
    expect(effects(w.last)).toEqual([
      { type: "unschedule", job: "gone" },
      { type: "counter", name: "headcount_sum", bucket: "2" },
      { type: "counter", name: "headcount_max", bucket: "2" },
      { type: "counter", name: "lit_minutes_sum", bucket: "90" },
      { type: "schedule", job: "delete", at: at(92) },
      { type: "push", event: "gone", to: "all" },
      { type: "telegram", action: "final" },
      { type: "sse" },
    ]);
  });
  it("F9 BR-F-5: timer gone at t0+4 h ends it", () => {
    const w = run(flare(), [
      [yes(1), at(1)],
      [{ type: "timer", job: "gone" }, at(240)],
    ]);
    expect(w.g.ended).toBe("thanks_for_coming");
    expect(effects(w.last)).not.toContainEqual({ type: "unschedule", job: "gone" });
  });
  it("F9: an early gone timer does nothing", () => {
    const w = run(flare(), [[yes(1), at(1)]]);
    expect(step(w, { type: "timer", job: "gone" }, at(239)).g.state).toBe("lit");
  });
  it("F9: only the host taps Done", () => {
    const w = run(flare(), [[yes(1), at(1)]]);
    expectError(engine.transition(w.g, w.answers, { type: "done", by: m(1) }, at(2)), "not_host");
  });
  it("F9: Done before Lit is wrong_state", () => {
    expectError(engine.transition(flare(), [], { type: "done", by: HOST }, at(2)), "wrong_state");
  });
});

describe("F10 to F12 Lit answers", () => {
  it("F10 BR-F-7: a new yes after Lit stays out of the set and raises the yes-count", () => {
    const w = run(flare(), [
      [yes(1), at(1)],
      [yes(2), at(2)],
    ]);
    expect(w.g.chosen_set).toEqual([HOST, m(1)]);
    expect(w.answers).toHaveLength(2);
    expect(effects(w.last)).toEqual([{ type: "sse" }]);
  });
  it("F11 SRS-RES-6: can't make it after Lit records the answer, state unchanged", () => {
    const w = run(flare(), [
      [yes(1), at(1)],
      [{ type: "answer", member_id: m(1), answer: "cant_make_it", rules: [], ember_only: false }, at(2)],
    ]);
    expect(w.g.state).toBe("lit");
    expect(w.answers[0]?.status).toBe("cant_make_it");
    expect(w.g.chosen_set).toEqual([HOST, m(1)]);
  });
  it("F12: take-back after Lit is refused with already_lit", () => {
    const w = run(flare(), [[yes(1), at(1)]]);
    expectError(engine.transition(w.g, w.answers, { type: "take_back", member_id: m(1) }, at(2)), "already_lit");
  });
  it("F10: text yes after Lit raises the yes-count only", () => {
    const w = run(flare(), [
      [yes(1), at(1)],
      [{ type: "text_yes" }, at(2)],
    ]);
    expect(w.g.text_yes).toBe(1);
    expect(effects(w.last)).toEqual([{ type: "sse" }]);
  });
  it("F10: checks after Lit are stored, nothing announced", () => {
    const w = run(flare(), [
      [yes(1), at(1)],
      [{ type: "checks", member_id: m(1), results: { spot: true } }, at(2)],
    ]);
    expect(w.answers[0]?.checks_at).toBe(at(2));
    expect(effects(w.last)).toEqual([]);
  });
  it("F10: a member leaving after Lit is removed from the set", () => {
    const w = run(flare(), [
      [yes(1), at(1)],
      [{ type: "member_left", member_id: m(1) }, at(2)],
    ]);
    expect(w.g.chosen_set).toEqual([HOST]);
    expect(effects(w.last)).toEqual([{ type: "sse" }]);
  });
  it("F10: the host leaving after Lit leaves it Lit", () => {
    const w = run(flare(), [
      [yes(1), at(1)],
      [{ type: "member_left", member_id: HOST }, at(2)],
    ]);
    expect(w.g.state).toBe("lit");
  });
  it("BR-ID-6: a fourth text yes is refused", () => {
    const w = run(flare({ quorum: 4 }), [
      [{ type: "text_yes" }, at(1)],
      [{ type: "text_yes" }, at(1)],
      [{ type: "text_yes" }, at(1)],
    ]);
    expectError(engine.transition(w.g, w.answers, { type: "text_yes" }, at(2)), "text_yes_cap");
  });
});

describe("F13 F14 Gone", () => {
  const gone = () => run(flare(), [[{ type: "cancel", by: HOST }, at(1)]]);
  it("F13: every non-timer event is refused with wrong_state (the API says 410 gone)", () => {
    const w = gone();
    for (const e of [
      yes(1),
      { type: "take_back", member_id: m(1) } as const,
      { type: "text_yes" } as const,
      { type: "done", by: HOST } as const,
      { type: "cancel", by: HOST } as const,
      { type: "fade", member_id: HOST } as const,
    ]) {
      expectError(engine.transition(w.g, w.answers, e, at(2)), "wrong_state");
    }
  });
  it("F14: the delete timer and stale timers change nothing and emit nothing", () => {
    const w = gone();
    for (const job of ["delete", "gone", "ember", "ember_pick", "plan_deadline"] as const) {
      const r = step(w, { type: "timer", job }, at(2));
      expect(r.g).toEqual(w.g);
      expect(effects(r.last)).toEqual([]);
    }
  });
  it("F14: the delete timer before Gone does nothing", () => {
    expect(run(flare(), [[{ type: "timer", job: "delete" }, at(2)]]).g.version).toBe(1);
  });
});

describe("purity", () => {
  it("BR-S-5: transition never mutates its inputs", () => {
    const g = flare();
    const answers = [
      {
        member_id: m(1),
        status: "yes" as const,
        ember_only: false,
        rules: [],
        checks: {},
        checks_at: null,
        faded: false,
        still_coming: false,
        arrived_at: null,
      },
    ];
    const gCopy = structuredClone(g);
    const aCopy = structuredClone(answers);
    engine.transition(g, answers, yes(2), at(1));
    expect(g).toEqual(gCopy);
    expect(answers).toEqual(aCopy);
  });
  it("rejects a now that is not ISO 8601", () => {
    expect(() => engine.transition(flare(), [], yes(1), "yesterday")).toThrow(RangeError);
    expect(() => engine.transition(flare(), [], yes(1), "2026-13-45T99:00:00.000Z")).toThrow(RangeError);
  });
});
