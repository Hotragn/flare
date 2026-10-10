// Builds every Flare brand asset from code: logo SVGs, state marks, UI icons,
// app icons, favicons, splash screens, social images, texture and tokens.
// Usage: npm run build   (from brand/tools)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import opentype from "opentype.js";
import { Resvg } from "@resvg/resvg-js";
import pngToIco from "png-to-ico";
import { colors as C, roles } from "./palette.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BRAND = path.resolve(HERE, "..");
const out = (...p) => { const f = path.join(BRAND, ...p); fs.mkdirSync(path.dirname(f), { recursive: true }); return f; };
const write = (rel, data) => fs.writeFileSync(out(rel), data);
const png = (svg, width) => new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng();

// ---------- Geometry (100 x 100 design grid) ----------
// The mark is an upside-down map pin: a flame that points up, with the pin's
// round hole at its base. "A place, lit."
export const FLAME = "M55 4 C61 20 80 34 80 60 C80 81 66 96 50 96 C34 96 20 81 20 60 C20 45 29 35 37 27 C37 37 41 43 46 45 C43 31 48 16 55 4 Z";
const ring = (cx, cy, r) => `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0 Z`;
const HOLE = { cx: 50, cy: 67, r: 12 };
const DOME = "M17 86 C17 68 32 60 50 60 C68 60 83 68 83 86 C83 92 74 95 50 95 C26 95 17 92 17 86 Z";

const flamePath = (fill) => `<path fill-rule="evenodd" fill="${fill}" d="${FLAME} ${ring(HOLE.cx, HOLE.cy, HOLE.r)}"/>`;
const glowDot = (fill) => `<circle cx="${HOLE.cx}" cy="${HOLE.cy}" r="6" fill="${fill}"/>`;

const state = {
  kindling: (fg) => `<g transform="translate(50 96) scale(0.55) translate(-50 -96)">${flamePath(fg)}</g>`,
  lit: (fg) => flamePath(fg),
  ember: (fg) => `<path fill-rule="evenodd" fill="${fg}" d="${DOME} ${ring(50, 81, 8)}"/>`,
  gone: (fg) => `<g fill="none" stroke="${fg}"><circle cx="50" cy="86" r="7" stroke-width="3" stroke-dasharray="3.2 3.2" opacity="0.7"/><path d="M50 76 C41 67 59 60 51 49 C45 40 58 33 61 22" stroke-width="5" stroke-linecap="round"/><path d="M66 18 C70 13 67 8 72 3" stroke-width="4" stroke-linecap="round" opacity="0.5"/></g>`,
};

const svgDoc = (body, { w = 100, h = 100, vb = `0 0 ${w} ${h}`, title } = {}) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${w}" height="${h}"${title ? ` role="img" aria-label="${title}"` : ""}>${title ? `<title>${title}</title>` : ""}${body}</svg>\n`;

// ---------- Paper grain ----------
const grainDefs = (id, opacity) => `<filter id="${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 0.13  0 0 0 0 0.10  0 0 0 0 0.09  0 0 0 ${opacity} 0"/></filter>`;
const grainRect = (id, w, h) => `<rect width="${w}" height="${h}" filter="url(#${id})"/>`;

// ---------- Wordmark (Fraunces 600, outlined) ----------
const fontFile = path.join(HERE, "node_modules/@fontsource/fraunces/files/fraunces-latin-600-normal.woff");
const buf = fs.readFileSync(fontFile);
const fraunces = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const bodyFile = path.join(HERE, "node_modules/@fontsource/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-700-normal.woff");
const bbuf = fs.readFileSync(bodyFile);
const atkinson = opentype.parse(bbuf.buffer.slice(bbuf.byteOffset, bbuf.byteOffset + bbuf.byteLength));

// Absolute path data. opentype.js toPathData() emits relative moves after a
// close that resvg places wrongly on some glyphs (seen on "g"), so we write
// every command ourselves.
const r2 = (n) => Math.round(n * 100) / 100;
function absPath(p) {
  return p.commands.map((c) => {
    if (c.type === "M" || c.type === "L") return `${c.type}${r2(c.x)} ${r2(c.y)}`;
    if (c.type === "C") return `C${r2(c.x1)} ${r2(c.y1)} ${r2(c.x2)} ${r2(c.y2)} ${r2(c.x)} ${r2(c.y)}`;
    if (c.type === "Q") return `Q${r2(c.x1)} ${r2(c.y1)} ${r2(c.x)} ${r2(c.y)}`;
    return "Z";
  }).join("");
}
function textPath(font, text, size, x, y, fill, tracking = 0) {
  let cx = x; let d = "";
  const glyphs = font.stringToGlyphs(text);
  glyphs.forEach((g, i) => {
    d += absPath(g.getPath(cx, y, size));
    cx += (g.advanceWidth / font.unitsPerEm) * size + tracking * size;
    if (i < glyphs.length - 1) cx += (font.getKerningValue(g, glyphs[i + 1]) / font.unitsPerEm) * size;
  });
  return { svg: `<path fill="${fill}" d="${d}"/>`, width: cx - x };
}
const WM_SIZE = 100;
const wm = (fill) => textPath(fraunces, "flare", WM_SIZE, 0, 0, fill, -0.01);
const wmBox = (() => { const p = fraunces.getPath("flare", 0, 0, WM_SIZE); const b = p.getBoundingBox(); return b; })();
const WM = { w: wm("#000").width, top: wmBox.y1, bottom: wmBox.y2 }; // y1 negative (ascender)
const xHeight = (fraunces.tables.os2.sxHeight / fraunces.unitsPerEm) * WM_SIZE;

// ---------- Logo files ----------
const MARK_COLORS = { maple: C["maple-600"], ink: C["ink-900"], birch: C["birch-50"] };
for (const [name, fill] of Object.entries(MARK_COLORS)) {
  write(`logo/flare-mark-${name}.svg`, svgDoc(flamePath(fill), { title: "Flare" }));
  const w = wm(fill);
  const pad = 4;
  write(`logo/flare-wordmark-${name}.svg`, svgDoc(`<g transform="translate(${pad} ${-WM.top + pad})">${w.svg}</g>`,
    { w: Math.ceil(WM.w + 2 * pad), h: Math.ceil(WM.bottom - WM.top + 2 * pad), title: "Flare" }));
}
write("logo/flare-mark-glow.svg", svgDoc(flamePath(C["maple-600"]) + glowDot(C["gold-400"]), { title: "Flare" }));

// Horizontal lockup: mark height = 1.9 x x-height, baseline-aligned to the mark's bottom.
function lockup(markFill, textFill, dot, stacked = false) {
  const markH = -WM.top * 1.08; const s = markH / 92; // flame spans y 4..96; sized to the ascender
  const gap = markH * 0.28;
  const mark = `<g transform="scale(${s}) translate(0 -4)">${flamePath(markFill)}${dot ? glowDot(dot) : ""}</g>`;
  const word = wm(textFill).svg;
  if (!stacked) {
    const markW = 100 * s; const h = Math.max(markH, WM.bottom - WM.top);
    const baseY = markH; // text baseline at mark bottom
    const body = `<g transform="translate(0 ${h - markH})">${mark}</g><g transform="translate(${markW + gap - 18 * s} ${baseY + (h - markH)})">${word}</g>`;
    return svgDoc(body, { w: Math.ceil(markW + gap + WM.w), h: Math.ceil(h + WM.bottom), title: "Flare" });
  }
  const big = markH * 1.6; const s2 = big / 92; const markW = 100 * s2;
  const W = Math.max(markW, WM.w); const textTop = big + gap;
  const body = `<g transform="translate(${(W - markW) / 2} 0) scale(${s2}) translate(0 -4)">${flamePath(markFill)}${dot ? glowDot(dot) : ""}</g><g transform="translate(${(W - WM.w) / 2} ${textTop - WM.top})">${word}</g>`;
  return svgDoc(body, { w: Math.ceil(W), h: Math.ceil(textTop + WM.bottom - WM.top), title: "Flare" });
}
write("logo/flare-lockup-horizontal-light.svg", lockup(C["maple-600"], C["ink-900"]));
write("logo/flare-lockup-horizontal-dark.svg", lockup(C["maple-500"], C["birch-100"], C["gold-400"]));
write("logo/flare-lockup-horizontal-ink.svg", lockup(C["ink-900"], C["ink-900"]));
write("logo/flare-lockup-horizontal-birch.svg", lockup(C["birch-50"], C["birch-50"]));
write("logo/flare-lockup-stacked-light.svg", lockup(C["maple-600"], C["ink-900"], null, true));
write("logo/flare-lockup-stacked-dark.svg", lockup(C["maple-500"], C["birch-100"], C["gold-400"], true));

// State marks: themed and currentColor (for UI, so CSS sets the color).
for (const [name, fn] of Object.entries(state)) {
  const label = name[0].toUpperCase() + name.slice(1);
  write(`logo/states/flare-${name}-light.svg`, svgDoc(fn(C[roles.light[name]]), { title: label }));
  write(`logo/states/flare-${name}-dark.svg`, svgDoc(fn(C[roles.dark[name]]), { title: label }));
  write(`logo/states/flare-${name}-currentColor.svg`, svgDoc(fn("currentColor"), { title: label }));
}

// ---------- UI icons (24 grid, 2 px round stroke, currentColor) ----------
const icons = {
  camera: `<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>`,
  compass: `<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5 13.4 13.4 8.5 15.5 10.6 10.6z"/>`,
  bench: `<path d="M4 11h16M5 7h14M6 11v6M18 11v6M4 14h16"/>`,
  restroom: `<circle cx="12" cy="4.5" r="2"/><path d="M8.5 9h7l1.5 7h-2.5l-.5 5h-3l-.5-5H7z"/>`,
  water: `<path d="M12 3c3.5 4.5 6 8 6 11a6 6 0 0 1-12 0c0-3 2.5-6.5 6-11z"/>`,
  steps: `<path d="M3 20h5v-4h4v-4h4V8h5"/>`,
  here: `<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.5 2.5L16 9.5"/>`,
  fade: `<path d="M12 3v11M8 10l4 4 4-4M6 20h12"/>`,
  spark: `<path d="M5 19c0-8 6-14 14-14 0 8-6 14-14 14z"/><path d="M5 19 13 11"/>`,
  hotspots: `<path d="M9 21s-5-5-5-9a5 5 0 0 1 10 0c0 4-5 9-5 9z"/><circle cx="9" cy="12" r="1.6"/><path d="M15.5 4.5a4 4 0 0 1 4.5 4c0 2.5-2.2 5-3.5 6.3"/>`,
  plan: `<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>`,
  card: `<path d="M6 3h9l3 3v15H6z"/><path d="M9 10h6M9 14h6M9 18h4"/>`,
  mapfix: `<path d="M12 21s-6-5.5-6-10a6 6 0 0 1 12 0c0 4.5-6 10-6 10z"/><path d="M12 8v6M9 11h6"/>`,
  offline: `<path d="M7 18h10a4 4 0 0 0 .6-7.9A6 6 0 0 0 6.2 9.5 4.3 4.3 0 0 0 7 18z"/><path d="M4 4l16 16"/>`,
  sunset: `<path d="M3 18h18M6 18a6 6 0 0 1 12 0M12 6V3M5.6 9.6 3.5 7.5M18.4 9.6l2.1-2.1"/>`,
  plusone: `<circle cx="9" cy="8" r="3.5"/><path d="M3 20a6 6 0 0 1 12 0M18 8v6M15 11h6"/>`,
};
for (const [name, body] of Object.entries(icons)) {
  write(`icons/${name}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>\n`);
}

// ---------- App icon ----------
// Dusk evening sky, maple flame, gold "you are here" dot. No grain: it adds
// about 250 KB per icon and can't be seen at icon sizes.
function appIcon(size, { maskable = false } = {}) {
  const scale = maskable ? 0.52 : 0.64; // maskable keeps the flame inside the 80% safe circle
  const m = size * scale; const x = (size - m) / 2; const y = (size - m) / 2 + size * 0.01;
  const body = `<defs>${grainDefs("g", 0.06)}<radialGradient id="glow" cx="50%" cy="62%" r="55%"><stop offset="0" stop-color="${C["dusk-700"]}"/><stop offset="1" stop-color="${C["dusk-900"]}"/></radialGradient></defs>
<rect width="${size}" height="${size}" fill="url(#glow)"/>
<g transform="translate(${x} ${y}) scale(${m / 100})">${flamePath(C["maple-500"])}${glowDot(C["gold-400"])}</g>`;
  return svgDoc(body, { w: size, h: size });
}
write("icon/app-icon.svg", appIcon(1024));
write("icon/app-icon-maskable.svg", appIcon(1024, { maskable: true }));
const ICON_SIZES = [16, 32, 48, 64, 120, 152, 167, 180, 192, 256, 384, 512, 1024];
for (const s of ICON_SIZES) write(`export/icons/icon-${s}.png`, png(appIcon(1024), s));
for (const s of [192, 512]) write(`export/icons/icon-maskable-${s}.png`, png(appIcon(1024, { maskable: true }), s));
write("export/icons/apple-touch-icon.png", png(appIcon(1024), 180));

// Favicons: the flat maple mark on transparent reads at 16 px; the .ico packs 16/32/48.
const favSvg = svgDoc(flamePath(C["maple-600"]), { title: "Flare" });
write("export/favicon/favicon.svg", favSvg);
const favPngs = [16, 32, 48].map((s) => { const b = png(favSvg, s); write(`export/favicon/favicon-${s}.png`, b); return b; });
write("export/favicon/favicon.ico", await pngToIco(favPngs));

// ---------- Splash screens (apple-touch-startup-image) ----------
// Our four phones in pixels (portrait). 16 Pro Max and 17 Pro Max share a size.
const DEVICES = [
  { name: "iphone-13", w: 1170, h: 2532, pt: [390, 844] },
  { name: "iphone-17-pro", w: 1206, h: 2622, pt: [402, 874] },
  { name: "iphone-16-17-pro-max", w: 1320, h: 2868, pt: [440, 956] },
];
// Splash screens are flat (no grain) to stay small: iOS loads them at launch.
function splash(w, h, mode) {
  const bg = mode === "light" ? C["birch-100"] : C["dusk-900"];
  const markFill = mode === "light" ? C["maple-600"] : C["maple-500"];
  const textFill = mode === "light" ? C["ink-900"] : C["birch-100"];
  const short = Math.min(w, h); const m = short * 0.26;
  const word = wm(textFill); const ws = (short * 0.34) / WM.w;
  const gap = m * 0.22; const blockH = m + gap + (WM.bottom - WM.top) * ws;
  const top = (h - blockH) / 2;
  const body = `<rect width="${w}" height="${h}" fill="${bg}"/>
<g transform="translate(${(w - m) / 2} ${top}) scale(${m / 100})">${flamePath(markFill)}${mode === "dark" ? glowDot(C["gold-400"]) : ""}</g>
<g transform="translate(${(w - WM.w * ws) / 2} ${top + m + gap - WM.top * ws}) scale(${ws})">${word.svg}</g>`;
  return svgDoc(body, { w, h });
}
const splashIndex = [];
for (const d of DEVICES) {
  for (const mode of ["light", "dark"]) {
    for (const orient of ["portrait", "landscape"]) {
      const [w, h] = orient === "portrait" ? [d.w, d.h] : [d.h, d.w];
      const file = `export/splash/${d.name}-${orient}-${mode}.png`;
      write(file, png(splash(w, h, mode), w));
      splashIndex.push({ file, w, h, pt: orient === "portrait" ? d.pt : [d.pt[1], d.pt[0]], orient, mode });
    }
  }
}
const splashTags = splashIndex.map((s) => `<link rel="apple-touch-startup-image" media="(device-width: ${Math.min(...s.pt)}px) and (device-height: ${Math.max(...s.pt)}px) and (-webkit-device-pixel-ratio: 3) and (orientation: ${s.orient}) and (prefers-color-scheme: ${s.mode})" href="/${s.file.replace("export/", "")}">`).join("\n");
write("export/splash/head-tags.html", splashTags + "\n");

// ---------- Social and DEV cover ----------
function banner(w, h, { title, line }) {
  const bg = C["dusk-900"];
  const unit = h / 630;
  const st = ["kindling", "lit", "ember", "gone"];
  const size = 100 * unit; const gapX = 30 * unit; const rowW = st.length * size + (st.length - 1) * gapX;
  const rowX = w - rowW - 60 * unit; const rowY = h * 0.42 - size / 2;
  const marks = st.map((n, i) => `<g transform="translate(${rowX + i * (size + gapX)} ${rowY}) scale(${size / 100})">${state[n](C[roles.dark[n]])}${n === "lit" ? glowDot(C["gold-400"]) : ""}</g>`).join("");
  const labels = st.map((n, i) => textPath(atkinson, n[0].toUpperCase() + n.slice(1), 26 * unit, 0, 0, C["dusk-300"]))
    .map((t, i) => `<g transform="translate(${rowX + i * (size + gapX) + (size - t.width) / 2} ${rowY + size + 40 * unit})">${t.svg}</g>`).join("");
  const ws = (140 * unit) / WM_SIZE;
  const titleSvg = `<g transform="translate(${80 * unit} ${h * 0.44}) scale(${ws})">${wm(C["birch-100"]).svg}</g>`;
  const lineT = textPath(atkinson, line, 29 * unit, 0, 0, C["gold-300"]);
  const lineSvg = `<g transform="translate(${80 * unit} ${h * 0.44 + 70 * unit})">${lineT.svg}</g>`;
  const sub = title ? textPath(atkinson, title, 26 * unit, 0, 0, C["dusk-300"]) : null;
  const subSvg = sub ? `<g transform="translate(${80 * unit} ${h - 60 * unit})">${sub.svg}</g>` : "";
  const ground = `<path d="M0 ${h * 0.86} C ${w * 0.3} ${h * 0.82}, ${w * 0.6} ${h * 0.9}, ${w} ${h * 0.84} L ${w} ${h} L 0 ${h} Z" fill="${C["pine-700"]}" opacity="0.55"/>`;
  return svgDoc(`<defs>${grainDefs("g", 0.07)}</defs><rect width="${w}" height="${h}" fill="${bg}"/>${ground}${grainRect("g", w, h)}${marks}${labels}${titleSvg}${lineSvg}${subSvg}`, { w, h });
}
write("export/social/og-image-1200x630.png", png(banner(1200, 630, { line: "If enough friends say yes, it's on.", title: "Snap where you are. Friends say yes in private. Go outside." }), 1200));
write("export/social/dev-cover-1000x420.png", png(banner(1000, 420, { line: "If enough friends say yes, it's on.", title: "Hacktoberfest Week 1: Touch Grass" }), 1000));

// ---------- Texture tile ----------
write("texture/paper-grain.svg", svgDoc(`<defs>${grainDefs("g", 0.08)}</defs>${grainRect("g", 256, 256)}`, { w: 256, h: 256 }));
write("texture/paper-grain-256.png", png(svgDoc(`<defs>${grainDefs("g", 0.08)}</defs>${grainRect("g", 256, 256)}`, { w: 256, h: 256 }), 256));

// ---------- Tokens ----------
const tokens = { color: C, role: roles,
  font: { display: "Fraunces", body: "Atkinson Hyperlegible Next", fallbackDisplay: "Georgia, 'Times New Roman', serif", fallbackBody: "system-ui, -apple-system, 'Segoe UI', sans-serif" },
  type: { // px at 100% Dynamic Type; scale with rem
    display: { size: 40, line: 44, weight: 600, family: "display" }, title: { size: 28, line: 34, weight: 600, family: "display" },
    heading: { size: 22, line: 28, weight: 700, family: "body" }, body: { size: 18, line: 26, weight: 400, family: "body" },
    label: { size: 16, line: 22, weight: 700, family: "body" }, small: { size: 15, line: 20, weight: 400, family: "body" },
    sun: { size: 22, line: 30, weight: 700, family: "body" } },
  radius: { sm: 8, md: 14, lg: 22, pill: 999 }, space: [0, 4, 8, 12, 16, 24, 32, 48, 64], touchTarget: 44,
  motion: { quick: 160, base: 260, slow: 480, easeOut: "cubic-bezier(0.2, 0.8, 0.2, 1)", easeInOut: "cubic-bezier(0.6, 0, 0.3, 1)" } };
write("tokens/tokens.json", JSON.stringify(tokens, null, 2) + "\n");
const cssVars = (mode) => Object.entries(roles[mode]).map(([k, v]) => `  --flare-${k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())}: ${C[v]};`).join("\n");
write("tokens/tokens.css", `/* Flare design tokens. Generated by brand/tools/build.mjs; edit palette.mjs, not this file. */
:root {
${Object.entries(C).map(([k, v]) => `  --flare-${k}: ${v};`).join("\n")}
  --flare-font-display: "Fraunces", Georgia, "Times New Roman", serif;
  --flare-font-body: "Atkinson Hyperlegible Next", system-ui, -apple-system, "Segoe UI", sans-serif;
  --flare-radius-sm: 8px; --flare-radius-md: 14px; --flare-radius-lg: 22px;
  --flare-touch: 44px;
  --flare-ease-out: cubic-bezier(0.2, 0.8, 0.2, 1);
  --flare-dur-quick: 160ms; --flare-dur-base: 260ms; --flare-dur-slow: 480ms;
${cssVars("light")}
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]):not([data-sun]) {
${cssVars("dark").replace(/^/gm, "  ")}
  }
}
:root[data-theme="dark"]:not([data-sun]) {
${cssVars("dark")}
}
/* Sun mode: outdoor screens (Lit, compass, Ember) force the light roles and larger text,
   because dark pairs lose most of their contrast in daylight (docs/brand/contrast.md). */
:root[data-sun] {
${cssVars("light")}
  --flare-text-scale: 1.15;
}
@media (prefers-reduced-motion: reduce) {
  :root { --flare-dur-quick: 0ms; --flare-dur-base: 0ms; --flare-dur-slow: 0ms; }
}
`);

// ---------- Fonts (OFL) copied for the app and site ----------
const fontPick = [
  ["@fontsource/fraunces", ["fraunces-latin-400-normal.woff2", "fraunces-latin-600-normal.woff2", "fraunces-latin-400-italic.woff2"]],
  ["@fontsource/atkinson-hyperlegible-next", ["atkinson-hyperlegible-next-latin-400-normal.woff2", "atkinson-hyperlegible-next-latin-700-normal.woff2", "atkinson-hyperlegible-next-latin-400-italic.woff2"]],
];
for (const [pkg, files] of fontPick) {
  const dir = path.join(HERE, "node_modules", pkg);
  for (const f of files) fs.copyFileSync(path.join(dir, "files", f), out("fonts", f));
  fs.copyFileSync(path.join(dir, "LICENSE"), out("fonts", `LICENSE-${pkg.split("/")[1]}.txt`));
}

// ---------- Contact sheet (for review) ----------
const cells = [];
const add = (svgBody, bg, label) => cells.push({ svgBody, bg, label });
for (const n of Object.keys(state)) add(state[n](C[roles.light[n]]), C["birch-100"], n);
for (const n of Object.keys(state)) add(state[n](C[roles.dark[n]]) + (n === "lit" ? glowDot(C["gold-400"]) : ""), C["dusk-900"], n);
const iconRow = Object.entries(icons).map(([n, b], i) => `<g transform="translate(${20 + i * 46} 470) scale(1.4)"><g fill="none" stroke="${C["ink-900"]}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${b}</g></g>`).join("");
const sheet = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 640" width="1520" height="1280"><rect width="760" height="640" fill="#fff"/>
${cells.map((c, i) => `<g transform="translate(${20 + (i % 4) * 120} ${20 + Math.floor(i / 4) * 120})"><rect width="110" height="110" rx="10" fill="${c.bg}"/><g transform="translate(5 5)">${c.svgBody}</g></g>`).join("")}
<g transform="translate(510 20) scale(0.2)">${appIcon(1024).replace(/<\/?svg[^>]*>/g, "")}</g>
<g transform="translate(510 240) scale(0.2)">${appIcon(1024, { maskable: true }).replace(/<\/?svg[^>]*>/g, "")}<circle cx="512" cy="512" r="409.6" fill="none" stroke="#fff" stroke-width="6" stroke-dasharray="20 14"/></g>
<g transform="translate(20 280) scale(0.9)">${lockup(C["maple-600"], C["ink-900"]).replace(/<\/?svg[^>]*>|<title>.*?<\/title>/g, "")}</g>
${iconRow}
<g transform="translate(20 540)">${Object.entries(C).map(([k, v], i) => `<rect x="${i * 38}" width="34" height="34" rx="6" fill="${v}" stroke="#0002"/>`).join("")}</g>
</svg>`;
write("export/contact-sheet.png", png(sheet, 1520));

console.log("Built:", ["logo", "icons", "icon", "export", "texture", "tokens", "fonts"].map((d) => `${d}=${fs.readdirSync(path.join(BRAND, d), { recursive: true }).filter((f) => /\.\w+$/.test(f)).length}`).join(" "));
