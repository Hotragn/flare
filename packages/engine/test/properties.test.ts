// Property tests (fast-check 4.10.2). Each invariant INV-n is stated in docs/engine/01-algorithm.md.
import type { Answer, EngineEvent, Gathering, Id, Rule, Step } from "@flare/shared/icd/engine";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { engine, yesCount } from "../src/index.ts";
import { allRulesHold, type Candidate, compareCandidates, flareCtx, planCtx, STEPS } from "../src/solve.ts";
import { answer, at, flare, HOST, m, plan } from "./helpers.ts";

const RUNS = 300;

function arbRule(n: number): fc.Arbitrary<Rule> {
  const time = fc.integer({ min: -60, max: 300 }).map((x) => at(x));
  return fc.oneof(
    fc.integer({ min: 0, max: n + 1 }).map((k): Rule => ({ type: "with", member_id: m(k) })),
    time.map((t): Rule => ({ type: "after", at: t })),
    time.map((t): Rule => ({ type: "back_by", at: t })),
    fc.integer({ min: 1, max: 60 }).map((x): Rule => ({ type: "max_walk", minutes: x })),
    fc.constantFrom<Step>(1, 2, 3, 4).map((s): Rule => ({ type: "max_step", step: s })),
    fc.constantFrom<Step>(1, 2, 3, 4).map((s): Rule => ({ type: "min_step", step: s })),
  );
}

const LABELS = ["spot", "c1", "c2", "step:1", "step:2", "step:3", "step:4"] as const;

function arbAnswer(id: Id, n: number): fc.Arbitrary<Answer> {
  return fc
    .record({
      status: fc.constantFrom<Answer["status"]>("yes", "yes", "yes", "taken_back", "cant_make_it"),
      ember_only: fc.boolean(),
      rules: fc.array(arbRule(n), { maxLength: 4 }),
      checks: fc.dictionary(fc.constantFrom(...LABELS), fc.boolean(), { maxKeys: 4 }),
    })
    .map((r) => answer(0, r.rules, { ...r, member_id: id }));
}

/** n members m1..mn (host m0 extra), answers shuffled. */
function arbAnswers(maxN: number): fc.Arbitrary<Answer[]> {
  return fc
    .integer({ min: 0, max: maxN })
    .chain((n) => fc.tuple(...Array.from({ length: n }, (_, i) => arbAnswer(m(i + 1), n))).map((xs) => xs as Answer[]));
}

const arbFlare = fc
  .record({ quorum: fc.integer({ min: 2, max: 4 }), ember: fc.boolean(), text: fc.integer({ min: 0, max: 3 }) })
  .map(({ quorum, ember, text }): Gathering => {
    const g = flare({ quorum });
    g.text_yes = text;
    if (ember) {
      g.state = "ember";
      g.quorum = 2;
      g.ember_choice = "c1";
    }
    return g;
  });

const arbPlan = fc
  .record({ quorum: fc.integer({ min: 2, max: 6 }), text: fc.integer({ min: 0, max: 3 }) })
  .map(({ quorum, text }): Gathering => {
    const g = plan({ quorum });
    g.text_yes = text;
    return g;
  });

const arbGathering = fc.oneof(arbFlare, arbPlan);
const NOW = at(10);

/** Exhaustive oracle (BR-S-4): every subset of yes candidates, every step, best by BR-S-1 then BR-S-6. */
function bruteForce(g: Gathering, answers: Answer[]): Candidate {
  const emberOnly = g.kind === "flare" && g.state === "ember";
  const cands = answers.filter((a) => a.member_id !== g.host && a.status === "yes" && (emberOnly || !a.ember_only));
  const ctxs =
    g.kind === "plan" ? STEPS.map((k) => planCtx(g, k)) : [flareCtx(Date.parse(NOW), g.ember_choice ?? "spot")];
  let top: Candidate | null = null;
  for (const ctx of ctxs) {
    for (let mask = 0; mask < 1 << cands.length; mask++) {
      const chosen = cands.filter((_, i) => mask & (1 << i));
      const set = new Set([g.host, ...chosen.map((a) => a.member_id)]);
      if (!chosen.every((a) => allRulesHold(a, set, ctx))) continue;
      const c: Candidate = { set: [...set].sort(), step: ctx.step, startMs: ctx.startMs };
      if (top === null || compareCandidates(c, top) < 0) top = c;
    }
  }
  if (!top) throw new Error("unreachable: the host-only set is always valid");
  return top;
}

describe("solver properties", () => {
  it("INV-1 BR-S-5: same input, same output, whatever the answer order", () => {
    fc.assert(
      fc.property(arbGathering, arbAnswers(8), fc.integer(), (g, answers, seed) => {
        const a = engine.solve(g, answers, NOW);
        const shuffled = [...answers].sort(
          (x, y) => ((x.member_id.charCodeAt(35) * seed) % 7) - ((y.member_id.charCodeAt(35) * seed) % 7),
        );
        expect(engine.solve(g, shuffled, NOW)).toEqual(a);
        expect(engine.solve(structuredClone(g), structuredClone(answers), NOW)).toEqual(a);
      }),
      { numRuns: RUNS },
    );
  });

  it("INV-2 BR-S-1 BR-S-4 BR-S-6: the fixed point equals the exhaustive search", () => {
    fc.assert(
      fc.property(arbGathering, arbAnswers(8), (g, answers) => {
        const s = engine.solve(g, answers, NOW);
        const b = bruteForce(g, answers);
        expect(s.set).toEqual(b.set);
        expect(s.step).toBe(b.step);
      }),
      { numRuns: RUNS },
    );
  });

  it("INV-3 BR-C-2 BR-S-3: every member of the set has all rules holding; the host is always in", () => {
    fc.assert(
      fc.property(arbGathering, arbAnswers(11), (g, answers) => {
        const s = engine.solve(g, answers, NOW);
        expect(s.set).toContain(HOST);
        const set = new Set(s.set);
        const ctx =
          g.kind === "plan" ? planCtx(g, s.step as Step) : flareCtx(Date.parse(NOW), g.ember_choice ?? "spot");
        for (const id of s.set) {
          if (id === HOST) continue;
          const a = answers.find((x) => x.member_id === id) as Answer;
          expect(a.status).toBe("yes");
          expect(allRulesHold(a, set, ctx)).toBe(true);
        }
        expect([...s.set].sort()).toEqual(s.set);
      }),
      { numRuns: RUNS },
    );
  });

  it("INV-4 CE1: adding a yes with no rules never shrinks the set", () => {
    fc.assert(
      fc.property(arbGathering, arbAnswers(10), (g, answers) => {
        const before = engine.solve(g, answers, NOW);
        const extra = answer(11);
        const after = engine.solve(g, [...answers.filter((a) => a.member_id !== m(11)), extra], NOW);
        expect(after.set.length).toBeGreaterThanOrEqual(before.set.length);
        if (g.kind === "flare") for (const id of before.set) expect(after.set).toContain(id);
      }),
      { numRuns: RUNS },
    );
  });

  it("INV-5 BR-Q-4 BR-Q-3: need = max(0, quorum − (set + text yeses)); lights exactly when need is 0", () => {
    fc.assert(
      fc.property(arbGathering, arbAnswers(11), (g, answers) => {
        const s = engine.solve(g, answers, NOW);
        expect(s.need).toBe(Math.max(0, g.quorum - (s.set.length + g.text_yes)));
        expect(s.lights).toBe(s.need === 0);
      }),
      { numRuns: RUNS },
    );
  });
});

// ---------- Random event sequences through transition() ----------

function arbEvent(n: number): fc.Arbitrary<EngineEvent> {
  const member = fc.integer({ min: 0, max: n }).map(m);
  return fc.oneof(
    {
      weight: 5,
      arbitrary: fc
        .record({
          member_id: member,
          rules: fc.array(arbRule(n), { maxLength: 4 }),
          ember_only: fc.boolean(),
          yes: fc.boolean(),
        })
        .map(
          (r): EngineEvent => ({
            type: "answer",
            member_id: r.member_id,
            answer: r.yes ? "yes" : "cant_make_it",
            rules: r.rules,
            ember_only: r.ember_only,
          }),
        ),
    },
    { weight: 2, arbitrary: member.map((id): EngineEvent => ({ type: "take_back", member_id: id })) },
    {
      weight: 2,
      arbitrary: fc
        .record({ id: member, results: fc.dictionary(fc.constantFrom(...LABELS), fc.boolean(), { maxKeys: 3 }) })
        .map((r): EngineEvent => ({ type: "checks", member_id: r.id, results: r.results })),
    },
    { weight: 1, arbitrary: fc.constant<EngineEvent>({ type: "text_yes" }) },
    { weight: 2, arbitrary: member.map((id): EngineEvent => ({ type: "fade", member_id: id })) },
    {
      weight: 3,
      arbitrary: fc
        .record({
          by: member,
          who: fc.oneof(
            fc.constant({ for: "self" as const }),
            member.map((id) => ({ for: "member" as const, member_id: id })),
            fc.constant({ for: "someone_else" as const }),
          ),
        })
        .map((r): EngineEvent => ({ type: "arrival", by: r.by, who: r.who, recorded_at: at(0) })),
    },
    { weight: 1, arbitrary: fc.constantFrom<EngineEvent>({ type: "done", by: HOST }, { type: "cancel", by: HOST }) },
    { weight: 1, arbitrary: member.map((id): EngineEvent => ({ type: "member_left", member_id: id })) },
    {
      weight: 3,
      arbitrary: fc.constantFrom<EngineEvent>(
        ...(["ember", "ember_pick", "gone", "plan_deadline", "delete"] as const).map((job) => ({
          type: "timer" as const,
          job,
        })),
      ),
    },
  );
}

const ORDER = { kindling: 0, ember: 1, lit: 2, gone: 3 } as const;

describe("transition properties", () => {
  it("INV-6 to INV-10: state never goes back, version only grows, caps hold, inputs are untouched", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          arbFlare.map((g) => ({ ...g, state: "kindling" as const, quorum: g.quorum, ember_choice: null })),
          arbPlan,
        ),
        fc.array(fc.tuple(arbEvent(6), fc.integer({ min: 0, max: 20 })), { maxLength: 40 }),
        (g0, events) => {
          let g = g0;
          g.text_yes = 0;
          let answers: Answer[] = [];
          let t = 0;
          for (const [e, dt] of events) {
            t += dt;
            const now = at(t);
            const ev = e.type === "arrival" ? { ...e, recorded_at: at(Math.max(0, t - 1)) } : e;
            const gCopy = structuredClone(g);
            const aCopy = structuredClone(answers);
            const r = engine.transition(g, answers, ev, now);
            expect(g).toEqual(gCopy); // INV-10 purity
            expect(answers).toEqual(aCopy);
            expect(engine.transition(g, answers, ev, now)).toEqual(r); // INV-1 determinism
            if (!r.ok) continue;
            const n = r.gathering;
            expect(ORDER[n.state]).toBeGreaterThanOrEqual(ORDER[g.state]); // INV-6 BR-F-7
            expect(n.version).toBeGreaterThanOrEqual(g.version); // INV-7
            expect(n.text_yes).toBeLessThanOrEqual(3); // BR-ID-6
            if (n.headcount !== null)
              expect(n.headcount).toBeLessThanOrEqual(Math.max(yesCount(n, r.answers) + 3, g.headcount ?? 1)); // INV-8 BR-H-4
            if (g.state === "lit" && ev.type !== "member_left") {
              for (const id of g.chosen_set) expect(n.chosen_set).toContain(id); // INV-9 BR-P-6, BR-F-7
              const before = g.plan?.current_step ?? 0;
              const after = n.plan?.current_step ?? 0;
              expect(after - before).toBeGreaterThanOrEqual(0);
              expect(after - before).toBeLessThanOrEqual(1);
            }
            if (n.state === "lit")
              expect(n.chosen_set.length + n.text_yes).toBeGreaterThanOrEqual(
                n.kind === "plan" ? 2 : Math.min(n.quorum, 2),
              );
            if (g.state === "gone") expect(n).toEqual(g);
            g = n;
            answers = r.answers;
          }
        },
      ),
      { numRuns: RUNS },
    );
  });
});
