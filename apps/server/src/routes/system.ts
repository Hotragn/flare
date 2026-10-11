// Health, public config and the deletion audit (openapi tag system).
import type { HealthT } from "@flare/shared";
import type { Context, Hono } from "hono";
import type { Ctx } from "../core/deps.ts";
import { audit } from "../core/sweep.ts";
import { ApiError } from "../http/errors.ts";
import { LIMITS, type RateLimiter } from "../http/middleware.ts";
import { clientIp } from "../http/write.ts";
import { MAX_MEMBERS } from "./groups.ts";

const AUDIT_CACHE_MS = 60_000;

export function mountSystem(app: Hono, ctx: Ctx, rl: RateLimiter): void {
  const readLimit = (c: Context) => {
    const wait = rl.hit(`r:${clientIp(c)}`, LIMITS.perIp * 5);
    if (wait) throw new ApiError(429, "rate_limited", "Too many requests", { "retry-after": String(wait) });
  };

  app.get("/api/v1/health", async (c) => {
    readLimit(c);
    let dbState: HealthT["db"] = "not_configured";
    if (ctx.db)
      dbState = await ctx.db.query("select 1").then(
        () => "ok" as const,
        () => "down" as const,
      );
    const out: HealthT = { ok: true, version: ctx.config.version, hub: ctx.relay.status, db: dbState };
    return c.json(out);
  });

  app.get("/api/v1/config", (c) => {
    readLimit(c);
    return c.json({
      version: ctx.config.version,
      vapid_public_key: ctx.config.vapidPublicKey,
      telegram_bot_username: ctx.config.telegramBotUsername,
      limits: {
        max_members: MAX_MEMBERS,
        max_photo_bytes: 1_500_000,
        flare_quorum: [2, 3, 4],
        plan_quorum: [2, 3, 4, 5, 6],
      },
    });
  });

  let cached: { at: number; body: unknown } | null = null;
  app.get("/api/v1/audit", async (c) => {
    readLimit(c);
    if (!ctx.db) throw new ApiError(503, "not_configured", "Database not configured");
    const now = ctx.clock.now();
    if (!cached || now.getTime() - cached.at > AUDIT_CACHE_MS)
      cached = { at: now.getTime(), body: await audit(ctx.db, now) };
    c.header("cache-control", "public, max-age=60");
    return c.json(cached.body as object);
  });
}
