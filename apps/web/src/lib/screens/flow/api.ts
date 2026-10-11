// HTTP calls the screens make (openapi.yaml v1.0.0). Reads go to fetch with the member's
// bearer token; every write goes through the outbox (ICD-5), which stores it first and adds
// the Idempotency-Key. Bodies and ids are never logged (09-observability.md).
import type { ClientIcd } from "@flare/shared/icd/index";
import type { ApiError, ErrorCode } from "./api-types.ts";
import type { Deps } from "./deps.ts";

export const BASE = "/api/v1";

export type FailCode = ErrorCode | "network";
export type Fail = { ok: false; code: FailCode; status: number };
export type Ok<T> = { ok: true; value: T; status: number };
export type Res<T> = Ok<T> | Fail;
/** A write the outbox kept for later (no signal): `value` is null. */
export type WriteRes<T> = Ok<T | null> | Fail;

export const bearer = (g: Pick<ClientIcd.GroupRecord, "memberId" | "token">): string =>
  `Bearer ${g.memberId}.${g.token}`;

const CODES = new Set<string>([
  "bad_request",
  "unauthorized",
  "forbidden",
  "not_found",
  "gone",
  "group_full",
  "wrong_state",
  "already_lit",
  "not_host",
  "not_in_set",
  "fade_used",
  "fade_window_closed",
  "text_yes_cap",
  "code_mismatch",
  "not_arrived",
  "spark_exists",
  "plan_times",
  "quorum_range",
  "unknown_member",
  "bind_expired",
  "version_conflict",
  "too_large",
  "not_jpeg",
  "rate_limited",
  "not_configured",
]);

/** Contract code from a status and an Error body; falls back by status. */
export function codeOf(status: number, body: unknown): FailCode {
  const code = (body as Partial<ApiError> | null)?.code;
  if (typeof code === "string" && CODES.has(code)) return code as ErrorCode;
  if (status === 0) return "network";
  if (status === 404) return "not_found";
  if (status === 410) return "gone";
  if (status === 429) return "rate_limited";
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 409) return "wrong_state";
  if (status === 413) return "too_large";
  return status >= 500 ? "not_configured" : "bad_request";
}

async function bodyOf(r: Response): Promise<unknown> {
  try {
    return await r.json();
  } catch {
    return null;
  }
}

export async function getJson<T>(d: Deps, path: string, auth?: string): Promise<Res<T>> {
  let r: Response;
  try {
    r = await d.fetch(BASE + path, { headers: auth ? { authorization: auth } : {}, cache: "no-store" });
  } catch {
    return { ok: false, code: "network", status: 0 };
  }
  const body = await bodyOf(r);
  if (!r.ok) return { ok: false, code: codeOf(r.status, body), status: r.status };
  return { ok: true, value: body as T, status: r.status };
}

export async function getBytes(d: Deps, path: string): Promise<Res<Uint8Array>> {
  let r: Response;
  try {
    r = await d.fetch(BASE + path);
  } catch {
    return { ok: false, code: "network", status: 0 };
  }
  if (!r.ok) return { ok: false, code: codeOf(r.status, await bodyOf(r)), status: r.status };
  return { ok: true, value: new Uint8Array(await r.arrayBuffer()), status: r.status };
}

/** The outbox rejects with an Error that may carry `status` and `code` (see the handoff). */
function failOf(e: unknown): Fail {
  const err = e as { status?: unknown; code?: unknown; body?: unknown } | null;
  const status = typeof err?.status === "number" ? err.status : 0;
  const body = typeof err?.code === "string" ? { code: err.code } : err?.body;
  return { ok: false, code: status === 0 && !body ? "network" : codeOf(status, body), status };
}

export async function write<T>(
  d: Deps,
  method: ClientIcd.OutboxItem["method"],
  path: string,
  body: unknown,
): Promise<WriteRes<T>> {
  try {
    const value = await d.outbox.send<T>({ method, path: BASE + path, body });
    return { ok: true, value, status: value === null ? 202 : 200 };
  } catch (e) {
    return failOf(e);
  }
}
