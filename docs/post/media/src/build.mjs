// Renders the post's two made images. Run from the repo root:
//   node docs/post/media/src/build.mjs
// 20-architecture.png from 20-architecture.svg; 21-storyboard.png from four real screenshots.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const media = join(here, "..");

await sharp(readFileSync(join(here, "20-architecture.svg")), { density: 144 })
  .resize(1600, 900)
  .png()
  .toFile(join(media, "20-architecture.png"));

const frames = [
  { file: "02-friend-invite.jpg", n: "1", title: "Kindling", line1: "A friend gets the invite.", line2: "1 more to light it, never who." },
  { file: "03-friend-lit.jpg", n: "2", title: "Lit", line1: "Enough said yes.", line2: "Find them, with the compass." },
  { file: "06-friend-ember.jpg", n: "3", title: "Ember", line1: "Too few in 30 min?", line2: "A smaller plan, not a dead one." },
  { file: "demo-6-outside.jpg", n: "4", title: "Gone", line1: "15 min outside together,", line2: "then it all deletes itself." },
];
const W = 360;
const H = 779; // 780x1688 scaled to 360 wide
const gap = 40;
const pad = 50;
const top = 190;
const width = pad * 2 + frames.length * W + (frames.length - 1) * gap;
const height = top + H + 60;

const labels = frames
  .map((f, i) => {
    const x = pad + i * (W + gap);
    return `
  <circle cx="${x + 22}" cy="${top - 118}" r="22" fill="#e2611f"/>
  <text x="${x + 22}" y="${top - 110}" font-size="24" font-weight="700" fill="#fff" text-anchor="middle">${f.n}</text>
  <text x="${x + 56}" y="${top - 108}" font-size="32" font-weight="700" fill="#1d2230">${f.title}</text>
  <text x="${x}" y="${top - 60}" font-size="21" fill="#1d2230">${f.line1}</text>
  <text x="${x}" y="${top - 30}" font-size="21" fill="#1d2230">${f.line2}</text>
  <rect x="${x - 1.5}" y="${top - 1.5}" width="${W + 3}" height="${H + 3}" rx="22" fill="none" stroke="#1d2230" stroke-width="3"/>`;
  })
  .join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" font-family="Helvetica, Arial, sans-serif">
  <rect width="${width}" height="${height}" fill="#fbf7f2"/>${labels}
  <text x="${pad}" y="${height - 22}" font-size="18" fill="#5b6170">Frames 1 to 3: the real app on the real stack. Frame 4: the demo. Frame 3 is the other way an evening can go.</text>
</svg>`;

const rounded = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" rx="20" fill="#fff"/></svg>`,
);
const shots = [];
for (const [i, f] of frames.entries()) {
  const path = f.file.startsWith("demo-")
    ? join(media, "..", "..", "design", "redesign", "after", f.file)
    : join(media, f.file);
  const img = await sharp(path)
    .resize(W, H)
    .composite([{ input: rounded, blend: "dest-in" }])
    .png()
    .toBuffer();
  shots.push({ input: img, left: pad + i * (W + gap), top });
}

await sharp(Buffer.from(svg))
  .composite(shots)
  .png()
  .toFile(join(media, "21-storyboard.png"));

console.log("wrote 20-architecture.png and 21-storyboard.png");
