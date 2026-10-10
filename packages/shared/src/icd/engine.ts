// ICD-1: the core engine's interface (docs/engineering/02-interface-control.md).
// Frozen v1. The engine is pure: no I/O, no clock reads. Backend calls it inside a
// transaction and executes the returned effects after commit. Rules: BR-Q, BR-S, BR-F,
// BR-P, BR-E, BR-H; transition tables in docs/architecture/04-state-machines.md.

export type Id = string; // UUID v4 (ADR-0018)
export type Iso = string; // UTC ISO 8601 with milliseconds
export type Kind = "flare" | "plan";
export type State = "kindling" | "lit" | "ember" | "gone";
export type Ended = "not_this_time" | "thanks_for_coming";
/** Opaque place label inside one gathering (ADR-0009). */
export type Label = "spot" | `c${number}` | `step:${1 | 2 | 3 | 4}`;
export type Step = 1 | 2 | 3 | 4;
export type JobKind = "ember" | "ember_pick" | "gone" | "plan_deadline" | "delete";

export type Rule =
  | { type: "with"; member_id: Id }
  | { type: "after"; at: Iso }
  | { type: "back_by"; at: Iso }
  | { type: "max_walk"; minutes: number }
  | { type: "max_step"; step: Step }
  | { type: "min_step"; step: Step };

export type PlanStep = { step: Step; minutes: number; place: Label };

export type Answer = {
  member_id: Id;
  status: "yes" | "taken_back" | "cant_make_it";
  ember_only: boolean;
  rules: Rule[]; // 0 to 4, all must hold (BR-C-2)
  /** Phone's pass/fail per label; max_walk and needs are folded in here (BR-C-7, BR-E-3). */
  checks: Partial<Record<Label, boolean>>;
  checks_at: Iso | null;
  faded: boolean;
  still_coming: boolean;
  arrived_at: Iso | null;
};

export type Gathering = {
  id: Id;
  group_id: Id;
  kind: Kind;
  state: State;
  host: Id;
  group_size: number; // members in the group now, for BR-P-2 "every member said yes"
  quorum: number;
  version: number;
  created_at: Iso; // t0
  state_since: Iso;
  lit_at: Iso | null;
  done_at: Iso | null;
  ended: Ended | null;
  ember_candidates: Label[]; // c1..cN in distance order
  ember_choice: Label | null;
  plan: { start_at: Iso; deadline_at: Iso; steps: PlanStep[]; current_step: Step | null } | null;
  chosen_set: Id[]; // never leaves the server (SRS-PRIV-8)
  text_yes: number; // 0 to 3 anonymous yeses (BR-ID-6)
  headcount: number | null;
};

export type ArrivalFor = { for: "self" } | { for: "member"; member_id: Id } | { for: "someone_else" };

export type EngineEvent =
  | { type: "answer"; member_id: Id; answer: "yes" | "cant_make_it"; rules: Rule[]; ember_only: boolean }
  | { type: "take_back"; member_id: Id }
  | { type: "checks"; member_id: Id; results: Partial<Record<Label, boolean>> }
  | { type: "text_yes" }
  | { type: "fade"; member_id: Id }
  | { type: "arrival"; by: Id; who: ArrivalFor; recorded_at: Iso }
  | { type: "done"; by: Id }
  | { type: "cancel"; by: Id }
  | { type: "member_left"; member_id: Id }
  | { type: "timer"; job: JobKind };

export type PushEvent = "lit" | "ember" | "plan_on" | "plan_ember" | "plan_smaller" | "still_coming" | "gone";

export type Effect =
  | { type: "schedule"; job: JobKind; at: Iso }
  | { type: "unschedule"; job: JobKind }
  | { type: "push"; event: PushEvent; to: "set" | "all" | Id[]; label?: Label; step?: Step }
  | { type: "telegram"; action: "edit_count" | "lit" | "ember" | "smaller" | "final" }
  | { type: "spark_ticket"; member_id: Id }
  | { type: "counter"; name: string; bucket?: string }
  | { type: "sse" };

/** Error codes the engine can return; a subset of the contract's Error.code list. */
export type EngineError =
  | "wrong_state"
  | "already_lit"
  | "not_host"
  | "not_in_set"
  | "fade_used"
  | "fade_window_closed"
  | "text_yes_cap"
  | "unknown_member";

export type Result =
  | { ok: true; gathering: Gathering; answers: Answer[]; effects: Effect[] }
  | { ok: false; error: EngineError };

export type Solution = {
  set: Id[]; // best set, host included, ties broken by lowest ids (BR-S-6)
  step: Step | null; // Plans: chosen step; Flares: null
  need: number; // BR-Q-4
  lights: boolean;
};

/** Implemented by packages/engine (work package CE). Same input, same output (BR-S-5). */
export interface Engine {
  solve(g: Gathering, answers: Answer[], now: Iso): Solution;
  transition(g: Gathering, answers: Answer[], event: EngineEvent, now: Iso): Result;
  /** The shared view's need and next change time, for GET /gatherings/{id}. */
  view(g: Gathering, answers: Answer[], now: Iso): { need: number; next_change_at: Iso | null };
}
