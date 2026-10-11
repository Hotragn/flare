// Hub relay (ADR-0006). The Mac hub opens an outbound WebSocket to /hub with a shared
// secret; the server sends photo jobs over it and waits for the JSON result.
// The photo exists only in memory on both ends and is never written to disk or logs.
import { randomUUID, timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { FromHub, HUB_PROTOCOL, type JobHeaderT, type JobResultT } from "@flare/shared";
import type { WebSocket } from "ws";
import { log } from "../log.ts";

/** A parsed hub result; `ladder` is validated by the shared schema (ICR-BE-1). */
export type RelayResult = JobResultT;
type Pending = { resolve: (r: RelayResult | null) => void; timer: NodeJS.Timeout };

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

  private lastHeard = 0;
  private readonly timeoutMs: number;
  private readonly pingMs: number;
  private readonly deadAfterMs: number;

  /**
   * @param timeoutMs per-job budget (BR-AI-1: 6 s for photos)
   * @param opts.pingMs heartbeat interval; the hub must answer something within 2.5 pings or
   *   the socket is dropped (spike E1: a silent half-open socket otherwise stays "connected")
   */
  constructor(timeoutMs: number, opts: { pingMs?: number } = {}) {
    this.timeoutMs = timeoutMs;
    this.pingMs = opts.pingMs ?? 5_000;
    this.deadAfterMs = Math.round(this.pingMs * 2.5);
  }

  get status(): "connected" | "absent" {
    return this.socket && this.ready ? "connected" : "absent";
  }

  attach(ws: WebSocket): void {
    if (this.socket) {
      log.info({ event: "hub.replaced" }, "hub replaced");
      this.socket.close(4000, "replaced");
      this.failPending();
    }
    this.socket = ws;
    this.ready = false;
    this.lastHeard = Date.now();
    ws.on("message", (data, isBinary) => {
      this.lastHeard = Date.now();
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
        // Jobs sent on this socket can't come back: answer them now with the template
        // instead of waiting out the 6 s budget (spike E1, reset case).
        this.failPending();
        log.info({ event: "hub.closed" }, "hub disconnected");
      }
    });
    ws.on("error", () => {}); // close follows
    if (this.pinger) clearInterval(this.pinger);
    this.pinger = setInterval(() => {
      const sock = this.socket;
      if (!sock) return;
      if (Date.now() - this.lastHeard > this.deadAfterMs) {
        log.warn({ event: "hub.silent", ms: Date.now() - this.lastHeard }, "hub silent, dropping socket");
        sock.terminate(); // fires close: status absent, pending answered
        return;
      }
      sock.send(JSON.stringify({ type: "ping", t: Date.now() }));
    }, this.pingMs);
    this.pinger.unref();
  }

  /** Sends one photo to the hub. Resolves null on no hub, timeout or failure. */
  draft(photo: Buffer): Promise<RelayResult | null> {
    const id = randomUUID();
    const header: JobHeaderT = { type: "job", id, kind: "photo-draft", bytes: photo.length, mime: "image/jpeg" };
    return this.send(id, JSON.stringify(header), photo, this.timeoutMs);
  }

  /**
   * Sends a Plan ladder job (asyncapi ladderJob; text only, nothing stored). Resolves null on
   * no hub, timeout (ADR-0007: 8 s) or failure.
   */
  ladder(
    req: { ask: string; total_minutes: number; weather?: { rain_likely: boolean; temp_f: number } },
    timeoutMs: number,
  ): Promise<RelayResult | null> {
    const id = randomUUID();
    const job: Record<string, unknown> = {
      type: "job",
      id,
      kind: "ladder-draft",
      ask: req.ask,
      total_minutes: req.total_minutes,
    };
    if (req.weather) job.weather = req.weather;
    return this.send(id, JSON.stringify(job), null, timeoutMs);
  }

  private send(id: string, header: string, bytes: Buffer | null, timeoutMs: number): Promise<RelayResult | null> {
    const ws = this.socket;
    if (!ws || !this.ready) return Promise.resolve(null);
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        log.warn({ event: "hub.timeout", ms: timeoutMs }, "hub job timed out");
        resolve(null);
        this.probe(ws);
      }, timeoutMs);
      this.pending.set(id, { resolve, timer });
      ws.send(header);
      if (bytes) ws.send(bytes, { binary: true });
    });
  }

  /** After a timeout, ping now; if the hub says nothing within 3 s, drop the socket so
   * health turns absent and later drafts go straight to the template (spike E1). */
  private probe(ws: WebSocket): void {
    if (this.socket !== ws) return;
    const asked = Date.now();
    ws.send(JSON.stringify({ type: "ping", t: asked }));
    setTimeout(() => {
      if (this.socket === ws && this.lastHeard < asked) {
        log.warn({ event: "hub.silent", after: "timeout" }, "hub silent after a timeout, dropping socket");
        ws.terminate();
      }
    }, 3000).unref();
  }

  private failPending(): void {
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.resolve(null);
    }
    this.pending.clear();
  }

  close(): void {
    if (this.pinger) clearInterval(this.pinger);
    this.socket?.close(1001, "server shutdown");
    this.failPending();
  }

  get protocol(): string {
    return HUB_PROTOCOL;
  }
}
