// axe-core (WCAG 2.2 A/AA + best practice) on the motion test pages, with and without reduced motion.
// Usage (from design/prototype, after npm run build): PORT=5321 node ../motion/axe-lab.mjs
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import path from "node:path";

const require = createRequire(path.resolve("package.json"));
const { chromium } = require("playwright-core");
const AXE = require.resolve("axe-core/axe.min.js");
const PORT = process.env.PORT ?? 5321;
const base = `http://127.0.0.1:${PORT}`;
async function up() { try { return (await fetch(base + "/")).ok; } catch { return false; } }
let server = null;
if (!(await up())) {
  server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--host", "127.0.0.1", "--strictPort"], { stdio: "ignore" });
  for (let i = 0; i < 60 && !(await up()); i++) await new Promise((r) => setTimeout(r, 250));
}
const browser = await chromium.launch({ channel: "chrome" });
let total = 0;
for (const reduce of [false, true]) for (const r of ["/lab/", "/lab/fps/", "/lab/haptics/", "/lab/motion/"]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: reduce ? "reduce" : "no-preference" });
  const page = await ctx.newPage();
  await page.goto(base + r, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000); // let develops, catches and fades finish
  await page.addScriptTag({ path: AXE });
  const v = await page.evaluate(async () => (await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] } })).violations.map((x) => `${x.impact} ${x.id} (${x.nodes.length}): ${x.nodes[0]?.target?.join(" ")}`));
  total += v.length;
  console.log(`${r}${reduce ? " reduced" : ""}: ${v.length} violations${v.length ? "\n  " + v.join("\n  ") : ""}`);
  await ctx.close();
}
await browser.close();
server?.kill();
process.exit(total ? 1 : 0);
