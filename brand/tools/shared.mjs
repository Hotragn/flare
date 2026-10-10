// Shared geometry, text outlining and texture for Flare brand builds.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import opentype from "opentype.js";
import { colors as C, roles } from "./palette.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url));
// ---------- Geometry (100 x 100 design grid) ----------
// The mark is an upside-down map pin: a flame that points up, with the pin's
// round hole at its base. "A place, lit."
export const FLAME = "M55 4 C61 20 80 34 80 60 C80 81 66 96 50 96 C34 96 20 81 20 60 C20 45 29 35 37 27 C37 37 41 43 46 45 C43 31 48 16 55 4 Z";
export const ring = (cx, cy, r) => `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0 Z`;
export const HOLE = { cx: 50, cy: 67, r: 12 };
export const DOME = "M17 86 C17 68 32 60 50 60 C68 60 83 68 83 86 C83 92 74 95 50 95 C26 95 17 92 17 86 Z";

export const flamePath = (fill) => `<path fill-rule="evenodd" fill="${fill}" d="${FLAME} ${ring(HOLE.cx, HOLE.cy, HOLE.r)}"/>`;
export const glowDot = (fill) => `<circle cx="${HOLE.cx}" cy="${HOLE.cy}" r="6" fill="${fill}"/>`;

export const state = {
  kindling: (fg) => `<g transform="translate(50 96) scale(0.55) translate(-50 -96)">${flamePath(fg)}</g>`,
  lit: (fg) => flamePath(fg),
  ember: (fg) => `<path fill-rule="evenodd" fill="${fg}" d="${DOME} ${ring(50, 81, 8)}"/>`,
  gone: (fg) => `<g fill="none" stroke="${fg}"><circle cx="50" cy="86" r="7" stroke-width="3" stroke-dasharray="3.2 3.2" opacity="0.7"/><path d="M50 76 C41 67 59 60 51 49 C45 40 58 33 61 22" stroke-width="5" stroke-linecap="round"/><path d="M66 18 C70 13 67 8 72 3" stroke-width="4" stroke-linecap="round" opacity="0.5"/></g>`,
};

export const svgDoc = (body, { w = 100, h = 100, vb = `0 0 ${w} ${h}`, title } = {}) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${w}" height="${h}"${title ? ` role="img" aria-label="${title}"` : ""}>${title ? `<title>${title}</title>` : ""}${body}</svg>\n`;

// ---------- Paper grain ----------
export const grainDefs = (id, opacity) => `<filter id="${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 0.13  0 0 0 0 0.10  0 0 0 0 0.09  0 0 0 ${opacity} 0"/></filter>`;
export const grainRect = (id, w, h) => `<rect width="${w}" height="${h}" filter="url(#${id})"/>`;

// ---------- Wordmark (Fraunces 600, outlined) ----------
const fontFile = path.join(HERE, "node_modules/@fontsource/fraunces/files/fraunces-latin-600-normal.woff");
const buf = fs.readFileSync(fontFile);
export const fraunces = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const bodyFile = path.join(HERE, "node_modules/@fontsource/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-700-normal.woff");
const bbuf = fs.readFileSync(bodyFile);
export const atkinson = opentype.parse(bbuf.buffer.slice(bbuf.byteOffset, bbuf.byteOffset + bbuf.byteLength));

// Absolute path data. opentype.js toPathData() emits relative moves after a
// close that resvg places wrongly on some glyphs (seen on "g"), so we write
// every command ourselves.
export const r2 = (n) => Math.round(n * 100) / 100;
export function absPath(p) {
  return p.commands.map((c) => {
    if (c.type === "M" || c.type === "L") return `${c.type}${r2(c.x)} ${r2(c.y)}`;
    if (c.type === "C") return `C${r2(c.x1)} ${r2(c.y1)} ${r2(c.x2)} ${r2(c.y2)} ${r2(c.x)} ${r2(c.y)}`;
    if (c.type === "Q") return `Q${r2(c.x1)} ${r2(c.y1)} ${r2(c.x)} ${r2(c.y)}`;
    return "Z";
  }).join("");
}
export function textPath(font, text, size, x, y, fill, tracking = 0) {
  let cx = x; let d = "";
  const glyphs = font.stringToGlyphs(text);
  glyphs.forEach((g, i) => {
    d += absPath(g.getPath(cx, y, size));
    cx += (g.advanceWidth / font.unitsPerEm) * size + tracking * size;
    if (i < glyphs.length - 1) cx += (font.getKerningValue(g, glyphs[i + 1]) / font.unitsPerEm) * size;
  });
  return { svg: `<path fill="${fill}" d="${d}"/>`, width: cx - x };
}
export const WM_SIZE = 100;
export const wm = (fill) => textPath(fraunces, "flare", WM_SIZE, 0, 0, fill, -0.01);
export const wmBox = (() => { const p = fraunces.getPath("flare", 0, 0, WM_SIZE); const b = p.getBoundingBox(); return b; })();
export const WM = { w: wm("#000").width, top: wmBox.y1, bottom: wmBox.y2 }; // y1 negative (ascender)
export const xHeight = (fraunces.tables.os2.sxHeight / fraunces.unitsPerEm) * WM_SIZE;

