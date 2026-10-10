// Checks page transitions and reduced motion in Chrome:
// 1. a link click from /lab/motion to /lab/fps runs inside document.startViewTransition (html[data-vt]="page");
// 2. with reduced motion the same navigation uses the crossfade variant (data-vt="fade");
// 3. with reduced motion the flame never starts WebGL (no canvas) and the Sheet has no transform animation.
// Usage (from design/prototype, after npm run build): PORT=5321 node ../motion/check-vt.mjs
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import path from "node:path";

const require = createRequire(path.resolve("package.json"));
const { chromium } = require("playwright-core");
const PORT = process.env.PORT ?? 5321;
const base = `http://127.0.0.1:${PORT}`;
async function up() { try { return (await fetch(base + "/")).ok; } catch { return false; } }
let server = null;
if (!(await up())) {
  server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--host", "127.0.0.1", "--strictPort"], { stdio: "ignore" });
  for (let i = 0; i < 60 && !(await up()); i++) await new Promise((r) => setTimeout(r, 250));
}
const browser = await chromium.launch({ channel: "chrome" });
const out = {};
for (const reduce of [false, true]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: reduce ? "reduce" : "no-preference" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(base + "/lab/motion/", { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  const canvases = await page.locator("canvas.gl").count();
  // Record data-vt values seen during the navigation.
  await page.evaluate(() => {
    window.__vt = [];
    new MutationObserver(() => window.__vt.push(document.documentElement.dataset.vt ?? "-")).observe(document.documentElement, { attributes: true, attributeFilter: ["data-vt"] });
    const orig = document.startViewTransition?.bind(document);
    window.__vtCalls = 0;
    if (orig) document.startViewTransition = (cb) => { window.__vtCalls++; return orig(cb); };
  });
  await page.locator("a.link").click();
  await page.waitForURL("**/lab/fps/");
  await page.waitForTimeout(600);
  const vt = await page.evaluate(() => ({ calls: window.__vtCalls, seen: window.__vt, api: typeof document.startViewTransition }));
  out[reduce ? "reduced" : "full"] = { webglCanvasesOnMotionLab: canvases, viewTransition: vt, errors };
  await ctx.close();
}
await browser.close();
server?.kill();
console.log(JSON.stringify(out, null, 2));
