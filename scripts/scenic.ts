// Scenic photos (backlog #6): resize and re-encode the CC0 / public-domain originals in
// scripts/scenic-src/ to AVIF and WebP in two crops: portrait 750x1334 for phones ("-p") and
// landscape 1600x900 for the website ("-l"), cropped on the busiest part of the picture
// (sharp's attention strategy), into apps/web/static/scenery/, plus a manifest. Credits: docs/credits/photos.md. Usage: npm run scenic
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "scripts/scenic-src");
const OUT = path.join(ROOT, "apps/web/static/scenery");
const CROPS = { p: [750, 1334], l: [1600, 900] } as const;
const credits = JSON.parse(fs.readFileSync(path.join(SRC, "credits.json"), "utf8")) as {
  slug: string;
  title: string;
  author: string;
  license: string;
  source: string;
}[];
fs.mkdirSync(OUT, { recursive: true });
const manifest = [];
for (const c of credits) {
  const input = path.join(SRC, `${c.slug}.jpg`);
  for (const [name, [w, h]] of Object.entries(CROPS)) {
    const img = sharp(input).resize({ width: w, height: h, fit: "cover", position: sharp.strategy.attention });
    await img
      .clone()
      .avif({ quality: 48, effort: 6 })
      .toFile(path.join(OUT, `${c.slug}-${name}.avif`));
    await img
      .clone()
      .webp({ quality: 70 })
      .toFile(path.join(OUT, `${c.slug}-${name}.webp`));
  }
  const meta = await sharp(input).metadata();
  manifest.push({
    slug: c.slug,
    author: c.author,
    license: c.license,
    source: c.source,
    ratio: (meta.width ?? 16) / (meta.height ?? 9),
  });
}
fs.writeFileSync(path.join(OUT, "manifest.json"), `${JSON.stringify(manifest, null, 1)}\n`);
const size = fs.readdirSync(OUT).reduce((a, f) => a + fs.statSync(path.join(OUT, f)).size, 0);
console.info(`scenic: ${credits.length} photos, 4 files each, ${Math.round(size / 1024)} KB total`);
