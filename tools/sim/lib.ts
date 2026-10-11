// Helpers for Virtual Fairlane (a simulation): seeded random numbers, walking routes on the
// real Fairlane footways, and a client for the real Flare server started with a test clock.
import { type ChildProcess, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { LatLon } from "@flare/shared/icd/map";
import { type Graph, nearestNode } from "../../apps/web/src/lib/map/paths.ts";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** mulberry32: small, fast, and the same numbers for the same seed on every machine. */
export function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    between: (lo: number, hi: number) => lo + (hi - lo) * next(),
    int: (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: <T>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)] as T,
    chance: (p: number) => next() < p,
    shuffle<T>(xs: T[]): T[] {
      for (let i = xs.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [xs[i], xs[j]] = [xs[j] as T, xs[i] as T];
      }
      return xs;
    },
    /** A v4-shaped UUID from the seed, so ids repeat run to run. */
    uuid() {
      const h = Array.from({ length: 16 }, () => Math.floor(next() * 256));
      h[6] = ((h[6] as number) & 0x0f) | 0x40;
      h[8] = ((h[8] as number) & 0x3f) | 0x80;
      const s = h.map((b) => b.toString(16).padStart(2, "0")).join("");
      return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
    },
  };
}
export type Rng = ReturnType<typeof rng>;

/** Nodes reachable from `start` (the main walking network, without islands). */
export function component(g: Graph, start: number): Set<number> {
  const seen = new Set<number>([start]);
  const stack = [start];
  while (stack.length) {
    const v = stack.pop() as number;
    for (const e of g.adj[v] ?? [])
      if (!seen.has(e.to)) {
        seen.add(e.to);
        stack.push(e.to);
      }
  }
  return seen;
}

/** Binary heap Dijkstra (like loop.ts), node path from src to dst; [] when unreachable. */
export function shortestPath(g: Graph, src: number, dst: number): number[] {
  if (src === dst) return [src];
  const dist = new Map<number, number>([[src, 0]]);
  const prev = new Map<number, number>();
  const heap: [number, number][] = [[0, src]];
  const push = (x: [number, number]) => {
    heap.push(x);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if ((heap[p] as [number, number])[0] <= x[0]) break;
      heap[i] = heap[p] as [number, number];
      i = p;
    }
    heap[i] = x;
  };
  const pop = (): [number, number] => {
    const top = heap[0] as [number, number];
    const last = heap.pop() as [number, number];
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      const key = (k: number) => (heap[k] as [number, number])[0];
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && key(l) < key(m)) m = l;
        if (r < heap.length && key(r) < key(m)) m = r;
        if (m === i) break;
        [heap[i], heap[m]] = [heap[m] as [number, number], heap[i] as [number, number]];
        i = m;
      }
    }
    return top;
  };
  while (heap.length) {
    const [d, v] = pop();
    if (d > (dist.get(v) ?? Number.POSITIVE_INFINITY)) continue;
    if (v === dst) break;
    for (const e of g.adj[v] ?? []) {
      const nd = d + e.m;
      if (nd < (dist.get(e.to) ?? Number.POSITIVE_INFINITY)) {
        dist.set(e.to, nd);
        prev.set(e.to, v);
        push([nd, e.to]);
      }
    }
  }
  if (!prev.has(dst)) return [];
  const out = [dst];
  while (out[out.length - 1] !== src) out.push(prev.get(out[out.length - 1] as number) as number);
  return out.reverse();
}

/** A walking route from a to b on footways and streets: a, the path nodes, b. */
export function route(g: Graph, net: Set<number>, a: LatLon, b: LatLon): LatLon[] {
  const s = snap(g, net, a);
  const t = snap(g, net, b);
  const nodes = s < 0 || t < 0 ? [] : shortestPath(g, s, t);
  return [a, ...nodes.map((n) => g.at(n)), b];
}

/** Nearest node on the main network (widening the search when needed). */
export function snap(g: Graph, net: Set<number>, p: LatLon): number {
  for (const m of [60, 150, 400, 1000]) {
    const near = g.within(p, m).filter((v) => net.has(v));
    if (near.length) {
      const n = nearestNode(g, p, m);
      return net.has(n) ? n : (near[0] as number);
    }
  }
  return -1;
}

// ---------- the real server ----------

export type Member = { id: string; token: string; name_ct: string };
export const ct = (n = 32) => randomBytes(n).toString("base64url");

export async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, () => {
      const a = s.address();
      s.close(() => (typeof a === "object" && a ? resolve(a.port) : reject(new Error("no port"))));
    });
  });
}

export class Server {
  proc: ChildProcess | null = null;
  base = "";
  writes = 0;
  reads = 0;

  async start(): Promise<void> {
    const port = await freePort();
    this.base = `http://localhost:${port}`;
    const missing = path.join(ROOT, "tools/sim/.no-env-file");
    if (fs.existsSync(missing)) throw new Error("tools/sim/.no-env-file must not exist");
    this.proc = spawn(process.execPath, ["apps/server/src/main.ts"], {
      cwd: ROOT,
      // A clean environment: no secrets from the shell, no .env file.
      env: {
        PATH: process.env.PATH ?? "",
        HOME: process.env.HOME ?? "",
        DATABASE_URL: "pglite:memory",
        FLARE_E2E_CLOCK: "1",
        PORT: String(port),
        PUBLIC_BASE_URL: this.base,
        FLARE_ENV_FILE: missing,
        HUB_SECRET: randomBytes(24).toString("base64url"),
        LOG_LEVEL: "warn",
        SENTRY_DSN: "",
      },
      stdio: ["ignore", "ignore", "inherit"],
    });
    for (let i = 0; i < 120; i++) {
      const ok = await fetch(`${this.base}/api/v1/health`).then(
        (r) => r.ok,
        () => false,
      );
      if (ok) return;
      await sleep(250);
    }
    throw new Error("server did not start");
  }

  stop(): void {
    this.proc?.kill("SIGTERM");
  }

  async call(method: string, p: string, o: { as?: Member; body?: unknown; headers?: Record<string, string> } = {}) {
    const headers: Record<string, string> = { ...(o.headers ?? {}) };
    if (o.as) headers.authorization = `Bearer ${o.as.id}.${o.as.token}`;
    if (method !== "GET") headers["idempotency-key"] = ct(12);
    if (o.body !== undefined) headers["content-type"] = "application/json";
    if (method === "GET") this.reads++;
    else this.writes++;
    const r = await fetch(`${this.base}${p}`, {
      method,
      headers,
      body: o.body === undefined ? undefined : JSON.stringify(o.body),
    });
    const text = await r.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    // biome-ignore lint/suspicious/noExplicitAny: script convenience, shapes from openapi.yaml
    return { status: r.status, body: body as any };
  }

  /** Moves the server's test clock forward; returns the server's new time (ms). */
  async advance(ms: number): Promise<number> {
    const r = await fetch(`${this.base}/__e2e/clock`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(ms > 0 ? { advance_ms: ms } : {}),
    });
    return Date.parse(((await r.json()) as { now: string }).now);
  }
}
