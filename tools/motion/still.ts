// Reduced motion check: with prefers-reduced-motion and with the app's setting ([data-reduce-motion]), every catalog
// screen must be still once it has settled: no running CSS or Web Animations, no WebGL flame canvas.
// Usage: node tools/motion/still.ts <base-url>   (exit 1 on any moving screen)
import { chromium } from "playwright-core";

const base = process.argv[2];
if (!base) throw new Error("usage: still.ts <base-url>");
const screens = [
  "s=H0&rain=1&wind=20",
  "s=H5&have=2",
  "s=I1&have=2",
  "s=H6",
  "s=I6",
  "s=I6&view=smaller",
  "s=I9",
  "s=I10",
  "s=I12",
  "s=crew&wind=20",
];
const browser = await chromium.launch({ channel: "chrome" });
let bad = 0;
for (const mode of ["os", "attr"] as const) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: mode === "os" ? "reduce" : "no-preference",
  });
  // The app's own Reduce motion setting: the root layout sets [data-reduce-motion] from it.
  if (mode === "attr") await ctx.addInitScript(() => localStorage.setItem("flare.motion", "reduce"));
  const page = await ctx.newPage();
  for (const q of screens) {
    await page.goto(`${base}/dev/components/?${q}`);
    await page.waitForFunction(() => document.documentElement.dataset.ready === "1");
    await page.waitForTimeout(800);
    if (q.startsWith("s=H5") || q.startsWith("s=I1")) await page.evaluate("flareDev.set({have:3})");
    await page.waitForTimeout(1500);
    const r = await page.evaluate(() => ({
      running: document.getAnimations().filter((a) => a.playState === "running").length,
      canvas: document.querySelectorAll("canvas").length,
    }));
    const ok = r.running === 0 && r.canvas === 0;
    if (!ok) bad++;
    console.info(`${ok ? "STILL" : "MOVES"} [${mode}] ${q}: ${r.running} running animations, ${r.canvas} canvas`);
  }
  await ctx.close();
}
await browser.close();
process.exit(bad ? 1 : 0);
