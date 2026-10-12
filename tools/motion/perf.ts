// Performance of the app's motion moments on an iPhone-13-class budget: Chrome (Playwright) at
// 390x844, 4x CPU throttle, on the built app (apps/web/build). For each moment it counts frames
// with requestAnimationFrame while the moment plays, frames dropped against 60 fps, and long tasks
// (over 50 ms, PerformanceObserver). It also saves a Chrome trace of the demo run.
// Usage: npm run build -w apps/web && node tools/motion/perf.ts [trace-out.json]
import fs from "node:fs";
import { chromium, type Page } from "playwright-core";
import { serve } from "../../apps/web/test/site/serve.ts";

const site = await serve(8893, () => null);
const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
page.on("pageerror", (e) => console.error("pageerror", e.message));

/** Measure frames and long tasks for `ms` after `act` runs. */
async function measure(name: string, act: () => Promise<unknown>, ms = 1600) {
  await page.evaluate(() => {
    const w = window as unknown as { __perf: { t: number[]; long: number[] } };
    w.__perf = { t: [], long: [] };
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) w.__perf.long.push(e.duration);
    }).observe({ type: "longtask", buffered: false });
    const loop = (t: number) => {
      w.__perf.t.push(t);
      if (w.__perf.t.length < 2000) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  await act();
  await page.waitForTimeout(ms);
  const r = await page.evaluate(() => {
    const w = window as unknown as { __perf: { t: number[]; long: number[] } };
    const t = w.__perf.t;
    w.__perf.t = new Array(2000);
    return { t, long: w.__perf.long };
  });
  const span = (r.t[r.t.length - 1] ?? 0) - (r.t[0] ?? 0);
  let dropped = 0;
  let worst = 0;
  for (let i = 1; i < r.t.length; i++) {
    const dt = (r.t[i] ?? 0) - (r.t[i - 1] ?? 0);
    worst = Math.max(worst, dt);
    dropped += Math.max(0, Math.round(dt / 16.67) - 1);
  }
  if (process.env.GAPS) {
    const gaps = r.t.flatMap((t, i) =>
      i && t - (r.t[i - 1] ?? 0) > 40
        ? [`${Math.round((r.t[i - 1] ?? 0) - (r.t[0] ?? 0))}+${Math.round(t - (r.t[i - 1] ?? 0))}`]
        : [],
    );
    console.info(name, "gaps(ms at+len):", gaps.join(" "));
  }
  const fps = span ? ((r.t.length - 1) * 1000) / span : 0;
  const row = {
    moment: name,
    fps: Math.round(fps * 10) / 10,
    frames: r.t.length - 1,
    dropped,
    worstFrameMs: Math.round(worst),
    longTasks: r.long.length,
    longestTaskMs: Math.round(Math.max(0, ...r.long)),
  };
  console.info(JSON.stringify(row));
  return row;
}

async function catalog(q: string) {
  await page.goto(`${site.url}/dev/components/?${q}`);
  await page.waitForFunction(() => document.documentElement.dataset.ready === "1");
  await page.waitForTimeout(1500);
}
const set = (p: Page, js: string) => () => p.evaluate(js);

const rows = [];
// The demo, start to the shrink and the catch at the bench, with a Chrome trace.
const traceOut = process.argv[2];
if (traceOut) await browser.startTracing(page, { path: traceOut, screenshots: false });
await page.goto(`${site.url}/app/demo/`);
await page.getByRole("button", { name: "Send it" }).click();
await page.getByRole("button", { name: "Friend's view" }).click();
rows.push(
  await measure(
    "demo: friend's I'm in (I1 count ring)",
    () => page.getByRole("button", { name: "I'm in" }).click(),
    1200,
  ),
);
await page.getByRole("button", { name: "Back to you" }).click();
await page.getByRole("button", { name: "Skip 30 min" }).waitFor();
await page.waitForTimeout(800);
rows.push(
  await measure(
    "demo: shrink to an Ember, lit at the bench (I6)",
    () => page.getByRole("button", { name: "Skip 30 min" }).click(),
    3200,
  ),
);
if (traceOut) await browser.stopTracing();

await catalog("s=H5&have=1&quorum=4");
rows.push(await measure("yes spark feeds the flame (H5)", set(page, "flareDev.set({have:2})"), 1300));
await catalog("s=I1&have=1&quorum=4");
rows.push(await measure("yes spark on the invite (I1)", set(page, "flareDev.set({have:2})"), 1300));
await catalog("s=I6");
rows.push(await measure("it's lit: ignition (I6)", set(page, "flareDev.remount()"), 1400));
await catalog("s=H6");
rows.push(await measure("it's lit: host (H6)", set(page, "flareDev.remount()"), 1400));
await catalog("s=I9");
rows.push(await measure("shrink to an Ember (I9)", set(page, "flareDev.remount()"), 1400));
await catalog("s=I12");
rows.push(await measure("gone: ember cools, minutes count up (I12)", set(page, "flareDev.remount()"), 1400));
await catalog("s=I10");
rows.push(await measure("gone: not this time (I10)", set(page, "flareDev.remount()"), 1400));
await catalog("s=crew&wind=20");
rows.push(await measure("crew scene, ambient (wind)", async () => {}, 2000));
await catalog("s=H0&rain=1&wind=20");
rows.push(await measure("home sky, rain and wind (ambient)", async () => {}, 2000));

await browser.close();
await site.close();
fs.writeFileSync(new URL("./perf-last.json", import.meta.url), `${JSON.stringify(rows, null, 2)}\n`);
