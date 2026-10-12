// Records one motion moment from the /dev/components/?s= catalog as a GIF (and a still of the end), with
// Chrome's screencast (CDP) at 390x844, then gifenc. No ffmpeg. Frames are scaled to 260 px wide
// and share one palette, so a 1.5 s moment stays well under 2 MB.
// Usage: node tools/motion/record.ts <base-url> <out.gif> <catalog-query> <action-js> [ms=1600]
//   e.g. node tools/motion/record.ts http://localhost:5180 sparks.gif "s=H5&have=1" "flareDev.set({have:2})"
// The action runs in the page after it settles; "" records the screen's own entry (remount).
/// <reference path="../sim/gifenc.d.ts" />
import fs from "node:fs";
import gifenc from "gifenc";
import { chromium } from "playwright-core";
import sharp from "sharp";

const { GIFEncoder, quantize, applyPalette } = gifenc;
const [base, out, query, action = "", msArg = "1600"] = process.argv.slice(2);
if (!base || !out || !query) throw new Error("usage: record.ts <base-url> <out.gif> <query> <action-js> [ms]");
const MS = Number(msArg);
const WIDTH = 260;

const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
});
const page = await ctx.newPage();
await page.goto(`${base}/dev/components/?${query}`);
await page.waitForFunction(() => document.documentElement.dataset.ready === "1");
await page.waitForTimeout(1200);
const cdp = await ctx.newCDPSession(page);
const frames: { data: Buffer; t: number }[] = [];
cdp.on("Page.screencastFrame", (f) => {
  frames.push({ data: Buffer.from(f.data, "base64"), t: f.metadata.timestamp ?? Date.now() / 1000 });
  void cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId });
});
await cdp.send("Page.startScreencast", {
  format: "jpeg",
  quality: 85,
  maxWidth: 390,
  maxHeight: 844,
  everyNthFrame: 1,
});
await page.waitForTimeout(250);
await page.evaluate(action || "flareDev.remount()");
await page.waitForTimeout(MS);
await cdp.send("Page.stopScreencast");
await page.screenshot({ path: out.replace(/\.gif$/, "-end.png") });
await browser.close();
if (frames.length < 2) throw new Error(`only ${frames.length} frames`);

const raw = await Promise.all(
  frames.map((f) => sharp(f.data).resize({ width: WIDTH }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })),
);
const { width: w, height: h } = raw[0]?.info ?? { width: WIDTH, height: 0 };
// One palette from every 3rd frame, then each frame mapped to it.
const pick = raw.filter((_, i) => i % 3 === 0).map((r) => r.data);
const all = new Uint8Array(pick.reduce((n, b) => n + b.length, 0));
let o = 0;
for (const b of pick) {
  all.set(b, o);
  o += b.length;
}
const palette = quantize(all, 256);
const gif = GIFEncoder();
raw.forEach((r, i) => {
  const next = frames[i + 1]?.t ?? (frames[i]?.t ?? 0) + 0.1;
  const delay = Math.max(20, Math.round((next - (frames[i]?.t ?? 0)) * 1000));
  gif.writeFrame(applyPalette(r.data, palette), w, h, { palette, delay, repeat: 0 });
});
gif.finish();
// A strip of 8 evenly spaced frames, for review without playing the GIF.
const at = Array.from({ length: 8 }, (_, k) => raw[Math.round((k * (raw.length - 1)) / 7)]);
await sharp({ create: { width: (w + 4) * 8, height: h, channels: 4, background: "#888" } })
  .composite(
    at.map((r, k) => ({
      input: r?.data ?? Buffer.alloc(0),
      raw: { width: w, height: h, channels: 4 },
      left: k * (w + 4),
      top: 0,
    })),
  )
  .png()
  .toFile(out.replace(/\.gif$/, "-strip.png"));
fs.writeFileSync(out, gif.bytes());
console.info(`${out}: ${frames.length} frames, ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
