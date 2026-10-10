// Flame benchmark in the installed Google Chrome, through the Chrome DevTools Protocol.
// For each case it opens /lab/fps (which records requestAnimationFrame intervals for 10 s
// after a 1 s warm-up), with CPU throttling 1x, 4x or 6x (Emulation.setCPUThrottlingRate),
// and records fps, p50/p95/p99 frame time, dropped frames, main-thread busy share
// (Performance.getMetrics TaskDuration) and renderer and GPU process CPU (SystemInfo.getProcessInfo).
// It also measures shipped bytes of the flame code. Writes design/motion/results/bench.json.
// Usage (from design/prototype, after npm run build): PORT=5321 node ../motion/bench.mjs [--quick]
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import zlib from "node:zlib";
import os from "node:os";

const require = createRequire(path.resolve("package.json"));
const { chromium } = require("playwright-core");
const PORT = process.env.PORT ?? 5321;
const base = `http://127.0.0.1:${PORT}`;
const quick = process.argv.includes("--quick");
const OUT = path.resolve("../motion/results");
fs.mkdirSync(OUT, { recursive: true });

async function up() { try { return (await fetch(base + "/")).ok; } catch { return false; } }
let server = null;
if (!(await up())) {
  server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--host", "127.0.0.1", "--strictPort"], { stdio: "ignore" });
  for (let i = 0; i < 60 && !(await up()); i++) await new Promise((r) => setTimeout(r, 250));
}

// ---------- bytes ----------
const gz = (b) => zlib.gzipSync(b, { level: 9 }).length;
const br = (b) => zlib.brotliCompressSync(b, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }).length;
const shaderSrc = fs.readFileSync("src/lib/motion/flame-shader.ts", "utf8");
const glsl = [...shaderSrc.matchAll(/`([^`]+)`/g)].map((m) => m[1]).join("");
const chunks = fs.readdirSync("build/_app/immutable", { recursive: true }).filter((f) => f.endsWith(".js")).map((f) => path.join("build/_app/immutable", f));
const flameChunk = chunks.find((f) => fs.readFileSync(f, "utf8").includes("WEBGL_lose_context") && fs.readFileSync(f, "utf8").includes("texImage2D"));
const flameJs = flameChunk ? fs.readFileSync(flameChunk) : Buffer.alloc(0);
const bytes = {
  glsl: { raw: Buffer.byteLength(glsl), gzip: gz(Buffer.from(glsl)), brotli: br(Buffer.from(glsl)) },
  flameGlChunk: { file: flameChunk ? path.basename(flameChunk) : null, raw: flameJs.length, gzip: gz(flameJs), brotli: br(flameJs), note: "lazy chunk: shader + renderer + mask builder + tween code; loaded only when WebGL is used" },
};

// ---------- frames ----------
const cases = [];
for (const throttle of quick ? [1, 6] : [1, 4, 6])
  for (const mode of ["webgl", "css"])
    for (const state of ["lit", "cycle"]) cases.push({ mode, state, n: 1, throttle });
for (const mode of ["webgl", "css"]) cases.push({ mode, state: "lit", n: 4, throttle: 6 });

const browser = await chromium.launch({ channel: "chrome" });
const bcdp = await browser.newBrowserCDPSession();
async function cpu() {
  const { processInfo } = await bcdp.send("SystemInfo.getProcessInfo");
  const sum = (t) => processInfo.filter((p) => p.type === t).reduce((a, p) => a + p.cpuTime, 0);
  return { renderer: sum("renderer"), gpu: sum("GPU") };
}
const results = [];
let gpuName = "";
for (const c of cases) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Performance.enable");
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: c.throttle });
  await page.goto(`${base}/lab/fps/?mode=${c.mode}&state=${c.state}&n=${c.n}&dpr=2&auto=10`, { waitUntil: "load" });
  await page.waitForTimeout(1000);
  const m0 = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));
  const c0 = await cpu();
  const t0 = Date.now();
  await page.waitForFunction(() => window.__fpsResult, null, { timeout: 60000, polling: 500 });
  const wall = (Date.now() - t0) / 1000;
  const m1 = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));
  const c1 = await cpu();
  const r = await page.evaluate(() => window.__fpsResult);
  if (!gpuName) gpuName = await page.evaluate(() => document.querySelector(".facts li:nth-child(2)")?.textContent ?? "");
  const row = {
    ...c, renderers: Object.values(r.renderers).join("/"), fps: r.fps, p50: r.p50, p95: r.p95, p99: r.p99, dropped: `${r.dropped}/${r.frames}`,
    hz: r.refreshHz, drawMs: r.drawMs, mainBusyPct: +((100 * (m1.TaskDuration - m0.TaskDuration)) / wall).toFixed(1),
    scriptPct: +((100 * (m1.ScriptDuration - m0.ScriptDuration)) / wall).toFixed(1),
    rendererCpuPct: +((100 * (c1.renderer - c0.renderer)) / wall).toFixed(1), gpuCpuPct: +((100 * (c1.gpu - c0.gpu)) / wall).toFixed(1),
    maskMs: r.maskMs, downgrades: r.downgrades,
  };
  results.push(row);
  console.log(JSON.stringify(row));
  await ctx.close();
}
await browser.close();
server?.kill();

const env = { date: new Date().toISOString(), cpu: os.cpus()[0]?.model, cores: os.cpus().length, os: `${os.type()} ${os.release()}`, chrome: browser.version(), gpu: gpuName, viewport: "390 x 844 at deviceScaleFactor 3, flame DPR cap 2", headless: true };
fs.writeFileSync(path.join(OUT, "bench.json"), JSON.stringify({ env, bytes, results }, null, 2) + "\n");
console.log(JSON.stringify({ env, bytes }, null, 2));
