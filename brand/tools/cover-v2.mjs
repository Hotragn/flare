// Cover v2: Eagle Lake in autumn (Acadia, NPS, public domain; docs/credits/photos.md)
// under a warm golden-hour grade, with our own overlay: three Sparks drift in
// from the edges and meet as one Lit flame over the water. Palette and flame
// from the brand (palette.mjs, shared.mjs).
// Usage: node cover-v2.mjs
// Writes brand/src/cover-v2.svg (the 1000 x 420 source; it links the photo by a
// relative path), brand/export/social/cover-v2-1000x420.png and cover-v2-1280x640.png.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import { colors as C } from "./palette.mjs";
import { flamePath, glowDot, svgDoc, textPath, fraunces, wm, WM } from "./shared.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, "../export/social");
const SRC = path.resolve(HERE, "../src");
const PHOTO = "../../scripts/scenic-src/acadia-eagle-lake.jpg"; // relative to brand/src/
const png = (svg, w) => new Resvg(svg, { resourcesDir: SRC, fitTo: { mode: "width", value: w } }).render().asPng();
const at = (x, y, s, body) => `<g transform="translate(${x} ${y}) scale(${s})">${body}</g>`;
const r = (n) => Math.round(n * 10) / 10;

// A Spark: a bright head with a trail of fading dots along a quadratic curve
// from (x0,y0) toward the flame at (x1,y1), stopping short at fraction `end`.
function spark(x0, y0, cx, cy, x1, y1, k, end = 0.7) {
  const pt = (t) => [(1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t * t * x1, (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t * t * y1];
  let dots = "";
  const n = 14;
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * end;
    const [x, y] = pt(t);
    const f = i / (n - 1);
    dots += `<circle cx="${r(x)}" cy="${r(y)}" r="${r(k * (1.4 + f * 3.2))}" fill="${C["gold-300"]}" stroke="${C["maple-600"]}" stroke-width="${r(k * 1.2)}" opacity="${r(0.35 + f * 0.6)}"/>`;
  }
  const [hx, hy] = pt(end);
  const head = `<circle cx="${r(hx)}" cy="${r(hy)}" r="${r(k * 17)}" fill="${C["gold-300"]}" opacity="0.3"/><circle cx="${r(hx)}" cy="${r(hy)}" r="${r(k * 10)}" fill="${C["maple-500"]}"/><circle cx="${r(hx)}" cy="${r(hy)}" r="${r(k * 7)}" fill="${C["gold-300"]}"/><circle cx="${r(hx)}" cy="${r(hy)}" r="${r(k * 3.5)}" fill="${C["birch-50"]}"/>`;
  return dots + head;
}

const textLines = (lines, size, x, y, fill, lead) =>
  lines.map((l, i) => `<g transform="translate(${x} ${r(y + i * size * lead)})">${textPath(fraunces, l, size, 0, 0, fill, -0.01).svg}</g>`).join("");

function cover(W, H, L) {
  const k = L.k;
  const s = (v) => v * k;
  const defs = [
    // Golden-hour grade: warmer, a little deeper, blues pulled down.
    `<filter id="grade" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="1.06 0.06 0 0 0.03  0.02 0.94 0.02 0 0.01  0 0.06 0.72 0 0  0 0 0 1 0"/><feComponentTransfer><feFuncR type="gamma" amplitude="1" exponent="1.08"/><feFuncG type="gamma" amplitude="1" exponent="1.12"/><feFuncB type="gamma" amplitude="1" exponent="1.2"/></feComponentTransfer></filter>`,
    // Warm sun wash from the top right.
    `<radialGradient id="sun" cx="${L.sun[0]}" cy="${L.sun[1]}" r="0.75"><stop offset="0" stop-color="#F2B33D" stop-opacity="0.42"/><stop offset="0.5" stop-color="#D6762F" stop-opacity="0.2"/><stop offset="1" stop-color="#B0643F" stop-opacity="0"/></radialGradient>`,
    // Dark wash behind the words (birch-50 on dusk-900 stays above 7:1).
    `<linearGradient id="wash" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C["dusk-900"]}" stop-opacity="0.93"/><stop offset="${L.wash * 0.6}" stop-color="${C["dusk-900"]}" stop-opacity="0.82"/><stop offset="${L.wash}" stop-color="${C["dusk-900"]}" stop-opacity="0"/></linearGradient>`,
    `<linearGradient id="foot" x1="0" y1="0" x2="0" y2="1"><stop offset="0.55" stop-color="${C["ink-900"]}" stop-opacity="0"/><stop offset="1" stop-color="${C["ink-900"]}" stop-opacity="0.55"/></linearGradient>`,
  ].join("");
  const photo = `<image href="${PHOTO}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="${L.crop} slice" filter="url(#grade)"/>`;
  const washes = `<rect width="${W}" height="${H}" fill="#7C3A1E" opacity="0.16"/><rect width="${W}" height="${H}" fill="url(#sun)"/><rect width="${W}" height="${H}" fill="url(#foot)"/><rect width="${W}" height="${H}" fill="url(#wash)"/>`;

  // One Lit flame over the water: maple flame, gold heart, warm halo.
  const fs_ = s(L.flame);
  const fx = W * L.fx, fy = H * L.fy;
  const heart = [fx, fy + fs_ * 0.67];
  const halo = `<circle cx="${r(fx)}" cy="${r(fy + fs_ * 0.58)}" r="${r(fs_ * 0.85)}" fill="${C["gold-300"]}" opacity="0.18"/><circle cx="${r(fx)}" cy="${r(fy + fs_ * 0.6)}" r="${r(fs_ * 0.55)}" fill="${C["gold-300"]}" opacity="0.22"/>`;
  const reflect = `<ellipse cx="${r(fx)}" cy="${r(fy + fs_ * 1.04)}" rx="${r(fs_ * 0.3)}" ry="${r(fs_ * 0.05)}" fill="${C["maple-500"]}" opacity="0.45"/>`;
  const flame = halo + reflect + at(r(fx - fs_ / 2), r(fy), r(fs_ / 100), flamePath(C["maple-500"]) + glowDot(C["gold-300"], 7));

  // Three Sparks from three edges, all heading for the flame's heart.
  const [hx, hy] = heart;
  const sparks = L.sparks.map(([x0, y0, cx, cy]) => spark(x0 * W, y0 * H, cx * W, cy * H, hx, hy, k)).join("");

  const wmH = s(L.wm);
  const word = `<g transform="translate(${r(L.tx * k)} ${r(L.ty * k)}) scale(${r((wmH / -WM.top) * 1000) / 1000})">${wm(C["gold-300"]).svg}</g>`;
  const line = textLines(["It only lights if", "enough friends", "quietly say yes."], s(L.size), r(L.tx * k), r(L.ty * k + s(L.gap)), C["birch-50"], 1.12);

  return svgDoc(`<defs>${defs}</defs>${photo}${washes}${sparks}${flame}${word}${line}`, { w: W, h: H, title: "Flare. It only lights if enough friends quietly say yes." });
}

const LAYOUTS = {
  "1000x420": [1000, 420, { k: 1, crop: "xMidYMid", sun: [0.85, 0.05], wash: 0.58, flame: 124, fx: 0.7, fy: 0.27, wm: 70, size: 44, tx: 52, ty: 112, gap: 72,
    sparks: [[0.6, -0.04, 0.58, 0.2], [1.02, 0.1, 0.9, 0.12], [0.5, 1.04, 0.56, 0.75]] }],
  "1280x640": [1280, 640, { k: 1.4, crop: "xMidYMid", sun: [0.85, 0.05], wash: 0.56, flame: 124, fx: 0.7, fy: 0.3, wm: 76, size: 46, tx: 50, ty: 150, gap: 76,
    sparks: [[0.6, -0.04, 0.58, 0.2], [1.02, 0.12, 0.9, 0.14], [0.5, 1.04, 0.56, 0.75]] }],
};

fs.mkdirSync(SRC, { recursive: true });
for (const [name, [W, H, L]] of Object.entries(LAYOUTS)) {
  const svg = cover(W, H, L);
  fs.writeFileSync(path.join(OUT, `cover-v2-${name}.png`), png(svg, W));
  if (name === "1000x420") fs.writeFileSync(path.join(SRC, "cover-v2.svg"), svg);
}
console.log("cover-v2 rendered.");
