// Large-print Bench to Bench card as a PDF (SRS-REST-5): body text 20 pt (≥ 18), black on
// white (contrast 21:1, ≥ 7:1), numbered turns with bench distances, restrooms and water, and
// "Check the path. Map data can be wrong." No dependencies: a small PDF 1.4 writer using the
// built-in Helvetica fonts with WinAnsi encoding. Spec: docs/maps/05-rest-loops.md.
import { fmt } from "./copy.ts";
import type { Loop } from "./loop.ts";

export const PAGE = { w: 612, h: 792, margin: 54 }; // US Letter, 0.75 in margins
export const SIZE = { title: 30, body: 20, small: 18 };
const LEAD = 1.3;

// Helvetica advance widths (Adobe AFM, 1/1000 em) for ASCII 32..126.
const W = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556,
  556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833,
  722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556,
  556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334,
  260, 334, 584,
];

/** Width in points; bold is estimated 8% wider (Helvetica-Bold runs about 5 to 8% wider). */
export function textWidth(s: string, size: number, bold = false): number {
  let u = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 63;
    u += c >= 32 && c <= 126 ? (W[c - 32] as number) : 600;
  }
  return (u / 1000) * size * (bold ? 1.08 : 1);
}

/** Greedy word wrap to `max` points. A word longer than a line is left whole. */
export function wrap(s: string, size: number, max: number, bold = false): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of s.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && textWidth(next, size, bold) > max) {
      out.push(line);
      line = word;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

// WinAnsi bytes for the few non-ASCII characters our copy uses.
const WIN: Record<string, number> = {
  "’": 0x92,
  "‘": 0x91,
  "“": 0x93,
  "”": 0x94,
  "–": 0x96,
  "—": 0x97,
  "·": 0xb7,
  "©": 0xa9,
  "°": 0xb0,
  é: 0xe9,
  "…": 0x85,
};

function pdfString(s: string): string {
  let out = "";
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 63;
    const b = c >= 32 && c <= 126 ? c : (WIN[ch] ?? 63);
    if (b === 0x28 || b === 0x29 || b === 0x5c) out += `\\${String.fromCharCode(b)}`;
    else if (b > 126) out += `\\${b.toString(8).padStart(3, "0")}`;
    else out += String.fromCharCode(b);
  }
  return `(${out})`;
}

export type CardLine = { text: string; size: number; bold: boolean; gapBefore?: number };

/** The card's lines in reading order. Also used for the on-screen preview and for speech. */
export function cardLines(loop: Loop, place: string): CardLine[] {
  const lines: CardLine[] = [
    { text: fmt("loop.card.title", { min: loop.minutes, place }), size: SIZE.title, bold: true },
    {
      text: fmt("loop.summary", {
        min: loop.minutes,
        km: (loop.length_m / 1000).toFixed(1),
        n: loop.rests.filter((r) => r.place).length,
      }),
      size: SIZE.body,
      bold: false,
    },
  ];
  loop.turns.forEach((t, i) => {
    lines.push({ text: `${i + 1}. ${t.text}`, size: SIZE.body, bold: false, gapBefore: i === 0 ? 12 : 4 });
  });
  lines.push({ text: fmt("loop.warn"), size: SIZE.body, bold: true, gapBefore: 18 });
  lines.push({ text: fmt("site.foot.osm"), size: SIZE.small, bold: false, gapBefore: 6 });
  return lines;
}

/** Build the PDF bytes. Pages break between lines; a wrapped line keeps a hanging indent. */
export function cardPdf(loop: Loop, place: string): Uint8Array {
  const max = PAGE.w - 2 * PAGE.margin;
  const pages: string[][] = [[]];
  let y = PAGE.h - PAGE.margin;
  for (const l of cardLines(loop, place)) {
    const indent = /^\d+\. /.test(l.text) ? textWidth("00. ", l.size) : 0;
    const parts = wrap(l.text, l.size, max - indent, l.bold);
    y -= l.gapBefore ?? 0;
    parts.forEach((p, k) => {
      y -= l.size * LEAD;
      if (y < PAGE.margin) {
        pages.push([]);
        y = PAGE.h - PAGE.margin - l.size * LEAD;
      }
      const x = PAGE.margin + (k > 0 ? indent : 0);
      (pages[pages.length - 1] as string[]).push(
        `BT /${l.bold ? "F2" : "F1"} ${l.size} Tf 0 0 0 rg ${x.toFixed(2)} ${y.toFixed(2)} Td ${pdfString(p)} Tj ET`,
      );
    });
  }

  // Objects: 1 catalog, 2 pages, 3 F1, 4 F2, then (page, content) pairs.
  const objs: string[] = [];
  const kids = pages.map((_, i) => `${5 + 2 * i} 0 R`).join(" ");
  objs.push("<< /Type /Catalog /Pages 2 0 R >>");
  objs.push(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);
  objs.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  objs.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  pages.forEach((ops, i) => {
    objs.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE.w} ${PAGE.h}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + 2 * i} 0 R >>`,
    );
    const stream = `1 1 1 rg 0 0 ${PAGE.w} ${PAGE.h} re f\n${ops.join("\n")}`;
    objs.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });
  let out = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info << /Title ${pdfString(fmt("loop.card.title", { min: loop.minutes, place }))} /Producer (Flare) >> >>\nstartxref\n${xref}\n%%EOF\n`;
  // Every char is one byte (WinAnsi escapes are octal), so latin1 bytes = offsets above.
  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
  return bytes;
}

/** WCAG contrast ratio of two sRGB colours given as [r, g, b] in 0..255. */
export function contrast(a: [number, number, number], b: [number, number, number]): number {
  const lum = (c: [number, number, number]) => {
    const [r, g, bl] = c.map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

/** Card colours, checked by the test: text black on white. */
export const CARD_COLORS = {
  text: [0, 0, 0] as [number, number, number],
  page: [255, 255, 255] as [number, number, number],
};
