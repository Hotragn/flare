// Wire shapes the app reads and writes, copied from docs/architecture/contracts/openapi.yaml
// v1.0.0 (ICD-2). Field names and optionality match the contract; test/flow/api-types.test.ts
// checks the required lists against the YAML so drift fails CI.
import type { Iso, Label, Rule, State, Step } from "@flare/shared/icd/engine";

export type ErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "gone"
  | "group_full"
  | "wrong_state"
  | "already_lit"
  | "not_host"
  | "not_in_set"
  | "fade_used"
  | "fade_window_closed"
  | "text_yes_cap"
  | "code_mismatch"
  | "not_arrived"
  | "spark_exists"
  | "plan_times"
  | "quorum_range"
  | "unknown_member"
  | "bind_expired"
  | "version_conflict"
  | "too_large"
  | "not_jpeg"
  | "rate_limited"
  | "not_configured";

export type ApiError = { code: ErrorCode; message: string };

export type PlanStepWire = { step: Step; minutes: number; place: Label };

export type GatheringView = {
  id: string;
  group_id: string;
  kind: "flare" | "plan";
  state: State;
  quorum: number;
  need: number;
  short_code: string;
  version: number;
  created_at: Iso;
  state_since: Iso;
  next_change_at?: Iso | null;
  server_time: Iso;
  sealed: string;
  notice_ct: string;
  has_photo: boolean;
  headcount?: number | null;
  ember_choice?: Label | null;
  plan?: { start_at: Iso; deadline_at: Iso; current_step: Step | null; steps: PlanStepWire[] } | null;
  ended?: "not_this_time" | "thanks_for_coming" | null;
};

export type Me = {
  member_id: string;
  is_host: boolean;
  answer: "none" | "yes" | "cant_make_it";
  rules: Rule[];
  ember_only: boolean;
  in_set: boolean | null;
  arrived: boolean;
  can_take_back: boolean;
  can_fade: boolean;
  still_coming: boolean;
};

export type Member = { id: string; name_ct: string | null; joined_at: Iso; via: "link" | "telegram" };
export type NewMember = { id: string; name_ct: string; write_token: string };
export type Group = {
  id: string;
  channel: "link" | "telegram";
  members: Member[];
  live: { id: string; kind: "flare" | "plan"; state: State }[];
};

export type AnswerBody = {
  answer: "yes" | "cant_make_it";
  rules?: Rule[];
  ember_only?: boolean;
  checks?: { results: Partial<Record<Label, boolean>> };
};

export type CreateGathering = {
  id: string;
  kind: "flare" | "plan";
  quorum: number;
  tz: string;
  sealed: string;
  notice_ct: string;
  ember_candidates?: Label[];
  plan?: { start_at: Iso; deadline_at: Iso; steps: PlanStepWire[] };
  /** Telegram groups only: the bot's readable post text (ADR-0013, contracts/telegram.md 3). */
  telegram?: TelegramPlain;
};
export type TelegramPlain = {
  host: string;
  invite: string;
  place: string;
  link: string;
  ember_places?: Partial<Record<Label, string>>;
  step_names?: Partial<Record<Label, string>>;
};
export type TelegramSettings = { show_photos: boolean };

export type ArrivalBody = { for: "self" | "member" | "someone_else"; member_id?: string; recorded_at: Iso };
export type ArrivalResult = { gathering: GatheringView; counted: boolean; spark_ticket?: string | null };

export type DraftResponse = { invite: string; alt: string; tier: "hub" | "rules" | "cloud"; ms: number };
export type LadderResponse = {
  steps: { step: Step; label: string; minutes: number }[];
  tier: "hub" | "rules";
  ms: number;
};
