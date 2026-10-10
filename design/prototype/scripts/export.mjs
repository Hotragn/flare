// Exports hi-fi PNGs of every screen, state and theme, plus a wireframe of each
// screen, using the installed Chrome. Output: ../exports/screens, ../exports/wireframes.
// Usage: npm run build && npm run export [-- --only H1,H2]
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.resolve(ROOT, "../exports");
const base = "http://127.0.0.1:5318";
const only = (process.argv.find((a) => a.startsWith("--only=")) ?? "").slice(7).split(",").filter(Boolean);

async function up() { try { const r = await fetch(base + "/screens/manifest.json"); return r.ok; } catch { return false; } }
const server = spawn("npx", ["vite", "preview", "--port", "5318", "--host", "127.0.0.1", "--strictPort"], { cwd: ROOT, stdio: "ignore" });
for (let i = 0; i < 60 && !(await up()); i++) await new Promise((r) => setTimeout(r, 250));
const manifest = await (await fetch(base + "/screens/manifest.json")).json();

fs.mkdirSync(path.join(OUT, "screens"), { recursive: true });
fs.mkdirSync(path.join(OUT, "wireframes"), { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: "reduce" });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

let n = 0;
for (const s of manifest) {
  if (only.length && !only.includes(s.id)) continue;
  for (const state of s.states) {
    for (const theme of s.themes) {
      await page.goto(`${base}/screens/${s.id}/?state=${state}&theme=${theme}&reduce=1`, { waitUntil: "networkidle" });
      await page.waitForTimeout(150);
      await page.screenshot({ path: path.join(OUT, "screens", `${s.id}-${state}-${theme}.png`) });
      n++;
    }
  }
  await page.goto(`${base}/screens/${s.id}/?state=${s.states[0]}&theme=light&wire=1&reduce=1`, { waitUntil: "networkidle" });
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(OUT, "wireframes", `${s.id}.png`) });
}
await browser.close();
server.kill();
console.log(`Exported ${n} screens and ${manifest.filter((s) => !only.length || only.includes(s.id)).length} wireframes.`);
if (errors.length) { console.error("Page errors:\n" + [...new Set(errors)].join("\n")); process.exit(1); }
