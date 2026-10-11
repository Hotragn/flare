// Turns the exported Virtual Fairlane frames (a simulation) into a looping GIF for the post,
// plus a still poster, without ffmpeg: Chrome (Playwright) decodes the PNGs, gifenc encodes.
// One palette for all frames; after the first frame, pixels that didn't change are transparent,
// so the map background is stored once.
// Usage: npm run sim:frames && npm run sim:gif -- [--seed 42] [--seconds 15] [--poster 40]
import fs from "node:fs";
import path from "node:path";
import gifenc from "gifenc";
import { chromium } from "playwright-core";
import { ROOT } from "./lib.ts";

const { GIFEncoder, quantize, applyPalette } = gifenc;
const arg = (name: string, def: number) => {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? Number(process.argv[i + 1]) : def;
  if (!Number.isFinite(v) || v < 0) throw new Error(`--${name} must be a number`);
  return v;
};
const SEED = arg("seed", 42);
const SECONDS = arg("seconds", 15);
const DIR = path.join(ROOT, "docs/post/media/sim");
const FRAMES = path.join(DIR, `seed-${SEED}`);

async function main() {
  if (!fs.existsSync(FRAMES)) throw new Error(`No frames: run npm run sim:frames -- --seed ${SEED} first`);
  const files = fs
    .readdirSync(FRAMES)
    .filter((f) => /^frame-\d+\.png$/.test(f))
    .sort();
  if (files.length < 2) throw new Error("Need at least 2 frames");
  const posterAt = Math.min(files.length - 1, arg("poster", Math.round(files.length * 0.66)));

  // Decode in Chrome: no PNG library needed.
  const browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage();
  const decode = async (file: string) => {
    const b64 = fs.readFileSync(path.join(FRAMES, file)).toString("base64");
    const out = await page.evaluate(async (src) => {
      const img = new Image();
      img.src = `data:image/png;base64,${src}`;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext("2d") as CanvasRenderingContext2D;
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let s = "";
      for (let i = 0; i < d.length; i += 0x8000) s += String.fromCharCode(...d.subarray(i, i + 0x8000));
      return { w: c.width, h: c.height, rgba: btoa(s) };
    }, b64);
    return { w: out.w, h: out.h, rgba: new Uint8Array(Buffer.from(out.rgba, "base64")) };
  };
  const frames = [];
  for (const f of files) frames.push(await decode(f));
  await browser.close();
  const { w, h } = frames[0] as { w: number; h: number };

  // One shared palette from a strip of every frame (255 colours; index 255 is transparent).
  const sample = new Uint8Array(frames.length * w * 8 * 4);
  frames.forEach((f, k) => {
    for (let row = 0; row < 8; row++) {
      const y = Math.floor(((row + 0.5) / 8) * h);
      sample.set(f.rgba.subarray(y * w * 4, (y + 1) * w * 4), (k * 8 + row) * w * 4);
    }
  });
  const palette = quantize(sample, 255, { format: "rgb565" });
  while (palette.length < 256) palette.push([0, 0, 0]);
  const TRANSPARENT = 255;

  const gif = GIFEncoder();
  const delay = Math.round((SECONDS * 1000) / frames.length);
  let prev: Uint8Array | null = null;
  for (const [k, f] of frames.entries()) {
    const index = applyPalette(f.rgba, palette.slice(0, 255), "rgb565");
    let out = index;
    if (prev) {
      out = new Uint8Array(index);
      for (let i = 0; i < out.length; i++) if (out[i] === prev[i]) out[i] = TRANSPARENT;
    }
    gif.writeFrame(out, w, h, {
      palette,
      delay: k === frames.length - 1 ? delay * 6 : delay, // rest on the final stats a moment
      transparent: prev !== null,
      transparentIndex: TRANSPARENT,
      dispose: 1, // keep the previous frame under the transparent pixels
      repeat: 0,
    });
    prev = index;
  }
  gif.finish();
  const gifPath = path.join(DIR, `fairlane-sim-${SEED}.gif`);
  fs.writeFileSync(gifPath, gif.bytes());
  const posterPath = path.join(DIR, `fairlane-sim-${SEED}-poster.png`);
  fs.copyFileSync(path.join(FRAMES, files[posterAt] as string), posterPath);
  const kb = (p: string) => Math.round(fs.statSync(p).size / 1024);
  console.info(
    `${path.relative(ROOT, gifPath)}: ${frames.length} frames, ${w}x${h}, ${(frames.length * delay + delay * 5) / 1000} s loop, ${kb(gifPath)} KB`,
  );
  console.info(`${path.relative(ROOT, posterPath)}: frame ${posterAt}, ${kb(posterPath)} KB`);
}

main().catch((e: unknown) => {
  console.error(`FAIL ${e instanceof Error ? e.message : String(e)}`);
  process.exitCode = 1;
});
