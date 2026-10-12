// "Places a Flare can happen": four credited scenic photos in one strip for the README.
// Photos and licences: docs/credits/photos.md (all public domain or CC0).
// Usage: node places-strip.mjs   writes brand/export/readme/places-strip.png
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import { colors as C } from "./palette.mjs";
import { svgDoc, textPath, atkinson } from "./shared.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, "../src"); // hrefs below are relative to brand/src/
const OUT = path.resolve(HERE, "../export/readme");
const PLACES = [
  ["acadia-eagle-lake", "A lake"],
  ["autumn-trail", "A trail"],
  ["pictured-rocks-autumn", "A forest road"],
  ["sleeping-bear-dunes", "A beach"],
];
const W = 1280, H = 330, GAP = 12, TILE = (W - GAP * (PLACES.length - 1)) / PLACES.length, R = 18;
const grade = `<filter id="grade" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="1.05 0.05 0 0 0.02  0.02 0.96 0.02 0 0.01  0 0.05 0.8 0 0  0 0 0 1 0"/></filter>`;
const foot = `<linearGradient id="foot" x1="0" y1="0" x2="0" y2="1"><stop offset="0.55" stop-color="${C["dusk-900"]}" stop-opacity="0"/><stop offset="1" stop-color="${C["dusk-900"]}" stop-opacity="0.85"/></linearGradient>`;
const tiles = PLACES.map(([slug, label], i) => {
  const x = i * (TILE + GAP);
  const t = textPath(atkinson, label, 30, 0, 0, C["birch-50"]);
  return `<clipPath id="c${i}"><rect x="${x}" y="0" width="${TILE}" height="${H}" rx="${R}"/></clipPath>`
    + `<g clip-path="url(#c${i})"><image href="../../scripts/scenic-src/${slug}.jpg" x="${x}" y="0" width="${TILE}" height="${H}" preserveAspectRatio="xMidYMid slice" filter="url(#grade)"/><rect x="${x}" y="0" width="${TILE}" height="${H}" fill="url(#foot)"/></g>`
    + `<g transform="translate(${x + 22} ${H - 26})">${t.svg}</g>`;
}).join("");
const svg = svgDoc(`<defs>${grade}${foot}</defs>${tiles}`, { w: W, h: H, title: "Places a Flare can happen" });
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "places-strip.png"), new Resvg(svg, { resourcesDir: SRC, fitTo: { mode: "width", value: W } }).render().asPng());
console.log("places-strip rendered.");
