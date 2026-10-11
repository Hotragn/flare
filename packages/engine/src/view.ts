// ICD-1 view(): the shared view's "Need N more" (BR-Q-4, SRS-SOL-3) and when it next changes.
import type { Answer, Gathering, Iso } from "@flare/shared/icd/engine";
import { solve } from "./solve.ts";
import { EMBER_END_MS, EMBER_PICK_MS, iso, KINDLING_MS, ms } from "./time.ts";
import { litEndMs } from "./transition.ts";

/** The next time a timer will change this gathering, or null at Gone (shown with BR-TIME-3). */
export function nextChangeAt(g: Gathering): Iso | null {
  const t0 = ms(g.created_at);
  switch (g.state) {
    case "kindling":
      if (g.kind === "flare") return iso(t0 + KINDLING_MS);
      if (!g.plan) throw new RangeError("engine: plan without times");
      return iso(ms(g.plan.deadline_at));
    case "ember":
      if (g.ember_choice === null) return iso(Math.min(ms(g.state_since) + EMBER_PICK_MS, t0 + EMBER_END_MS));
      return iso(t0 + EMBER_END_MS);
    case "lit":
      return iso(litEndMs(g));
    case "gone":
      return null;
  }
}

export function view(g: Gathering, answers: Answer[], now: Iso): { need: number; next_change_at: Iso | null } {
  return { need: solve(g, answers, now).need, next_change_at: nextChangeAt(g) };
}
