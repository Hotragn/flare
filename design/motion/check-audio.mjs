// Checks the sound rules in Chrome: no AudioContext before a gesture, running after the
// first tap, every file decodes, and how much silence AAC adds before each sound.
// Usage (from design/prototype, after npm run build): PORT=5321 node ../motion/check-audio.mjs
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
const page = await browser.newPage();
// Count AudioContext creations from the very start of the page.
await page.addInitScript(() => {
  window.__ctx = 0;
  const C = window.AudioContext;
  window.AudioContext = class extends C { constructor(...a) { super(...a); window.__ctx++; } };
});
await page.goto(base + "/lab/motion/", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const before = await page.evaluate(() => window.__ctx);
await page.locator("role=button[name='Press me']").click();
await page.waitForTimeout(800);
const after = await page.evaluate(() => window.__ctx);
const files = await page.evaluate(async () => {
  const ctx = new OfflineAudioContext(1, 48000, 48000);
  const out = {};
  for (const f of ["yes.wav", "lit.wav", "lit.m4a", "ember.wav", "ember.m4a", "facing.wav"]) {
    try {
      const b = await ctx.decodeAudioData(await (await fetch("/sounds/" + f)).arrayBuffer());
      const d = b.getChannelData(0);
      let first = d.findIndex((v) => Math.abs(v) > 0.001); // -60 dBFS
      let peak = 0; for (const v of d) peak = Math.max(peak, Math.abs(v));
      out[f] = { ms: +((b.duration) * 1000).toFixed(0), leadMs: +((first / b.sampleRate) * 1000).toFixed(1), peakDb: +(20 * Math.log10(peak)).toFixed(1) };
    } catch (e) { out[f] = { error: String(e) }; }
  }
  return out;
});
console.log(JSON.stringify({ audioContextsBeforeAnyTap: before, audioContextsAfterFirstTap: after, decoded: files }, null, 2));
await browser.close();
server?.kill();
