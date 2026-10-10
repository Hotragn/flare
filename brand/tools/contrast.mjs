// Checks every text and UI pair Flare uses, indoors and in bright outdoor light.
//
// Indoor: WCAG 2.2 contrast ratio, (L1 + 0.05) / (L2 + 0.05).
// Outdoor: ambient contrast ratio, (L1 + R) / (L2 + R), where R is light the
// screen reflects, as a fraction of the display's white. R = 0.15 models a
// phone in bright daylight in the shade or on an overcast day at full
// brightness; R = 0.40 models open afternoon sun. It is a model, not a
// standard, so we use it to rank pairs, and keep WCAG as the pass rule.
//
// Usage: node contrast.mjs [--md path]   (writes a markdown table if --md)
import fs from "node:fs";
import { colors, roles } from "./palette.mjs";

const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
};
const ratio = (a, b, k) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + k) / (y + k); };

// [name, foreground role/color, background role/color, use, minimum WCAG ratio]
const pairs = [];
for (const mode of ["light", "dark"]) {
  const r = roles[mode];
  pairs.push(
    [mode, "text", r.text, r.bg, "Body text", 7],
    [mode, "text on surface", r.text, r.surface, "Body text on cards", 7],
    [mode, "textMuted", r.textMuted, r.bg, "Secondary text", 4.5],
    [mode, "accentText", r.accentText, r.bg, "Links, small accent text", 4.5],
    [mode, "onAccent", r.onAccent, r.accentBg, "Button label on accent button", 4.5],
    [mode, "lit", r.lit, r.bg, "Lit flame, large UI", 3],
    [mode, "kindling", r.kindling, r.bg, "Kindling flame, large UI", 3],
    [mode, "ember", r.ember, r.bg, "Ember glow, large UI", 3],
    [mode, "gone", r.gone, r.bg, "Smoke, large UI", 3],
    [mode, "positive", r.positive, r.bg, "Positive text", 4.5],
    [mode, "line", r.line, r.bg, "Dividers (decorative)", 1],
  );
}

const rows = pairs.map(([mode, role, fgk, bgk, use, min]) => {
  const fg = colors[fgk], bg = colors[bgk];
  const wcag = ratio(fg, bg, 0.05), shade = ratio(fg, bg, 0.15), sun = ratio(fg, bg, 0.40);
  return { mode, role, fgk, bgk, fg, bg, use, min, wcag, shade, sun, pass: wcag >= min };
});

const fmt = (n) => n.toFixed(2);
let fails = 0;
for (const r of rows) {
  if (!r.pass) fails++;
  console.log(`${r.pass ? "PASS" : "FAIL"} ${r.mode.padEnd(5)} ${r.role.padEnd(16)} ${r.fgk.padEnd(10)} on ${r.bgk.padEnd(10)} WCAG ${fmt(r.wcag).padStart(5)} (min ${r.min})  shade ${fmt(r.shade)}  sun ${fmt(r.sun)}`);
}
const mdIdx = process.argv.indexOf("--md");
if (mdIdx > 0) {
  const lines = ["| Mode | Role | Foreground | Background | Use | WCAG | Min | Outdoor shade (R 0.15) | Open sun (R 0.40) | Result |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |"];
  for (const r of rows) lines.push(`| ${r.mode} | ${r.role} | \`${r.fgk}\` ${r.fg} | \`${r.bgk}\` ${r.bg} | ${r.use} | ${fmt(r.wcag)} | ${r.min} | ${fmt(r.shade)} | ${fmt(r.sun)} | ${r.pass ? "Pass" : "**Fail**"} |`);
  fs.writeFileSync(process.argv[mdIdx + 1], lines.join("\n") + "\n");
}
if (fails) { console.error(`${fails} pair(s) fail`); process.exit(1); }
console.log(`All ${rows.length} pairs pass.`);
