// Starts the real server pieces on a random port with an in-memory hub socket.
import type { AddressInfo } from "node:net";
import { serve } from "@hono/node-server";
import { WebSocketServer } from "ws";
import { createApp } from "../src/app.ts";
import type { Db } from "../src/db/db.ts";
import { bearer, HubRelay, secretMatches } from "../src/hub/relay.ts";

export const SECRET = "test-secret-0123456789abcdef0123456789";

export async function startServer(db: Db | null = null, timeoutMs = 3000) {
  const relay = new HubRelay(timeoutMs);
  const app = createApp({ relay, db, version: "test" });
  const server = serve({ fetch: app.fetch, port: 0 });
  await new Promise((r) => server.once("listening", r));
  const wss = new WebSocketServer({ noServer: true });
  server.on("upgrade", (req, socket, head) => {
    if (new URL(req.url ?? "/", "http://x").pathname !== "/hub" || !secretMatches(bearer(req), SECRET)) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => relay.attach(ws));
  });
  const port = (server.address() as AddressInfo).port;
  return {
    port,
    base: `http://127.0.0.1:${port}`,
    ws: `ws://127.0.0.1:${port}`,
    relay,
    close: async () => {
      relay.close();
      wss.close();
      await new Promise((r) => server.close(r));
    },
  };
}

/** Smallest valid JPEG header bytes plus padding (enough for the server's checks). */
export const fakeJpeg = (n = 2048) => {
  const b = Buffer.alloc(n, 0x11);
  b[0] = 0xff;
  b[1] = 0xd8;
  return b;
};
