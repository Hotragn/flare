// Runs axe-core (WCAG 2.2 A/AA rules) on every screen state and theme, the website,
// the prototype and the component catalog, in the installed Chrome.
// Writes ../exports/a11y-report.json and exits 1 on any serious or critical issue.
// Usage: npm run build && npm run a11y
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const AXE = require.resolve("axe-core/axe.min.js");
const PORT = String(process.env.PORT ?? 5318);
const base = `http://127.0.0.1:${PORT}`;
async function up() { try { return (await fetch(base + "/screens/manifest.json")).ok; } catch { return false; } }
const server = spawn("npx", ["vite", "preview", "--port", PORT, "--host", "127.0.0.1", "--strictPort"], { cwd: ROOT, stdio: "ignore" });
for (let i = 0; i < 60 && !(await up()); i++) await new Promise((r) => setTimeout(r, 250));
const manifest = await (await fetch(base + "/screens/manifest.json")).json();

const targets = [];
for (const s of manifest) for (const st of s.states) for (const th of s.themes) targets.push({ name: `${s.id}-${st}-${th}`, url: `/screens/${s.id}/?state=${st}&theme=${th}&reduce=1`, w: 390, h: 844 });
targets.push({ name: "site-mobile", url: "/site/", w: 390, h: 844 }, { name: "site-desktop", url: "/site/", w: 1440, h: 900 }, { name: "prototype", url: "/proto/", w: 1280, h: 960 }, { name: "components", url: "/components/", w: 1280, h: 900 });

const browser = await chromium.launch({ channel: "chrome" });
const results = [];
for (const t of targets) {
  const ctx = await browser.newContext({ viewport: { width: t.w, height: t.h }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto(base + t.url, { waitUntil: "networkidle" });
  await page.waitForTimeout(120);
  await page.addScriptTag({ path: AXE });
  const r = await page.evaluate(async () => {
    // @ts-ignore axe is injected
    const res = await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] } });
    return res.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, sample: v.nodes[0]?.target?.join(" ") }));
  });
  results.push({ target: t.name, violations: r });
  await ctx.close();
}
await browser.close();
server.kill();

const all = results.flatMap((r) => r.violations.map((v) => ({ ...v, target: r.target })));
const bad = all.filter((v) => v.impact === "serious" || v.impact === "critical");
const byRule = {};
for (const v of all) { byRule[v.id] ??= { impact: v.impact, help: v.help, targets: 0, sample: `${v.target}: ${v.sample}` }; byRule[v.id].targets++; }
fs.writeFileSync(path.resolve(ROOT, "../exports/a11y-report.json"), JSON.stringify({ checked: targets.length, date: new Date().toISOString(), byRule, results }, null, 2));
console.log(`Checked ${targets.length} pages and screen states.`);
console.log(`Violations: ${all.length} (serious or critical: ${bad.length})`);
for (const [id, v] of Object.entries(byRule)) console.log(` - ${v.impact.padEnd(8)} ${id} on ${v.targets} targets: ${v.help} [${v.sample}]`);
process.exit(bad.length ? 1 : 0);
