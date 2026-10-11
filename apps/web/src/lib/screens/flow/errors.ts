// Contract error code to the copy deck string the phone shows (FE1, ICD-2 Error, ICD-12).
// Phones never show the server's `message`; every code has a deck string here.
import type { CopyKey } from "#lib/copy/index.ts";
import type { FailCode } from "./api.ts";

export const ERROR_COPY: Record<FailCode, CopyKey> = {
  network: "err.network",
  bad_request: "err.server",
  unauthorized: "err.notMember",
  forbidden: "err.notMember",
  unknown_member: "err.notMember",
  not_found: "err.over",
  gone: "err.over",
  group_full: "join.full",
  wrong_state: "err.wrongState",
  already_lit: "err.wrongState",
  version_conflict: "err.wrongState",
  not_host: "err.notMember",
  not_in_set: "err.wrongState",
  fade_used: "err.fadeUsed",
  fade_window_closed: "err.fadeClosed",
  text_yes_cap: "host.textYes.max",
  code_mismatch: "host.textYes.wrong",
  not_arrived: "err.wrongState",
  spark_exists: "spark.saved",
  plan_times: "plan.err.tooClose",
  quorum_range: "err.server",
  bind_expired: "err.wrongState",
  too_large: "err.tooLarge",
  not_jpeg: "err.tooLarge",
  rate_limited: "err.rateLimit",
  not_configured: "err.server",
};

export const errorKey = (code: FailCode): CopyKey => ERROR_COPY[code];
