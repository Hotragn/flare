// `npm run hub:field` (ML4): run the hub for a field test on the Mac.
//   - keeps the Mac awake while it runs (caffeinate -i -s -m -w <this pid>; a user command, no settings change)
//   - starts apps/hub/src/main.ts (which warms the model at start and every 20 min)
//   - restarts the hub if it exits, backing off from 1 s to 30 s
//   - prints one health line every 30 s: hub, server link, Ollama, model loaded, last job
// Lives outside apps/hub/src because it spawns processes; src/ imports no child_process (ADR-0011).
// Logs carry events and timings only: never photos, words, ids or secrets.
import { type ChildProcess, spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MAIN = path.resolve(HERE, "../src/main.ts");
const OLLAMA = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
const MODEL = process.env.OLLAMA_MODEL ?? "gemma4:e4b-it-q4_K_M";
const HEALTH_MS = Number(process.env.HUB_FIELD_HEALTH_MS ?? 30_000);

const started = Date.now();
let hub: ChildProcess | null = null;
let restarts = 0;
let backoff = 1000;
let stopping = false;
let link: "connecting" | "connected" | "closed" = "connecting";
let drops = 0;
let lastJob: { kind: string; ok: boolean; ms: number; at: number } | null = null;
let warmMs: number | null = null;

const clock = () => new Date().toTimeString().slice(0, 8);
const say = (s: string) => process.stdout.write(`field ${clock()} ${s}\n`);

// Keep the Mac awake for as long as this process lives.
const awake = spawn("caffeinate", ["-i", "-s", "-m", "-w", String(process.pid)], { stdio: "ignore" });
awake.on("error", () => say("caffeinate not available: keep the lid open and power connected"));

function onHubLine(line: string) {
  const warm = line.match(/model warm in (\d+) ms/);
  if (warm) warmMs = Number(warm[1]);
  const m = line.match(/^hub: (\{.*\})$/);
  if (!m?.[1]) return;
  try {
    const e = JSON.parse(m[1]) as { event?: string; ok?: boolean; ms?: number; kind?: string };
    if (e.event === "connected") link = "connected";
    else if (e.event === "closed" || e.event === "silent") {
      if (link === "connected") drops++;
      link = "closed";
    } else if (e.event === "job")
      lastJob = { kind: e.kind ?? "photo-draft", ok: !!e.ok, ms: e.ms ?? 0, at: Date.now() };
  } catch {
    /* not an event line */
  }
}

function startHub() {
  if (stopping) return;
  link = "connecting";
  const child = spawn(process.execPath, [MAIN], { stdio: ["ignore", "pipe", "pipe"], env: process.env });
  hub = child;
  const t0 = Date.now();
  let buf = "";
  const read = (chunk: Buffer) => {
    buf += chunk.toString("utf8");
    let i = buf.indexOf("\n");
    while (i >= 0) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 1);
      onHubLine(line);
      process.stdout.write(`  ${line}\n`);
      i = buf.indexOf("\n");
    }
  };
  child.stdout?.on("data", read);
  child.stderr?.on("data", read);
  child.on("exit", (code, signal) => {
    hub = null;
    link = "closed";
    if (stopping) return;
    if (Date.now() - t0 > 60_000) backoff = 1000; // it ran fine for a while: restart fast
    restarts++;
    say(`hub exited (${signal ?? code}); restart ${restarts} in ${backoff / 1000} s`);
    setTimeout(startHub, backoff);
    backoff = Math.min(backoff * 2, 30_000);
  });
}

async function ollamaState(): Promise<{ up: boolean; loaded: boolean }> {
  try {
    const ps = (await (await fetch(`${OLLAMA}/api/ps`, { signal: AbortSignal.timeout(3000) })).json()) as {
      models?: { name: string }[];
    };
    return { up: true, loaded: !!ps.models?.some((m) => m.name === MODEL) };
  } catch {
    return { up: false, loaded: false };
  }
}

async function health() {
  const o = await ollamaState();
  const up = Math.round((Date.now() - started) / 60_000);
  const job = lastJob
    ? `${lastJob.kind} ${lastJob.ok ? "ok" : "fallback"} ${lastJob.ms} ms, ${Math.round((Date.now() - lastJob.at) / 1000)} s ago`
    : "none yet";
  say(
    [
      `up ${up} min`,
      `hub ${hub ? `running pid ${hub.pid}` : "down"}`,
      `server ${link}`,
      `drops ${drops}`,
      `restarts ${restarts}`,
      `ollama ${o.up ? "ok" : "DOWN"}`,
      `model ${o.loaded ? "loaded" : "not loaded"}`,
      `warm ${warmMs ?? "?"} ms`,
      // Over about 10 (cores) the model slows past the 6 s budget (measured 2026-10-10).
      `load ${os.loadavg()[0]?.toFixed(1)}`,
      `last job ${job}`,
    ].join(" | "),
  );
}

const stop = () => {
  stopping = true;
  say("stopping");
  hub?.kill("SIGTERM");
  awake.kill();
  setTimeout(() => process.exit(0), 500).unref();
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

say(`starting hub for the field test; health every ${HEALTH_MS / 1000} s; Ctrl-C to stop`);
startHub();
setInterval(() => void health(), HEALTH_MS);
