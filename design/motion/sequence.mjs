// Captures frames of one interaction at set times, to check the motion spec by eye.
// Usage (from design/prototype, after npm run build):
//   node ../motion/sequence.mjs <out-dir> <name> <url> <click-selector> <shot-selector> <ms,ms,...> [reduce]
// Example: node ../motion/sequence.mjs out catch "/lab/motion/" "text=Yes +1" ".hearth" 0,120,240,480,900
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const require = createRequire(path.resolve("package.json"));
const { chromium } = require("playwright-core");
const PORT = process.env.PORT ?? 5321;
const base = `http://127.0.0.1:${PORT}`;
const [out, name, url, click, shot, times, reduce] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
async function up() { try { return (await fetch(base + "/")).ok; } catch { return false; } }
let server = null;
if (!(await up())) {
  server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--host", "127.0.0.1", "--strictPort"], { stdio: "ignore" });
  for (let i = 0; i < 60 && !(await up()); i++) await new Promise((r) => setTimeout(r, 250));
}
const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: Number(process.env.VW ?? 390), height: Number(process.env.VH ?? 844) }, deviceScaleFactor: 2, reducedMotion: reduce ? "reduce" : "no-preference" });
const page = await ctx.newPage();
await page.goto(base + url, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
const target = page.locator(shot).first();
await target.scrollIntoViewIfNeeded();
const clicks = click.split("|");
for (const c of clicks.slice(0, -1)) { await page.locator(c).first().click(); await page.waitForTimeout(900); }
const ts = times.split(",").map(Number);
const t0 = Date.now();
await page.locator(clicks.at(-1)).first().click();
for (const t of ts) {
  const wait = t - (Date.now() - t0);
  if (wait > 0) await page.waitForTimeout(wait);
  const at = Date.now() - t0;
  await target.screenshot({ path: path.join(out, `${name}-${String(t).padStart(4, "0")}ms.png`), animations: "allow" });
  console.log(`${name} planned ${t} ms, shot at ${at} ms`);
}
await browser.close();
server?.kill();
