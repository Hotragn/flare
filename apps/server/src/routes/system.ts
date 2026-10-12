// Health, public config and the deletion audit (openapi tag system).
import type { HealthT } from "@flare/shared";
import type { Context, Hono } from "hono";
import type { Ctx } from "../core/deps.ts";
import { launchStats } from "../core/launch.ts";
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
      // ADR-0022: tells the phone it may wait for the slower cloud tier, and may offer the photo opt-in.
      cloud_ai: {
        provider: ctx.cloud?.providers[0] ?? null,
        providers: ctx.cloud?.providers ?? [],
        ladder: !!ctx.cloud,
        photo_opt_in: !!ctx.cloud,
      },
      // ADR-0027: the phone offers "Say it" on the Spark screen only when this is true.
      voice: { spark: !!ctx.voice },
      remember: !!ctx.rememberThis, // ADR-0031: the phones show Remember this only when true
      limits: {
        max_members: MAX_MEMBERS,
        max_photo_bytes: 1_500_000,
        flare_quorum: [2, 3, 4],
        plan_quorum: [2, 3, 4, 5, 6],
      },
    });
  });

  // Since launch: six totals and when counting began. No ids, names, groups or event times.
  let launchCached: { at: number; body: unknown } | null = null;
  app.get("/api/v1/stats", async (c) => {
    readLimit(c);
    if (!ctx.db) throw new ApiError(503, "not_configured", "Database not configured");
    const now = ctx.clock.now().getTime();
    if (!launchCached || now - launchCached.at > AUDIT_CACHE_MS)
      launchCached = { at: now, body: await launchStats(ctx.db) };
    c.header("cache-control", "public, max-age=60");
    return c.json(launchCached.body as object);
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
