// Contact sheet: lays PNGs side by side at a small size, for a quick look at many screens.
// Usage: node tools/motion/sheet.ts <out.png> <width-each> <a.png> <b.png> ...
import sharp from "sharp";

const [out, w, ...files] = process.argv.slice(2);
if (!out || !w || !files.length) throw new Error("usage: sheet.ts <out.png> <width-each> <png...>");
const width = Number(w);
const tiles = await Promise.all(files.map((f) => sharp(f).resize({ width }).png().toBuffer({ resolveWithObject: true })));
const height = Math.max(...tiles.map((t) => t.info.height));
await sharp({ create: { width: width * tiles.length + 4 * (tiles.length - 1), height, channels: 3, background: "#888" } })
  .composite(tiles.map((t, i) => ({ input: t.data, left: i * (width + 4), top: 0 })))
  .png()
  .toFile(out);
