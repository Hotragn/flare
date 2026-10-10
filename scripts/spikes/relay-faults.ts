// Spike E1: the hub relay over a real WebSocket under latency, packet loss, resets and
// silent drops. Runs the real server and the real hub as child processes; a TCP proxy
// between them injects faults on the hub leg only. Ollama is faked (fixed 300 ms) so
// the numbers measure the relay, not the model.
//
// TCP never shows packet loss to the app: lost segments are resent, so loss appears as
// stalls. The proxy models a loss rate p by holding each chunk, with probability p, for
// one retransmission timeout (200 to 1000 ms, RFC 6298's 1 s minimum is often tuned
// down to 200 ms on Linux and macOS).
//
// Usage: node scripts/spikes/relay-faults.ts [--seconds 40] [--out file.json]
import { type ChildProcess, spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const arg = (k: string, d: string) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? (process.argv[i + 1] ?? d) : d;
};
const SECONDS = Number(arg("seconds", "60"));
const OUT = arg("out", "");
const ONLY = arg("only", "");
const JPEG = fs.readFileSync(path.join(ROOT, "scripts/fixtures/pond-illustration.jpg"));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let seed = 42;
const rand = () => {
  seed = (seed * 1103515245 + 12345) % 2 ** 31;
  return seed / 2 ** 31;
};

// Fake Ollama: 300 ms per answer.
const ollama = http.createServer((req, res) => {
  req.resume();
  req.on("end", () => {
    res.setHeader("content-type", "application/json");
    if (req.url === "/api/tags") return res.end(JSON.stringify({ models: [{ name: "fake-model" }] }));
    setTimeout(
      () =>
        res.end(
          JSON.stringify({
            message: { content: '{"invite":"Bench by the pond","alt":"A bench beside a calm pond."}' },
          }),
        ),
      300,
    );
  });
});

type Fault = { latencyMs?: number; jitterMs?: number; loss?: number };
class FaultProxy {
  fault: Fault = {};
  private conns = new Set<{ a: net.Socket; b: net.Socket; dead: boolean }>();
  accepted = 0;
  server: net.Server;
  private upstreamPort: number;
  constructor(upstreamPort: number) {
    this.upstreamPort = upstreamPort;
    this.server = net.createServer((a) => {
      this.accepted++;
      const b = net.connect(this.upstreamPort, "127.0.0.1");
      const c = { a, b, dead: false };
      this.conns.add(c);
      this.pipe(a, b, c);
      this.pipe(b, a, c);
      // A dead (black-holed) link carries nothing, closes included: each side only learns
      // the other is gone from its own timers, as on a real half-open TCP connection.
      const end = (side: net.Socket) => () => {
        this.conns.delete(c);
        if (c.dead) side.destroy();
        else {
          a.destroy();
          b.destroy();
        }
      };
      a.on("close", end(a)).on("error", end(a));
      b.on("close", end(b)).on("error", end(b));
    });
  }
  // Each chunk is released at max(previous release, arrival + latency + jitter + stall), so
  // latency is pipelined like a real link, and a loss stall blocks what follows it
  // (TCP head-of-line blocking).
  private pipe(from: net.Socket, to: net.Socket, c: { dead: boolean }) {
    // One ordered queue per direction with one timer, so bytes can never be reordered
    // (separate timers per chunk can fire out of order and corrupt the stream).
    const queue: { at: number; chunk: Buffer }[] = [];
    let timer: NodeJS.Timeout | null = null;
    const pump = () => {
      timer = null;
      while (queue.length && (queue[0]?.at ?? 0) <= Date.now()) {
        const item = queue.shift();
        if (item && !c.dead && !to.destroyed) to.write(item.chunk);
      }
      if (queue.length) timer = setTimeout(pump, Math.max(0, (queue[0]?.at ?? 0) - Date.now()));
    };
    from.on("data", (chunk: Buffer) => {
      if (c.dead) return; // black hole: swallow, never close
      const f = this.fault;
      let wait = (f.latencyMs ?? 0) + (f.jitterMs ? rand() * f.jitterMs : 0);
      if (f.loss && rand() < f.loss) wait += 200 + rand() * 800;
      const last = queue.at(-1)?.at ?? 0;
      queue.push({ at: Math.max(last, Date.now() + wait), chunk });
      if (!timer) pump();
    });
  }

  listen = () =>
    new Promise<number>((r) =>
      this.server.listen(0, "127.0.0.1", () => r((this.server.address() as net.AddressInfo).port)),
    );
  /** Abrupt reset of every open connection (like a NAT rebinding or Wi-Fi to cellular switch). */
  reset() {
    for (const c of this.conns) {
      c.a.resetAndDestroy();
      c.b.resetAndDestroy();
    }
  }
  /** Silent drop: open connections stop carrying bytes but are never closed (half-open). */
  brokeAt: number | null = null;
  blackhole() {
    for (const c of this.conns) c.dead = true;
    this.brokeAt = Date.now();
  }
}

function start(name: string, file: string, env: Record<string, string>, lines: string[]): ChildProcess {
  const p = spawn(process.execPath, [file], {
    cwd: ROOT,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const take = (b: Buffer) => {
    for (const l of b.toString().split("\n")) if (l.trim()) lines.push(`${Date.now()} ${name} ${l}`);
  };
  p.stdout?.on("data", take);
  p.stderr?.on("data", take);
  return p;
}

type Sample = { t: number; ms: number; tier: string };
async function scenario(label: string, setup: (p: FaultProxy, t: number) => void) {
  const port = 8900 + Math.floor(rand() * 90);
  const lines: string[] = [];
  const server = start(
    "server",
    "apps/server/src/main.ts",
    { PORT: String(port), DATABASE_URL: "", LOG_LEVEL: "info" },
    lines,
  );
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 60; i++) {
    if (
      await fetch(`${base}/api/v1/health`).then(
        (r) => r.ok,
        () => false,
      )
    )
      break;
    await sleep(250);
  }
  const proxy = new FaultProxy(port);
  const pport = await proxy.listen();
  const hub = start(
    "hub",
    "apps/hub/src/main.ts",
    {
      FLARE_SERVER_URL: `ws://127.0.0.1:${pport}`,
      OLLAMA_URL: `http://127.0.0.1:${(ollama.address() as net.AddressInfo).port}`,
      OLLAMA_MODEL: "fake-model",
    },
    lines,
  );
  for (let i = 0; i < 60; i++) {
    const h = await fetch(`${base}/api/v1/health`).then((r) => r.json() as Promise<{ hub: string }>);
    if (h.hub === "connected") break;
    await sleep(250);
  }
  const t0 = Date.now();
  const samples: Sample[] = [];
  const health: { t: number; hub: string }[] = [];
  const healthTimer = setInterval(async () => {
    const h = await fetch(`${base}/api/v1/health`).then(
      (r) => r.json() as Promise<{ hub: string }>,
      () => ({ hub: "down" }),
    );
    health.push({ t: Date.now() - t0, hub: h.hub });
  }, 500);
  const events: { t: number; what: string }[] = [];
  const mark = (what: string) => events.push({ t: Date.now() - t0, what });
  const tick = setInterval(() => setup(proxy, Date.now() - t0), 100);
  const inflight: Promise<void>[] = [];
  for (let s = 0; s < SECONDS; s++) {
    inflight.push(
      (async () => {
        const t = Date.now();
        const r = await fetch(`${base}/api/v1/drafts`, {
          method: "POST",
          headers: { "content-type": "image/jpeg" },
          body: JPEG,
        });
        const j = (await r.json()) as { tier: string };
        samples.push({ t: t - t0, ms: Date.now() - t, tier: j.tier });
      })(),
    );
    await sleep(1000);
  }
  await Promise.all(inflight);
  clearInterval(tick);
  clearInterval(healthTimer);
  hub.kill("SIGTERM");
  server.kill("SIGTERM");
  proxy.server.close();
  await sleep(300);
  const ms = samples.map((s) => s.ms).sort((a, b) => a - b);
  const q = (p: number) => ms[Math.min(ms.length - 1, Math.floor(p * ms.length))] ?? 0;
  const hubConnects = lines
    .filter((l) => l.includes(" hub ") && l.includes('"event":"connected"'))
    .map((l) => Number(l.split(" ")[0]) - t0);
  // Silent-drop case: how long health still said "connected", and how long until the hub was back.
  const breakAt = proxy.brokeAt === null ? null : proxy.brokeAt - t0;
  const backAt =
    breakAt === null ? Number.POSITIVE_INFINITY : (hubConnects.find((c) => c > breakAt) ?? Number.POSITIVE_INFINITY);
  const result = {
    label,
    drafts: samples.length,
    hubTier: samples.filter((s) => s.tier === "hub").length,
    p50: q(0.5),
    p95: q(0.95),
    max: ms.at(-1) ?? 0,
    hubConnectsDuringRun: hubConnects.filter((t) => t >= 0).map((t) => Math.round(t / 100) / 10),
    proxyConnections: proxy.accepted,
    healthLiedSeconds:
      breakAt === null ? 0 : health.filter((h) => h.t >= breakAt && h.t < backAt && h.hub === "connected").length / 2,
    recoveredAfterSeconds:
      breakAt === null
        ? null
        : backAt === Number.POSITIVE_INFINITY
          ? "never in run"
          : Math.round((backAt - breakAt) / 100) / 10,
    samples,
    health,
    events,
  };
  return { result, mark, lines };
}

await new Promise<void>((r) => ollama.listen(0, "127.0.0.1", () => r()));
const results: Awaited<ReturnType<typeof scenario>>["result"][] = [];
const run = async (label: string, setup: (p: FaultProxy, t: number) => void) => {
  if (ONLY && !label.includes(ONLY)) return;
  const { result } = await scenario(label, setup);
  results.push(result);
  const { samples, health, events, ...summary } = result;
  console.log(JSON.stringify(summary));
};

await run("baseline", () => {});
await run("latency 150 ms + 50 ms jitter each way", (p) => {
  p.fault = { latencyMs: 150, jitterMs: 50 };
});
await run("loss 5% (stalls 0.2-1 s)", (p) => {
  p.fault = { latencyMs: 50, loss: 0.05 };
});
await run("loss 15% (stalls 0.2-1 s)", (p) => {
  p.fault = { latencyMs: 50, loss: 0.15 };
});
let lastReset = 0;
await run("reset every 10 s", (p, t) => {
  if (t - lastReset >= 10_000) {
    lastReset = t;
    p.reset();
  }
});
lastReset = 0;
let holed = false;
await run("silent drop (half-open) at 10 s", (p, t) => {
  if (!holed && t >= 10_000) {
    holed = true;
    p.blackhole();
  }
});
holed = false;
ollama.close();
if (OUT) fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
process.exit(0);
