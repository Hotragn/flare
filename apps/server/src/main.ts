// Flare server entry: HTTP (Hono), live updates (SSE), the scheduler and sweeper, and the hub
// relay WebSocket on /hub.
import { engine } from "@flare/engine";
import { serve } from "@hono/node-server";
import { WebSocketServer } from "ws";
import { buildCtx, createApp } from "./app.ts";
import { cloudTier } from "./cloud.ts";
import { startScheduler } from "./core/scheduler.ts";
import { type Db, memoryDb, migrate, pgDb } from "./db/db.ts";
import { env } from "./env.ts";
import { bearer, HubRelay, secretMatches } from "./hub/relay.ts";
import { integrations } from "./integrations.ts";
import { log } from "./log.ts";
import { flushTracing, initTracing } from "./tracing.ts";
import { voiceTier } from "./voice.ts";

// ADR-0021: AI-path tracing to Sentry when SENTRY_DSN is set; allow-listed attributes only.
log.info({ event: "tracing", on: initTracing() }, "tracing");

const relay = new HubRelay(env.hubJobTimeoutMs, { pingMs: env.hubPingMs });
let db: Db | null = null;
if (env.databaseUrl) {
  // `pglite:memory` runs a real Postgres in memory for local end-to-end runs; never in production.
  db = env.databaseUrl === "pglite:memory" ? await memoryDb() : await pgDb(env.databaseUrl);
  const applied = await migrate(db);
  log.info({ event: "db.migrated", applied: applied.length }, "migrations applied");
}

const ints = integrations(process.env, env.webBuildDir);
// End-to-end test clock (scripts/e2e-field.ts): only with FLARE_E2E_CLOCK=1 AND an in-memory
// database, so it can never be switched on against real data. POST /__e2e/clock {advance_ms}.
const e2eClock = process.env.FLARE_E2E_CLOCK === "1" && env.databaseUrl === "pglite:memory";
let clockOffset = 0;
const e2eMount = (app: import("hono").Hono) => {
  app.post("/__e2e/clock", async (c) => {
    const b = (await c.req.json()) as { advance_ms?: number };
    clockOffset += Math.max(0, Number(b.advance_ms ?? 0));
    return c.json({ now: new Date(Date.now() + clockOffset).toISOString() });
  });
};
const deps = {
  mounts: e2eClock ? [e2eMount, ints.mount] : [ints.mount],
  ...(e2eClock ? { clock: { now: () => new Date(Date.now() + clockOffset) } } : {}),
  cloud: cloudTier(),
  voice: voiceTier(),
  relay,
  db,
  version: env.version,
  webBuildDir: env.webBuildDir,
  engine,
  ladderTimeoutMs: env.ladderTimeoutMs,
  ladderAgent: env.ladderAgent,
  config: {
    publicBaseUrl: env.publicBaseUrl,
    vapidPublicKey: env.vapidPublicKey,
    telegramBotUsername: env.telegramBotUsername,
  },
};
const ctx = buildCtx(deps);
const app = createApp(deps, ctx);
const scheduler = db && ctx.engine ? startScheduler(ctx) : null;

const server = serve({ fetch: app.fetch, port: env.port }, (i) =>
  log.info({ event: "listen", port: i.port }, "flare server up"),
);
void ints.resume().catch(() => log.warn({ event: "tg.resume_failed" }, "telegram resume failed"));

const wss = new WebSocketServer({ noServer: true, maxPayload: 2_000_000 });
server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url ?? "/", "http://x");
  if (url.pathname !== "/hub" || !secretMatches(bearer(req), env.hubSecret)) {
    socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
    socket.destroy();
    log.warn({ event: "hub.refused" }, "hub upgrade refused");
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => relay.attach(ws));
});

const stop = async () => {
  scheduler?.stop();
  ints.close();
  await flushTracing();
  relay.close();
  wss.close();
  server.close();
  await db?.close();
  process.exit(0);
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
