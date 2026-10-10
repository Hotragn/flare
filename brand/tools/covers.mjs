// Share-image directions for Flare: DEV cover (1000 x 420) and OG (1200 x 630).
// Usage: node covers.mjs            renders all directions into export/social/directions/
//        node covers.mjs --final A  also writes the chosen direction as the shipped images
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import { colors as C } from "./palette.mjs";
import { flamePath, glowDot, state, svgDoc, textPath, fraunces, atkinson, wm, WM, WM_SIZE } from "./shared.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, "../export/social");
const png = (svg, w) => new Resvg(svg, { fitTo: { mode: "width", value: w } }).render().asPng();

// Visible paper grain: fractal noise, multiplied in at the given strength.
const grain = (id, a) => `<filter id="${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="3" seed="11" stitchTiles="stitch" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0.12  0 0 0 0 0.09  0 0 0 0 0.07  0 0 0 ${a} 0"/></filter>`;
const fibers = (id, a) => `<filter id="${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.02 0.4" numOctaves="2" seed="3" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 0.98  0 0 0 0 0.94  0 0 0 ${a} 0"/></filter>`;

const LEAF = "M10 1 L12 6 L16 4 L15 9 L19 10 L15 12 L16 15 L11 13 L10.6 19 L9.4 19 L9 13 L4 15 L5 12 L1 10 L5 9 L4 4 L8 6 Z";
const leaf = (x, y, s, rot, fill) => `<path d="${LEAF}" fill="${fill}" transform="translate(${x} ${y}) rotate(${rot} 10 10) scale(${s})"/>`;
const at = (x, y, s, body) => `<g transform="translate(${x} ${y}) scale(${s})">${body}</g>`;

// Two-line tagline in Fraunces, left aligned.
function tagline(lines, size, x, y, fill, lead = 1.08) {
  return lines.map((l, i) => { const t = textPath(fraunces, l, size, 0, 0, fill, -0.012); return `<g transform="translate(${x} ${y + i * size * lead})">${t.svg}</g>`; }).join("");
}
const word = (x, y, h, fill) => `<g transform="translate(${x} ${y}) scale(${h / -WM.top})">${wm(fill).svg}</g>`; // h = ascender height
const label = (text, size, x, y, fill) => `<g transform="translate(${x} ${y})">${textPath(atkinson, text, size, 0, 0, fill).svg}</g>`;

// ---------- Direction A: Golden hour (illustrated scene) ----------
// Dusk sky stays dark behind the text (birch on dusk >= 7:1); the warm bands
// sit low, near the sun. Friends sit by the Lit fire at the bench.
function goldenHour(W, H) {
  const k = H / 420; const s = (v) => v * k;
  const horizon = H * 0.64;
  const dark = ["#22324D", "#283A57", "#2E4A6B", "#3A4F6D"];
  const warm = ["#7C5B5E", "#B0643F", "#D6762F", "#EC9A33", "#F2B33D", "#F7CB72"];
  const darkH = H * 0.44 / dark.length, warmH = (horizon - H * 0.44) / warm.length;
  const bands = dark.map((c, i) => `<rect y="${i * darkH}" width="${W}" height="${darkH + 1}" fill="${c}"/>`).join("")
    + warm.map((c, i) => `<rect y="${H * 0.44 + i * warmH}" width="${W}" height="${warmH + 1}" fill="${c}"/>`).join("");
  const sunX = W * 0.56;
  const sun = `<circle cx="${sunX}" cy="${horizon}" r="${s(70)}" fill="${C["gold-300"]}" opacity="0.35"/><circle cx="${sunX}" cy="${horizon}" r="${s(48)}" fill="${C["gold-300"]}"/>`;
  const farHills = `<path d="M0 ${horizon} C ${W * 0.15} ${horizon - s(28)}, ${W * 0.3} ${horizon - s(6)}, ${W * 0.45} ${horizon - s(22)} C ${W * 0.6} ${horizon - s(40)}, ${W * 0.8} ${horizon - s(8)}, ${W} ${horizon - s(26)} L ${W} ${H} L 0 ${H} Z" fill="#3D4F66"/>`;
  const midHills = `<path d="M0 ${horizon + s(22)} C ${W * 0.2} ${horizon + s(2)}, ${W * 0.42} ${horizon + s(28)}, ${W * 0.62} ${horizon + s(10)} C ${W * 0.78} ${horizon - s(4)}, ${W * 0.9} ${horizon + s(16)}, ${W} ${horizon + s(6)} L ${W} ${H} L 0 ${H} Z" fill="${C["pine-500"]}"/>`;
  const groundY = H * 0.80;
  const ground = `<path d="M0 ${groundY + s(8)} C ${W * 0.3} ${groundY - s(14)}, ${W * 0.6} ${groundY + s(20)}, ${W} ${groundY - s(8)} L ${W} ${H} L 0 ${H} Z" fill="${C["pine-700"]}"/>`;
  const pathShape = `<path d="M${W * 0.30} ${H} C ${W * 0.40} ${H * 0.90}, ${W * 0.56} ${H * 0.90}, ${W * 0.66} ${H * 0.82} L ${W * 0.70} ${H * 0.82} C ${W * 0.64} ${H * 0.90}, ${W * 0.56} ${H * 0.97}, ${W * 0.50} ${H} Z" fill="${C["birch-200"]}" opacity="0.92"/>`;
  // Bench, three friends, the Lit fire
  const bx = W * 0.60, by = H * 0.80;
  const ink = C["ink-900"];
  const bench = `<g fill="${ink}"><rect x="${bx}" y="${by - s(24)}" width="${s(92)}" height="${s(6)}" rx="${s(2)}"/><rect x="${bx}" y="${by - s(12)}" width="${s(92)}" height="${s(6)}" rx="${s(2)}"/><rect x="${bx + s(6)}" y="${by - s(12)}" width="${s(5)}" height="${s(16)}"/><rect x="${bx + s(81)}" y="${by - s(12)}" width="${s(5)}" height="${s(16)}"/></g>`;
  const person = (x, seatY, h, c) => `<g fill="${c}"><circle cx="${x}" cy="${seatY - h}" r="${s(8)}"/><rect x="${x - s(9)}" y="${seatY - h + s(10)}" width="${s(18)}" height="${h - s(8)}" rx="${s(8)}"/></g>`;
  const people = person(bx + s(22), by - s(10), s(40), ink) + person(bx + s(48), by - s(10), s(44), "#2A2420") + person(bx + s(196), by + s(2), s(54), ink);
  const lit = at(bx + s(96), by - s(88), s(84) / 100, flamePath(C["maple-500"]) + glowDot(C["gold-400"]));
  // A friend on the way: Kindling on the path. Ember and smoke on the far hill.
  const kindling = at(W * 0.45, H * 0.94 - s(52), s(50) / 100, state.kindling(C["gold-400"]));
  const ember = at(W * 0.40, horizon - s(40), s(48) / 100, state.ember(C["maple-600"]));
  const gone = at(W * 0.47, horizon - s(92), s(56) / 100, state.gone("#C9C2B4"));
  // Birch trees framing the right edge
  const birch = (x, h, w) => `<g><rect x="${x}" y="${groundY - h}" width="${w}" height="${h + s(40)}" fill="${C["birch-50"]}"/>${[0.18, 0.36, 0.54, 0.7, 0.86].map((f, i) => `<rect x="${x + (i % 2 ? w * 0.45 : 0)}" y="${groundY - h * (1 - f)}" width="${w * 0.55}" height="${s(2.4)}" fill="${ink}"/>`).join("")}<circle cx="${x + w / 2 - s(14)}" cy="${groundY - h + s(4)}" r="${s(26)}" fill="${C["gold-400"]}"/><circle cx="${x + w / 2 + s(16)}" cy="${groundY - h + s(14)}" r="${s(22)}" fill="${C["maple-500"]}"/><circle cx="${x + w / 2}" cy="${groundY - h - s(16)}" r="${s(18)}" fill="${C["maple-600"]}"/></g>`;
  const trees = birch(W * 0.935, s(200), s(11)) + birch(W * 0.885, s(150), s(8));
  const leaves = [[0.50, 0.12, 1.0, 20, "maple-500"], [0.70, 0.38, 0.8, -30, "gold-400"], [0.74, 0.08, 0.9, 60, "maple-500"], [0.84, 0.30, 0.8, -10, "gold-400"], [0.12, 0.86, 1.2, 40, "gold-400"], [0.22, 0.93, 0.9, -50, "maple-500"], [0.42, 0.97, 1.0, 15, "ember-700"], [0.97, 0.94, 1.1, 75, "gold-400"]]
    .map(([x, y, sc, r, c]) => leaf(W * x, H * y, sc * k * 1.4, r, C[c])).join("");
  const text = word(s(56), s(70), s(34), C["gold-300"]) + tagline(["If enough friends", "say yes, it's on."], s(54), s(54), s(132), C["birch-50"], 1.04);
  return svgDoc(`<defs>${grain("g", 0.22)}</defs>${bands}${sun}${farHills}${gone}${ember}${midHills}${ground}${pathShape}${trees}${bench}${people}${lit}${kindling}${leaves}${text}<rect width="${W}" height="${H}" filter="url(#g)"/>`, { w: W, h: H });
}

// ---------- Direction B: Cut paper ----------
function cutPaper(W, H) {
  const k = H / 420; const s = (v) => v * k;
  const layer = (y, amp, fill, phase = 0) => `<path d="M0 ${y} C ${W * 0.2} ${y - amp}, ${W * 0.35} ${y + amp * 0.6}, ${W * (0.55 + phase)} ${y - amp * 0.4} S ${W * 0.85} ${y + amp}, ${W} ${y - amp * 0.3} L ${W} ${H} L 0 ${H} Z" fill="${fill}"/>`;
  const hills = layer(H * 0.56, s(40), C["gold-400"]) + layer(H * 0.66, s(36), C["maple-600"], 0.08) + layer(H * 0.76, s(30), C["ember-700"], -0.06) + layer(H * 0.86, s(24), C["pine-700"], 0.04);
  const st = ["kindling", "lit", "ember", "gone"];
  const size = s(70);
  const row = st.map((n, i) => at(W * 0.56 + i * s(96), H * 0.86 - size - s(6), size / 100, n === "lit" ? flamePath(C["birch-50"]) + glowDot(C["gold-400"]) : state[n](C["birch-50"]))).join("");
  const text = word(s(56), s(80), s(34), C["ink-900"]) + tagline(["If enough friends", "say yes, it's on."], s(48), s(56), s(150), C["ink-900"]);
  return svgDoc(`<defs>${grain("g", 0.26)}${fibers("f", 0.10)}</defs><rect width="${W}" height="${H}" fill="${C["birch-100"]}"/>${hills}${row}${text}<rect width="${W}" height="${H}" filter="url(#f)"/><rect width="${W}" height="${H}" filter="url(#g)"/>`, { w: W, h: H });
}

// ---------- Direction C: Bold type ----------
function boldType(W, H) {
  const k = H / 420; const s = (v) => v * k;
  const leaves = Array.from({ length: 16 }, (_, i) => { const x = (i * 137) % 100 / 100, y = (i * 61) % 100 / 100; return leaf(W * (0.55 + x * 0.45), H * y, (0.9 + (i % 3) * 0.35) * k * 1.4, i * 47, [C["gold-400"], C["maple-500"], C["ember-700"]][i % 3]); }).join("");
  const mark = at(W * 0.68, H * 0.10, s(300) / 100, flamePath(C["maple-500"]) + glowDot(C["gold-400"]));
  const text = tagline(["If enough", "friends say yes,", "it's on."], s(62), s(56), s(110), C["birch-50"], 1.02) + word(s(58), H - s(42), s(28), C["gold-300"]);
  return svgDoc(`<defs>${grain("g", 0.24)}</defs><rect width="${W}" height="${H}" fill="${C["maple-700"]}"/>${leaves}${mark}${text}<rect width="${W}" height="${H}" filter="url(#g)"/>`, { w: W, h: H });
}

const DIRS = { A: ["golden-hour", goldenHour], B: ["cut-paper", cutPaper], C: ["bold-type", boldType] };
fs.mkdirSync(path.join(OUT, "directions"), { recursive: true });
for (const [key, [name, fn]] of Object.entries(DIRS)) {
  fs.writeFileSync(path.join(OUT, "directions", `${key}-${name}-dev-1000x420.png`), png(fn(1000, 420), 1000));
  fs.writeFileSync(path.join(OUT, "directions", `${key}-${name}-og-1200x630.png`), png(fn(1200, 630), 1200));
}
const fi = process.argv.indexOf("--final");
if (fi > 0) {
  const [name, fn] = DIRS[process.argv[fi + 1]];
  fs.writeFileSync(path.join(OUT, "dev-cover-1000x420.png"), png(fn(1000, 420), 1000));
  fs.writeFileSync(path.join(OUT, "og-image-1200x630.png"), png(fn(1200, 630), 1200));
  fs.writeFileSync(path.join(OUT, "dev-cover-1000x420.svg"), fn(1000, 420));
  console.log("Final:", name);
}
console.log("Directions rendered.");
