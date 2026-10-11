// One wrapper for every write: rate limit (SRS-SEC-5), Idempotency-Key (SRS-IF-1), then the
// handler. A repeat with the same key gets the first response and changes nothing.
import type { Context } from "hono";
import type { Ctx } from "../core/deps.ts";
import type { Db } from "../db/db.ts";
import { ApiError } from "./errors.ts";
import { idemKey, idempotent, limitWrite, type Member, type RateLimiter, type Stored } from "./middleware.ts";

export function needDb(ctx: Ctx): Db {
  if (!ctx.db) throw new ApiError(503, "not_configured", "Database not configured");
  return ctx.db;
}

export type WriteOpts = { member?: Member; gathering?: string; anon?: string };

export async function write(
  c: Context,
  ctx: Ctx,
  rl: RateLimiter,
  opts: WriteOpts,
  fn: () => Promise<Stored>,
): Promise<Response> {
  const db = needDb(ctx);
  const key = idemKey(c);
  limitWrite(rl, { member: opts.member?.id, gathering: opts.gathering, anon: opts.anon });
  const scope = opts.member ? opts.member.id : "anon";
  const r = await idempotent(db, scope, key, ctx.clock.now(), fn);
  return send(r);
}

export function send(r: Stored): Response {
  const headers = new Headers(r.headers ?? {});
  if (r.body === null || r.body === undefined || r.status === 204)
    return new Response(null, { status: r.status, headers });
  headers.set("content-type", "application/json");
  return new Response(JSON.stringify(r.body), { status: r.status, headers });
}

/** Caller's IP for anonymous write limits only; kept in memory, never logged. */
export function clientIp(c: Context): string {
  return (
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    (c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined)?.incoming?.socket?.remoteAddress ??
    "unknown"
  );
}
