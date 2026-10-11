// Request guards shared by every API route: member auth (SRS-SEC-4), write rate limits
// (SRS-SEC-5), idempotency (SRS-IF-1, SRS-REL-2) and strict body validation.
import { createHash, timingSafeEqual } from "node:crypto";
import type { Context } from "hono";
import type { z } from "zod";
import type { Db } from "../db/db.ts";
import { ApiError } from "./errors.ts";

export const sha256 = (s: string | Buffer): Buffer => createHash("sha256").update(s).digest();

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN = /^[A-Za-z0-9_-]{22}$/;
const IDEM = /^[A-Za-z0-9_-]{16,64}$/;

export const isUuid = (s: string | undefined): s is string => !!s && UUID.test(s);

export type Member = { id: string; group_id: string };

/** Parses `Authorization: Bearer {memberId}.{writeToken}` and checks the token hash. */
export async function requireMember(c: Context, db: Db): Promise<Member> {
  const h = c.req.header("authorization") ?? "";
  const m = /^Bearer ([0-9a-fA-F-]{36})\.([A-Za-z0-9_-]{22})$/.exec(h);
  if (!m || !isUuid(m[1]) || !TOKEN.test(m[2] ?? "")) throw new ApiError(401, "unauthorized", "Member token needed");
  const id = (m[1] as string).toLowerCase();
  const { rows } = await db.query<{ id: string; group_id: string; write_token_hash: Buffer | null }>(
    "select id, group_id, write_token_hash from members where id = $1",
    [id],
  );
  const row = rows[0];
  const given = sha256(m[2] as string);
  const stored = row?.write_token_hash ? Buffer.from(row.write_token_hash) : null;
  if (!row || !stored || stored.length !== given.length || !timingSafeEqual(stored, given))
    throw new ApiError(401, "unauthorized", "Member token not recognised");
  return { id: row.id, group_id: row.group_id };
}

/** Validates a JSON body against a strict zod schema; 400 bad_request on any mismatch. */
export async function body<T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new ApiError(400, "bad_request", "Body is not JSON");
  }
  const r = schema.safeParse(raw);
  if (!r.success) throw new ApiError(400, "bad_request", "Body does not match the contract");
  return r.data;
}

/** Fixed-window counters in memory. One server instance (ADR-0004), so memory is enough. */
export class RateLimiter {
  private readonly windows = new Map<string, { start: number; n: number }>();
  private readonly now: () => number;
  constructor(now: () => number = Date.now) {
    this.now = now;
  }
  /** Counts one hit; returns seconds to wait when over `limit` per 60 s, else 0. */
  hit(key: string, limit: number): number {
    const t = this.now();
    let w = this.windows.get(key);
    if (!w || t - w.start >= 60_000) {
      w = { start: t, n: 0 };
      this.windows.set(key, w);
      if (this.windows.size > 50_000) this.prune(t);
    }
    w.n += 1;
    return w.n > limit ? Math.max(1, Math.ceil((w.start + 60_000 - t) / 1000)) : 0;
  }
  private prune(t: number): void {
    for (const [k, w] of this.windows) if (t - w.start >= 60_000) this.windows.delete(k);
  }
}

export const LIMITS = { perMember: 30, perGathering: 300, perIp: 60 } as const;

/** SRS-SEC-5: 30 writes per minute per member, 300 per gathering. */
export function limitWrite(rl: RateLimiter, keys: { member?: string; gathering?: string; anon?: string }): void {
  const waits = [
    keys.member ? rl.hit(`m:${keys.member}`, LIMITS.perMember) : 0,
    keys.gathering ? rl.hit(`g:${keys.gathering}`, LIMITS.perGathering) : 0,
    keys.anon ? rl.hit(`a:${keys.anon}`, LIMITS.perIp) : 0,
  ];
  const wait = Math.max(...waits);
  if (wait > 0) throw new ApiError(429, "rate_limited", "Too many writes", { "retry-after": String(wait) });
}

export type Stored = { status: number; body: unknown; headers?: Record<string, string> };

/** Reads the Idempotency-Key header; 400 when missing or malformed. */
export function idemKey(c: Context): string {
  const k = c.req.header("idempotency-key");
  if (!k || !IDEM.test(k)) throw new ApiError(400, "bad_request", "Idempotency-Key header needed");
  return k;
}

/**
 * Runs `fn` once per (scope, key). A repeat returns the stored first response and changes
 * nothing. Only successful (2xx) responses are stored, so a retry after a 409 can succeed later.
 */
export async function idempotent(
  db: Db,
  scope: string,
  key: string,
  now: Date,
  fn: () => Promise<Stored>,
): Promise<Stored> {
  const full = `${scope}:${key}`;
  const hit = await db.query<{ response: Stored }>(
    "select response from idempotency where key = $1 and expires_at > $2",
    [full, now.toISOString()],
  );
  if (hit.rows[0]) return hit.rows[0].response;
  const r = await fn();
  if (r.status >= 200 && r.status < 300)
    await db.query(
      `insert into idempotency (key, response, expires_at) values ($1, $2, $3)
       on conflict (key) do update set response = excluded.response, expires_at = excluded.expires_at`,
      [full, JSON.stringify(r), new Date(now.getTime() + 24 * 3600_000).toISOString()],
    );
  return r;
}
