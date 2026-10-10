// Screenshots of motion states for review, in the installed Google Chrome.
// Starts `vite preview` on PORT (default 5321) if nothing is listening.
// Usage (from design/prototype, after npm run build):
//   node ../motion/shots.mjs <out-dir> "/lab/fps/?state=lit@1200" "/screens/I6/?state=lit!reduce"
// "@<ms>" waits that long before the shot (default 1200); "!reduce" turns on reduced motion;
// "%<css selector>" shoots only that element (put it last).
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const require = createRequire(path.resolve("package.json"));
const { chromium } = require("playwright-core");
const PORT = process.env.PORT ?? 5321;
const base = `http://127.0.0.1:${PORT}`;
const [out, ...urls] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });

async function up() { try { return (await fetch(base + "/")).ok; } catch { return false; } }
let server = null;
if (!(await up())) {
  server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--host", "127.0.0.1", "--strictPort"], { stdio: "ignore" });
  for (let i = 0; i < 60 && !(await up()); i++) await new Promise((r) => setTimeout(r, 250));
}
const browser = await chromium.launch({ channel: "chrome" });
let n = 0;
for (const spec of urls) {
  const reduce = spec.includes("!reduce");
  const [main, sel] = spec.replace("!reduce", "").split("%");
  const [u, wait = "1200"] = main.split("@");
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: reduce ? "reduce" : "no-preference" });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errs.push(m.text()); });
  await page.goto(base + u, { waitUntil: "networkidle" });
  await page.waitForTimeout(Number(wait));
  const file = path.join(out, `${String(++n).padStart(2, "0")}-${u.replace(/[^a-z0-9]+/gi, "_").slice(0, 60)}${reduce ? "-reduce" : ""}.png`);
  if (sel) await page.locator(sel).first().screenshot({ path: file });
  else await page.screenshot({ path: file });
  console.log(file, errs.length ? "ERRORS: " + errs.join(" | ") : "");
  await ctx.close();
}
await browser.close();
server?.kill();
