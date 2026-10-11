// The branded card the bot posts by default (founder decision, Sun 2026-10-11; ADR-0023):
// the flame for the gathering's state, the six words, the place label and the count line.
// Nothing personal: no host name, no member names, no real photo. Rendered in memory as a
// PNG with resvg (WASM, no native binary) and the website's fonts; never written to disk.
import fs from "node:fs";
import { createRequire } from "node:module";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import { woffToSfnt } from "./woff.ts";

/** Flame geometry, the same as apps/web/src/lib/brand.ts (a test keeps them equal). */
export const FLAME =
  "M55 4 C61 20 80 34 80 60 C80 81 66 96 50 96 C34 96 20 81 20 60 C20 45 29 35 37 27 C37 37 41 43 46 45 C43 31 48 16 55 4 Z";
export const HOLE = { cx: 50, cy: 67, r: 12 };
export const DOME = "M17 86 C17 68 32 60 50 60 C68 60 83 68 83 86 C83 92 74 95 50 95 C26 95 17 92 17 86 Z";
const ring = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0 Z`;

/** Light theme tokens (design/system/tokens.css). */
const C = {
  bg: "#F6F1E7", // birch-100
  surface: "#FBF8F2", // birch-50
  ink: "#211A16", // ink-900
  muted: "#4A3F38", // ink-700
  maple: "#D9531E", // maple-600: kindling, lit
  mapleText: "#A93C12", // maple-700
  ember: "#9E2C17", // ember-700
  gold: "#F2B33D", // gold-400
  gone: "#6F7987", // smoke-500
};

export type CardState = "kindling" | "lit" | "ember" | "gone";
export type CardView = {
  state: CardState;
  /** The six words. */
  invite: string;
  /** The place label the group already sees in the caption. */
  place: string;
  /** "Need 2 more.", "It's lit.", "Need 1 more." (Ember) or "Thanks for coming." */
  status: string;
  /** Kindling growth, 0 to 1 (the app's Flame `progress`). */
  progress?: number;
  brand: string;
};

export const CARD = { w: 1200, h: 800 };

let ready: Promise<{ fonts: Uint8Array[] }> | null = null;
function init() {
  ready ??= (async () => {
    const require = createRequire(import.meta.url);
    await initWasm(fs.readFileSync(require.resolve("@resvg/resvg-wasm/index_bg.wasm")));
    const face = (p: string) => woffToSfnt(fs.readFileSync(require.resolve(p)));
    return {
      fonts: [
        face("@fontsource/fraunces/files/fraunces-latin-600-normal.woff"),
        face("@fontsource/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-400-normal.woff"),
        face("@fontsource/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-700-normal.woff"),
      ],
    };
  })();
  return ready;
}

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Greedy word wrap by an average glyph width; long single words are cut with an ellipsis. */
export function wrap(text: string, size: number, width: number, maxLines: number, em = 0.54): string[] {
  const per = Math.max(4, Math.floor(width / (size * em)));
  const lines: string[] = [];
  let cur = "";
  for (const word of text.trim().split(/\s+/)) {
    const next = cur ? `${cur} ${word}` : word;
    if (next.length <= per) cur = next;
    else {
      if (cur) lines.push(cur);
      cur = word.length > per ? `${word.slice(0, per - 1)}…` : word;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    const last = kept[maxLines - 1] as string;
    kept[maxLines - 1] = `${last.length >= per ? last.slice(0, per - 1) : last}…`;
    return kept;
  }
  return lines;
}

function flameArt(view: CardView): string {
  const s = view.state;
  if (s === "kindling" || s === "lit") {
    const scale = s === "kindling" ? 0.55 + 0.35 * Math.min(1, Math.max(0, view.progress ?? 0.5)) : 1;
    const dot = s === "lit" ? `<circle cx="${HOLE.cx}" cy="${HOLE.cy}" r="6" fill="${C.gold}"/>` : "";
    return `<g transform="translate(50 96) scale(${scale}) translate(-50 -96)"><path fill-rule="evenodd" fill="${C.maple}" d="${FLAME} ${ring(HOLE.cx, HOLE.cy, HOLE.r)}"/>${dot}</g>`;
  }
  if (s === "ember") return `<path fill-rule="evenodd" fill="${C.ember}" d="${DOME} ${ring(50, 81, 8)}"/>`;
  return `<g fill="none" stroke="${C.gone}"><circle cx="50" cy="86" r="7" stroke-width="3" stroke-dasharray="3.2 3.2" opacity="0.7"/><path d="M50 76 C41 67 59 60 51 49 C45 40 58 33 61 22" stroke-width="5" stroke-linecap="round"/><path d="M66 18 C70 13 67 8 72 3" stroke-width="4" stroke-linecap="round" opacity="0.5"/></g>`;
}

// fontsource's Fraunces 600 file names its family "Fraunces SemiBold" with a Regular style.
/** The card as SVG (exported for tests and previews). */
export function cardSvg(view: CardView): string {
  const textX = 500;
  const width = CARD.w - textX - 80;
  const invite = wrap(view.invite, 68, width, 3);
  const place = wrap(view.place, 36, width, 2, 0.5);
  const lead = 78;
  let y = 400 - ((invite.length - 1) * lead) / 2 - 40;
  const inviteSvg = invite
    .map(
      (l, i) =>
        `<text x="${textX}" y="${y + i * lead}" font-family="Fraunces SemiBold" font-size="68" fill="${C.ink}">${xml(l)}</text>`,
    )
    .join("");
  y += (invite.length - 1) * lead + 64;
  const placeSvg = place
    .map(
      (l, i) =>
        `<text x="${textX}" y="${y + i * 46}" font-family="Atkinson Hyperlegible Next" font-size="36" fill="${C.muted}">${xml(l)}</text>`,
    )
    .join("");
  y += (place.length - 1) * 46 + 72;
  const statusColor = view.state === "gone" ? C.muted : view.state === "ember" ? C.ember : C.mapleText;
  const status = `<text x="${textX}" y="${y}" font-family="Atkinson Hyperlegible Next" font-weight="700" font-size="40" fill="${statusColor}">${xml(view.status)}</text>`;
  const glow =
    view.state === "lit"
      ? `<radialGradient id="g" cx="0.5" cy="0.6" r="0.5"><stop offset="0" stop-color="${C.gold}" stop-opacity="0.45"/><stop offset="1" stop-color="${C.gold}" stop-opacity="0"/></radialGradient><circle cx="250" cy="430" r="250" fill="url(#g)"/>`
      : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD.w}" height="${CARD.h}" viewBox="0 0 ${CARD.w} ${CARD.h}">
<rect width="${CARD.w}" height="${CARD.h}" fill="${C.bg}"/>
<clipPath id="card"><rect x="40" y="40" width="${CARD.w - 80}" height="${CARD.h - 80}" rx="40"/></clipPath>
<rect x="40" y="40" width="${CARD.w - 80}" height="${CARD.h - 80}" rx="40" fill="${C.surface}"/>
<g clip-path="url(#card)">${glow}</g>
<g transform="translate(90 190) scale(3.6)">${flameArt(view)}</g>
${inviteSvg}${placeSvg}${status}
<text x="${CARD.w - 90}" y="${CARD.h - 80}" text-anchor="end" font-family="Fraunces SemiBold" font-size="34" fill="${C.mapleText}">${xml(view.brand)}</text>
</svg>`;
}

/** The card as PNG bytes, in memory. */
export async function renderCard(view: CardView): Promise<Buffer> {
  const { fonts } = await init();
  const r = new Resvg(cardSvg(view), {
    font: { fontBuffers: fonts, loadSystemFonts: false, defaultFontFamily: "Atkinson Hyperlegible Next" },
    fitTo: { mode: "original" },
  });
  const png = r.render().asPng();
  return Buffer.from(png);
}
