// JS weight per page (gzip -9 of every script the page loads), in the installed Chrome.
// Usage (from design/prototype, after npm run build): PORT=5321 node ../motion/js-weight.mjs /screens/I1/ /site/ /proto/
// Pass `reduce` as the last argument to load with reduced motion (no WebGL chunk).
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import path from "node:path";
import zlib from "node:zlib";

const require = createRequire(path.resolve("package.json"));
const { chromium } = require("playwright-core");
const PORT = process.env.PORT ?? 5321;
const base = `http://127.0.0.1:${PORT}`;
const args = process.argv.slice(2);
const reduce = args.at(-1) === "reduce";
const routes = reduce ? args.slice(0, -1) : args;
async function up() { try { return (await fetch(base + "/")).ok; } catch { return false; } }
let server = null;
if (!(await up())) {
  server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--host", "127.0.0.1", "--strictPort"], { stdio: "ignore" });
  for (let i = 0; i < 60 && !(await up()); i++) await new Promise((r) => setTimeout(r, 250));
}
const browser = await chromium.launch({ channel: "chrome" });
for (const r of routes) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: reduce ? "reduce" : "no-preference" });
  const page = await ctx.newPage();
  const js = [];
  page.on("response", async (res) => {
    if (res.request().resourceType() !== "script") return;
    try { const b = await res.body(); js.push({ url: res.url().replace(base, ""), raw: b.length, gz: zlib.gzipSync(b, { level: 9 }).length }); } catch { /* ignore */ }
  });
  await page.goto(base + r, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const gz = js.reduce((a, f) => a + f.gz, 0), raw = js.reduce((a, f) => a + f.raw, 0);
  console.log(`${r}${reduce ? " (reduced motion)" : ""}: ${js.length} scripts, ${(raw / 1024).toFixed(1)} KB raw, ${(gz / 1024).toFixed(1)} KB gzip`);
  await ctx.close();
}
await browser.close();
server?.kill();
