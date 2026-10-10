// Flare server entry: HTTP (Hono) plus the hub relay WebSocket on /hub.
import { serve } from "@hono/node-server";
import { WebSocketServer } from "ws";
import { createApp } from "./app.ts";
import { type Db, migrate, pgDb } from "./db/db.ts";
import { env } from "./env.ts";
import { bearer, HubRelay, secretMatches } from "./hub/relay.ts";
import { log } from "./log.ts";

const relay = new HubRelay(env.hubJobTimeoutMs, { pingMs: env.hubPingMs });
let db: Db | null = null;
if (env.databaseUrl) {
  db = await pgDb(env.databaseUrl);
  const applied = await migrate(db);
  log.info({ event: "db.migrated", applied: applied.length }, "migrations applied");
}

const app = createApp({ relay, db, version: env.version, webBuildDir: env.webBuildDir });
const server = serve({ fetch: app.fetch, port: env.port }, (i) =>
  log.info({ event: "listen", port: i.port }, "flare server up"),
);

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
  relay.close();
  wss.close();
  server.close();
  await db?.close();
  process.exit(0);
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
