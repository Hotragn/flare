// Fake ICD-1 engine for backend tests (02-interface-control.md: "lights at quorum with no
// rules"). It follows the transition tables in 04-state-machines.md closely enough to drive
// a full flow; rule solving is CE's job and is not modelled here (rules are ignored).
import type {
  Answer,
  Effect,
  Engine,
  EngineEvent,
  Gathering,
  Iso,
  Label,
  Result,
  Solution,
  Step,
} from "@flare/shared/icd/engine";

const MIN = 60_000;
const at = (iso: Iso, ms: number): Iso => new Date(Date.parse(iso) + ms).toISOString();

function yesIds(g: Gathering, answers: Answer[]): string[] {
  const ids = answers
    .filter((a) => a.status === "yes" && (g.state === "ember" || !a.ember_only))
    .map((a) => a.member_id);
  if (!ids.includes(g.host)) ids.push(g.host);
  return [...new Set(ids)].sort();
}

function stepMinutes(g: Gathering, step: Step | null): number {
  return g.plan?.steps.find((s) => s.step === step)?.minutes ?? 0;
}

export const fakeEngine: Engine = {
  solve(g, answers): Solution {
    const set = yesIds(g, answers);
    const size = set.length + g.text_yes;
    const q = g.state === "ember" ? 2 : g.quorum;
    return { set, step: g.kind === "plan" ? 1 : null, need: Math.max(0, q - size), lights: size >= q };
  },

  view(g, answers) {
    const need = g.state === "kindling" || g.state === "ember" ? this.solve(g, answers, g.state_since).need : 0;
    let next: Iso | null = null;
    if (g.kind === "flare") {
      if (g.state === "kindling") next = at(g.created_at, 30 * MIN);
      else if (g.state === "ember") next = at(g.created_at, 60 * MIN);
      else if (g.state === "lit") next = at(g.created_at, 240 * MIN);
    } else if (g.plan) {
      if (g.state === "kindling") next = g.plan.deadline_at;
      else if (g.state === "lit") next = at(g.plan.start_at, (stepMinutes(g, g.plan.current_step) + 60) * MIN);
    }
    return { need, next_change_at: next };
  },

  transition(g0, answers0, ev: EngineEvent, now): Result {
    if (g0.state === "gone") return { ok: false, error: "wrong_state" };
    const g: Gathering = structuredClone(g0);
    let answers: Answer[] = structuredClone(answers0);
    const effects: Effect[] = [];
    const find = (id: string) => answers.find((a) => a.member_id === id);
    const blank = (id: string): Answer => ({
      member_id: id,
      status: "yes",
      ember_only: false,
      rules: [],
      checks: {},
      checks_at: null,
      faded: false,
      still_coming: false,
      arrived_at: null,
    });
    const goGone = (ended: "not_this_time" | "thanks_for_coming") => {
      g.state = "gone";
      g.state_since = now;
      g.ended = ended;
      if (ended === "thanks_for_coming") g.done_at = now;
      effects.push({ type: "unschedule", job: "ember" }, { type: "unschedule", job: "gone" });
      effects.push({ type: "schedule", job: "delete", at: at(now, MIN) });
      effects.push({ type: "push", event: "gone", to: "all" }, { type: "telegram", action: "final" });
    };
    const maybeLight = () => {
      if (g.state !== "kindling" && g.state !== "ember") return;
      const s = this.solve(g, answers, now);
      if (!s.lights) {
        effects.push({ type: "telegram", action: "edit_count" });
        return;
      }
      if (g.state === "ember") effects.push({ type: "counter", name: "embers_lit" });
      g.state = "lit";
      g.state_since = now;
      g.lit_at = now;
      g.chosen_set = s.set;
      g.headcount = 1;
      effects.push({ type: "unschedule", job: "ember" }, { type: "unschedule", job: "ember_pick" });
      if (g.kind === "plan" && g.plan) {
        g.plan.current_step = 1;
        effects.push({ type: "unschedule", job: "plan_deadline" });
        effects.push({ type: "schedule", job: "gone", at: at(g.plan.start_at, (stepMinutes(g, 1) + 60) * MIN) });
        effects.push({ type: "push", event: "plan_on", to: "set", step: 1 });
      } else {
        effects.push({ type: "schedule", job: "gone", at: at(g.created_at, 240 * MIN) });
        effects.push({ type: "push", event: "lit", to: "set" });
      }
      effects.push({ type: "telegram", action: "lit" }, { type: "counter", name: "lit" });
    };

    switch (ev.type) {
      case "answer": {
        if (ev.answer === "cant_make_it") {
          if (g.state !== "lit") return { ok: false, error: "wrong_state" };
          const a = find(ev.member_id) ?? blank(ev.member_id);
          a.status = "cant_make_it";
          if (!find(ev.member_id)) answers.push(a);
          break;
        }
        const a = find(ev.member_id) ?? blank(ev.member_id);
        a.status = "yes";
        a.rules = ev.rules;
        a.ember_only = ev.ember_only;
        if (!find(ev.member_id)) answers.push(a);
        maybeLight();
        break;
      }
      case "take_back": {
        if (g.state === "lit") return { ok: false, error: "already_lit" };
        const a = find(ev.member_id);
        if (!a) return { ok: false, error: "unknown_member" };
        a.status = "taken_back";
        maybeLight();
        break;
      }
      case "checks": {
        const a = find(ev.member_id) ?? blank(ev.member_id);
        if (!find(ev.member_id)) {
          a.status = "taken_back";
          answers.push(a);
        }
        a.checks = { ...a.checks, ...ev.results };
        a.checks_at = now;
        break;
      }
      case "text_yes":
        if (g.text_yes >= 3) return { ok: false, error: "text_yes_cap" };
        g.text_yes += 1;
        maybeLight();
        break;
      case "fade": {
        if (g.kind !== "plan" || g.state !== "lit" || !g.plan) return { ok: false, error: "wrong_state" };
        if (!g.chosen_set.includes(ev.member_id)) return { ok: false, error: "not_in_set" };
        const a = find(ev.member_id) ?? blank(ev.member_id);
        if (a.faded) return { ok: false, error: "fade_used" };
        const k = g.plan.current_step ?? 1;
        if (Date.parse(now) > Date.parse(g.plan.start_at) + (stepMinutes(g, k) * MIN) / 2)
          return { ok: false, error: "fade_window_closed" };
        a.faded = true;
        if (!find(ev.member_id)) answers.push(a);
        if (k < 4) {
          const next = (k + 1) as Step;
          g.plan.current_step = next;
          effects.push({ type: "schedule", job: "gone", at: at(g.plan.start_at, (stepMinutes(g, next) + 60) * MIN) });
          effects.push({ type: "push", event: "plan_smaller", to: "set", step: next, label: `step:${next}` });
          effects.push({ type: "telegram", action: "smaller" });
        }
        break;
      }
      case "arrival": {
        if (g.state !== "lit") return { ok: false, error: "wrong_state" };
        if (ev.who.for !== "self" && ev.by !== g.host) return { ok: false, error: "not_host" };
        const cap = yesIds(g, answers).length + g.text_yes + 3;
        const target = ev.who.for === "self" ? ev.by : ev.who.for === "member" ? ev.who.member_id : null;
        const before = g.headcount ?? 1;
        if (target) {
          const a = find(target);
          if (!a && ev.who.for === "member" && !g.chosen_set.includes(target))
            return { ok: false, error: "unknown_member" };
          const row = a ?? blank(target);
          if (!a) answers.push(row);
          if (row.arrived_at || target === g.host) {
            // BR-H-3: counted once; the host is already the 1 in 1 + arrivals.
          } else if (before < cap) {
            row.arrived_at = ev.recorded_at;
            g.headcount = before + 1;
          }
        } else if (before < cap) g.headcount = before + 1;
        if (ev.who.for === "self" && (g.headcount ?? 1) > before)
          effects.push({ type: "spark_ticket", member_id: ev.by });
        if (ev.who.for === "self" && ev.by === g.host) effects.push({ type: "spark_ticket", member_id: ev.by });
        break;
      }
      case "done":
        if (ev.by !== g.host) return { ok: false, error: "not_host" };
        if (g.state !== "lit") return { ok: false, error: "wrong_state" };
        goGone("thanks_for_coming");
        break;
      case "cancel":
        if (ev.by !== g.host) return { ok: false, error: "not_host" };
        if (g.state === "lit") return { ok: false, error: "already_lit" };
        goGone("not_this_time");
        break;
      case "member_left":
        answers = answers.filter((a) => a.member_id !== ev.member_id);
        maybeLight();
        break;
      case "timer":
        if (ev.job === "ember" && g.state === "kindling" && g.kind === "flare") {
          g.state = "ember";
          g.state_since = now;
          g.quorum = 2;
          effects.push({ type: "schedule", job: "ember_pick", at: at(now, MIN) });
          effects.push({ type: "schedule", job: "gone", at: at(g.created_at, 60 * MIN) });
          effects.push({ type: "push", event: "ember", to: "all" }, { type: "telegram", action: "ember" });
          maybeLight();
        } else if (ev.job === "ember_pick" && g.state === "ember") {
          const first = (g.ember_candidates[0] ?? "spot") as Label;
          g.ember_choice = first;
        } else if (ev.job === "gone") {
          goGone(g.state === "lit" ? "thanks_for_coming" : "not_this_time");
        } else if (ev.job === "plan_deadline" && g.state === "kindling") {
          const s = this.solve(g, answers, now);
          if (s.lights) maybeLight();
          else if (s.set.length + g.text_yes >= 2 && g.plan) {
            g.state = "lit";
            g.state_since = now;
            g.lit_at = now;
            g.chosen_set = s.set;
            g.headcount = 1;
            g.plan.current_step = 4;
            effects.push({ type: "schedule", job: "gone", at: at(g.plan.start_at, (stepMinutes(g, 4) + 60) * MIN) });
            effects.push({ type: "push", event: "plan_ember", to: "set", step: 4 });
          } else goGone("not_this_time");
        } else return { ok: true, gathering: g0, answers: answers0, effects: [] };
        break;
    }
    g.version += 1;
    effects.push({ type: "sse" });
    return { ok: true, gathering: g, answers, effects };
  },
};
