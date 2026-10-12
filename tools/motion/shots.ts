// Screenshots of the app's motion moments at 390x844 (iPhone 13 class), from the /dev/moments/
// catalog. Usage: node tools/motion/shots.ts <base-url> <out-dir> [--reduce] [name=query ...]
// Each name=query pair writes <out-dir>/<name>.png after the moment settles (1.6 s).
// A query that starts with "/" is a path on the app instead of a catalog query.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const [base, out, ...rest] = process.argv.slice(2);
if (!base || !out) throw new Error("usage: shots.ts <base-url> <out-dir> [--reduce] [name=query ...]");
const reduce = rest.includes("--reduce");
const pairs = rest.filter((a) => a.includes("="));
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  reducedMotion: reduce ? "reduce" : "no-preference",
});
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("pageerror", e.message));
for (const pair of pairs) {
  const i = pair.indexOf("=");
  const name = pair.slice(0, i);
  const q = pair.slice(i + 1);
  const url = q.startsWith("/") ? `${base}${q}` : `${base}/dev/moments/?${q}`;
  await page.goto(url);
  await page.waitForTimeout(reduce ? 900 : 1800);
  await page.screenshot({ path: path.join(out, `${name}.png`) });
  console.info("wrote", name);
}
await browser.close();
