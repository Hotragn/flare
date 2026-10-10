// Hub relay (ADR-0006). The Mac hub opens an outbound WebSocket to /hub with a shared
// secret; the server sends photo jobs over it and waits for the JSON result.
// The photo exists only in memory on both ends and is never written to disk or logs.
import { randomUUID, timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { FromHub, HUB_PROTOCOL, type JobHeaderT, type JobResultT } from "@flare/shared";
import type { WebSocket } from "ws";
import { log } from "../log.ts";

type Pending = { resolve: (r: JobResultT | null) => void; timer: NodeJS.Timeout };

export function secretMatches(given: string | undefined, expected: string): boolean {
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function bearer(req: IncomingMessage): string | undefined {
  const h = req.headers.authorization;
  return h?.startsWith("Bearer ") ? h.slice(7) : undefined;
}

export class HubRelay {
  private socket: WebSocket | null = null;
  private model = "";
  private ready = false;
  private pending = new Map<string, Pending>();
  private pinger: NodeJS.Timeout | null = null;

  private readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    this.timeoutMs = timeoutMs;
  }

  get status(): "connected" | "absent" {
    return this.socket && this.ready ? "connected" : "absent";
  }

  attach(ws: WebSocket): void {
    if (this.socket) {
      log.info({ event: "hub.replaced" }, "hub replaced");
      this.socket.close(4000, "replaced");
    }
    this.socket = ws;
    this.ready = false;
    ws.on("message", (data, isBinary) => {
      if (isBinary) return; // the hub never sends binary
      let msg: unknown;
      try {
        msg = JSON.parse(String(data));
      } catch {
        return;
      }
      const parsed = FromHub.safeParse(msg);
      if (!parsed.success) return;
      const m = parsed.data;
      if (m.type === "hello") {
        this.model = m.model;
        this.ready = m.ready;
        log.info({ event: "hub.hello", model: m.model, ready: m.ready }, "hub connected");
      } else if (m.type === "result") {
        const p = this.pending.get(m.id);
        if (!p) return;
        clearTimeout(p.timer);
        this.pending.delete(m.id);
        p.resolve(m);
      }
    });
    ws.on("close", () => {
      if (this.socket === ws) {
        this.socket = null;
        this.ready = false;
        log.info({ event: "hub.closed" }, "hub disconnected");
      }
    });
    if (this.pinger) clearInterval(this.pinger);
    this.pinger = setInterval(() => this.socket?.send(JSON.stringify({ type: "ping", t: Date.now() })), 20_000);
    this.pinger.unref();
  }

  /** Sends one photo to the hub. Resolves null on no hub, timeout or failure. */
  draft(photo: Buffer): Promise<JobResultT | null> {
    const ws = this.socket;
    if (!ws || !this.ready) return Promise.resolve(null);
    const id = randomUUID();
    const header: JobHeaderT = { type: "job", id, kind: "photo-draft", bytes: photo.length, mime: "image/jpeg" };
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        log.warn({ event: "hub.timeout", ms: this.timeoutMs }, "hub job timed out");
        resolve(null);
      }, this.timeoutMs);
      this.pending.set(id, { resolve, timer });
      ws.send(JSON.stringify(header));
      ws.send(photo, { binary: true });
    });
  }

  close(): void {
    if (this.pinger) clearInterval(this.pinger);
    this.socket?.close(1001, "server shutdown");
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.resolve(null);
    }
    this.pending.clear();
  }

  get protocol(): string {
    return HUB_PROTOCOL;
  }
}
