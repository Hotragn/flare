// Full-page screenshots of the five website pages at 390 and 1440 px, and a check that no
// page scrolls sideways. `npm run build && node apps/web/test/site/shots.ts <outdir>`. Port 8883.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { serve } from "./serve.ts";

const PAGES = ["/", "/how/", "/privacy/", "/accessibility/", "/run/"];
const out = path.resolve(process.argv[2] ?? "docs/website/screens");
fs.mkdirSync(out, { recursive: true });
const site = await serve(8883);
const browser = await chromium.launch({ channel: "chrome" });
let sideways = 0;
try {
  for (const width of [390, 1440]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    for (const p of PAGES) {
      await page.goto(site.url + p, { waitUntil: "networkidle" });
      const sw = await page.evaluate(() => document.documentElement.scrollWidth);
      if (sw > width) {
        sideways++;
        console.error(`sideways scroll on ${p} at ${width}px: ${sw}`);
      }
      const name = `${p === "/" ? "home" : p.replace(/\//g, "")}-${width}.jpg`;
      await page.screenshot({ path: path.join(out, name), fullPage: true, type: "jpeg", quality: 70 });
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  await site.close();
}
console.info(
  `${PAGES.length * 2} screenshots in ${path.relative(process.cwd(), out)}; sideways scroll on ${sideways} views`,
);
process.exit(sideways ? 1 : 0);
