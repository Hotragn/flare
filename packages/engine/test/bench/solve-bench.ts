// Budget B14: 12 members × 4 rules × 4 steps must solve in ≤ 5 ms.
// Run: npm run -w packages/engine bench   (prints p50, p99, max in ms)
import type { Answer, Gathering, Rule } from "@flare/shared/icd/engine";
import { createPlan, engine } from "../../src/index.ts";

const T0 = "2026-10-11T15:00:00.000Z";
const at = (min: number) => new Date(Date.parse(T0) + min * 60_000).toISOString();
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

/** Worst case: a with-chain that unravels one member per pass, plus 3 more rules each, 4 steps. */
export function worstCase(): { g: Gathering; answers: Answer[]; now: string } {
  const r = createPlan(
    {
      id: "bench",
      group_id: "bench",
      host: id(0),
      group_size: 12,
      quorum: 6,
      start_at: at(120),
      deadline_at: at(60),
      steps: [
        { step: 1, minutes: 90, place: "step:1" },
        { step: 2, minutes: 60, place: "step:2" },
        { step: 3, minutes: 40, place: "step:3" },
        { step: 4, minutes: 20, place: "step:4" },
      ],
    },
    T0,
  );
  if (!r.ok) throw new Error(r.error);
  const answers: Answer[] = [];
  for (let i = 1; i <= 11; i++) {
    const rules: Rule[] = [
      { type: "with", member_id: id(i + 1) }, // m11 points at m12, who never answered
      { type: "after", at: at(100) },
      { type: "back_by", at: at(400) },
      { type: "max_step", step: 1 },
    ];
    answers.push({
      member_id: id(i),
      status: "yes",
      ember_only: false,
      rules,
      checks: { "step:1": true, "step:2": i % 2 === 0, "step:3": true },
      checks_at: null,
      faded: false,
      still_coming: false,
      arrived_at: null,
    });
  }
  return { g: r.gathering, answers, now: at(30) };
}

export function measure(iterations: number): { p50: number; p99: number; max: number } {
  const { g, answers, now } = worstCase();
  for (let i = 0; i < 200; i++) engine.solve(g, answers, now); // warm up the JIT
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const t = performance.now();
    engine.solve(g, answers, now);
    times.push(performance.now() - t);
  }
  times.sort((a, b) => a - b);
  const q = (p: number) => times[Math.min(times.length - 1, Math.floor(p * times.length))] as number;
  return { p50: q(0.5), p99: q(0.99), max: times[times.length - 1] as number };
}

if (import.meta.main) {
  const r = measure(10_000);
  console.log(
    `solve 12 members x 4 rules x 4 steps, 10000 runs: p50 ${r.p50.toFixed(4)} ms, p99 ${r.p99.toFixed(4)} ms, max ${r.max.toFixed(4)} ms (budget B14: 5 ms)`,
  );
}
