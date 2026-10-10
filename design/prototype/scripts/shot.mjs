// Screenshot one or more prototype paths with the installed Chrome.
// Usage: node scripts/shot.mjs <out.png> <path> [width] [height] [scale]
// Starts `vite preview` on the built site if nothing is listening on 5318.
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";

const [out, route = "/", w = "390", h = "844", scale = "2"] = process.argv.slice(2);
const base = "http://127.0.0.1:5318";
async function up() { try { const r = await fetch(base + "/"); return r.ok || r.status === 404; } catch { return false; } }
let server;
if (!(await up())) {
  server = spawn("npx", ["vite", "preview", "--port", "5318", "--host", "127.0.0.1", "--strictPort"], { stdio: "ignore" });
  for (let i = 0; i < 50 && !(await up()); i++) await new Promise((r) => setTimeout(r, 200));
}
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: +scale });
await page.goto(base + route, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await page.screenshot({ path: out });
await browser.close();
server?.kill();
console.log("saved", out);
