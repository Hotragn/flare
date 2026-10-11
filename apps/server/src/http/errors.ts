// Contract error codes (openapi.yaml, schema Error). The body never echoes the input.
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

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

/** Thrown anywhere in a handler; the app's onError turns it into the contract body. */
export class ApiError extends Error {
  readonly status: ContentfulStatusCode;
  readonly code: ErrorCode;
  readonly headers: Record<string, string>;
  /** Extra body fields allowed by the contract (for example `ended` on 410). */
  readonly extra: Record<string, unknown>;
  constructor(
    status: ContentfulStatusCode,
    code: ErrorCode,
    message: string,
    headers: Record<string, string> = {},
    extra: Record<string, unknown> = {},
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.headers = headers;
    this.extra = extra;
  }
}

export function apiError(c: Context, status: ContentfulStatusCode, code: ErrorCode, message: string) {
  return c.json({ code, message }, status);
}

/** HTTP status for each engine error (ICD-1 EngineError). */
export const ENGINE_STATUS: Record<string, ContentfulStatusCode> = {
  wrong_state: 409,
  already_lit: 409,
  not_host: 403,
  not_in_set: 403,
  fade_used: 409,
  fade_window_closed: 409,
  text_yes_cap: 422,
  unknown_member: 422,
};
