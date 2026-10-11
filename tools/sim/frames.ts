// Renders PNG frames of a Virtual Fairlane replay (a simulation) with Playwright and Chrome,
// from the real /sim/ page on the Vite dev server: docs/post/media/sim/seed-<seed>/frame-NNN.png.
// Usage: npm run sim:frames -- [--seed 42] [--frames 60] [--width 600] [--height 600]
// Turn into a GIF, for example: ffmpeg -framerate 10 -i frame-%03d.png -vf "split[a][b];[a]palettegen[p];[b][p]paletteuse" sim.gif
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { freePort, ROOT, sleep } from "./lib.ts";

const arg = (name: string, def: number) => {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? Number(process.argv[i + 1]) : def;
  if (!Number.isFinite(v) || v <= 0) throw new Error(`--${name} must be a positive number`);
  return Math.round(v);
};
const SEED = arg("seed", 42);
const FRAMES = arg("frames", 60);
const WIDTH = arg("width", 600);
const HEIGHT = arg("height", 600);

async function main() {
  const replay = path.join(ROOT, `apps/web/static/sim/replay-${SEED}.json`);
  if (!fs.existsSync(replay)) throw new Error(`No replay: run npm run sim -- --seed ${SEED} first`);
  const out = path.join(ROOT, `docs/post/media/sim/seed-${SEED}`);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });

  const port = await freePort();
  const vite = spawn("npm", ["exec", "-w", "apps/web", "--", "vite", "dev", "--port", String(port), "--strictPort"], {
    cwd: ROOT,
    stdio: ["ignore", "ignore", "inherit"],
  });
  const base = `http://localhost:${port}`;
  try {
    for (let i = 0; i < 120; i++) {
      if (
        await fetch(`${base}/sim/`).then(
          (r) => r.ok,
          () => false,
        )
      )
        break;
      await sleep(500);
    }
    const browser = await chromium.launch({ channel: "chrome" });
    const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
    await page.goto(`${base}/sim/?seed=${SEED}&export=1`, { waitUntil: "load" });
    await page.waitForFunction(() => "__sim" in window, null, { timeout: 60_000 });
    const total = await page.evaluate(() => (window as unknown as { __sim: { frames: number } }).__sim.frames);
    for (let k = 0; k < FRAMES; k++) {
      const tick = Math.round((k / Math.max(1, FRAMES - 1)) * (total - 1));
      await page.evaluate(
        (t) => (window as unknown as { __sim: { seek(t: number): Promise<void> } }).__sim.seek(t),
        tick,
      );
      await page.waitForTimeout(80);
      await page.screenshot({ path: path.join(out, `frame-${String(k).padStart(3, "0")}.png`) });
      process.stdout.write(`\r  frame ${k + 1} of ${FRAMES}`);
    }
    process.stdout.write("\n");
    await browser.close();
    const bytes = fs.readdirSync(out).reduce((n, f) => n + fs.statSync(path.join(out, f)).size, 0);
    console.info(`${FRAMES} frames (${WIDTH}x${HEIGHT}, ${Math.round(bytes / 1024)} KB): ${path.relative(ROOT, out)}`);
  } finally {
    vite.kill("SIGTERM");
  }
}

main().catch((e: unknown) => {
  console.error(`FAIL ${e instanceof Error ? e.message : String(e)}`);
  process.exitCode = 1;
});
