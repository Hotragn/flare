// Builds Flare's design-system tokens (CSS variables + JSON) from the brand
// palette plus the UI scales: type, space, radius, elevation, motion, layout.
// Usage: node design/system/build-tokens.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { colors, roles } from "../../brand/tools/palette.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const kebab = (k) => k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());

const tokens = {
  color: colors,
  role: roles,
  font: {
    display: '"Fraunces", Georgia, "Times New Roman", serif',
    body: '"Atkinson Hyperlegible Next", system-ui, -apple-system, "Segoe UI", sans-serif',
  },
  // rem-based so iOS Dynamic Type (via -apple-system-body) and browser zoom scale it.
  type: {
    display: { size: "2.5rem", line: 1.1, weight: 600, family: "display", tracking: "-0.01em" },
    title: { size: "1.75rem", line: 1.2, weight: 600, family: "display", tracking: "-0.005em" },
    heading: { size: "1.375rem", line: 1.27, weight: 700, family: "body", tracking: "0" },
    body: { size: "1.125rem", line: 1.45, weight: 400, family: "body", tracking: "0" },
    label: { size: "1.0625rem", line: 1.3, weight: 700, family: "body", tracking: "0.005em" },
    small: { size: "0.9375rem", line: 1.35, weight: 400, family: "body", tracking: "0" },
    sun: { size: "1.375rem", line: 1.35, weight: 700, family: "body", tracking: "0" },
    invite: { size: "2rem", line: 1.12, weight: 600, family: "display", tracking: "-0.01em" },
  },
  space: { 0: "0", 1: "4px", 2: "8px", 3: "12px", 4: "16px", 5: "20px", 6: "24px", 7: "32px", 8: "40px", 9: "48px", 10: "64px" },
  radius: { sm: "8px", md: "14px", lg: "22px", xl: "32px", pill: "999px", photo: "18px" },
  // Elevation without blur clichés: crisp, warm, low shadows (brand: no glass, no glow).
  elevation: {
    0: "none",
    1: "0 1px 0 rgba(33,26,22,0.08), 0 1px 2px rgba(33,26,22,0.10)",
    2: "0 2px 0 rgba(33,26,22,0.06), 0 6px 14px -6px rgba(33,26,22,0.22)",
    3: "0 3px 0 rgba(33,26,22,0.05), 0 18px 32px -14px rgba(33,26,22,0.32)",
  },
  // Motion tokens (owned by Motion and sound; spec in docs/design/motion.md).
  // dur: milliseconds. Under reduced motion every dur goes to 0 except `fade`,
  // which stays so state changes still read as a gentle crossfade (brand book 8).
  motion: {
    dur: {
      instant: "90ms", quick: "160ms", base: "260ms", slow: "480ms", drift: "900ms", develop: "2400ms",
      fade: "160ms", page: "240ms", word: "220ms", breathe: "1800ms", flicker: "2600ms",
    },
    ease: {
      out: "cubic-bezier(0.2, 0.8, 0.2, 1)",
      in: "cubic-bezier(0.4, 0, 1, 1)",
      inOut: "cubic-bezier(0.6, 0, 0.3, 1)",
      spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      settle: "cubic-bezier(0.3, 1.25, 0.5, 1)",
      linear: "linear",
    },
    // Damped springs for JS-driven motion (sheet drag release, compass needle).
    // stiffness and damping per unit mass; `css` is the same curve as a CSS linear() easing.
    spring: {
      sheet: { stiffness: 420, damping: 36, mass: 1 },
      needle: { stiffness: 180, damping: 22, mass: 1 },
      step: { stiffness: 300, damping: 18, mass: 1 },
    },
    keepInReduce: ["fade"],
  },
  layout: { maxWidth: "480px", gutter: "20px", primaryHeight: "56px", touch: "44px", thumbZone: "40%" },
};

// Sample a damped spring (x from 0 to 1) into a CSS linear() easing and its settle time.
function springCurve({ stiffness, damping, mass }) {
  const w0 = Math.sqrt(stiffness / mass), zeta = damping / (2 * Math.sqrt(stiffness * mass));
  const x = (t) => {
    if (zeta < 1) { const wd = w0 * Math.sqrt(1 - zeta * zeta); return 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t)); }
    return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
  };
  let settle = 0; // last time |1 - x| is over 0.5%
  for (let t = 0; t < 4; t += 0.001) if (Math.abs(1 - x(t)) > 0.005) settle = t;
  const n = 24, pts = [];
  let peak = 0;
  for (let i = 0; i <= n; i++) { const v = x((settle * i) / n); peak = Math.max(peak, v); pts.push(+v.toFixed(3)); }
  pts[n] = 1;
  return { ms: Math.round(settle * 1000), overshoot: +(Math.max(0, peak - 1) * 100).toFixed(1), css: `linear(${pts.join(", ")})` };
}
for (const sp of Object.values(tokens.motion.spring)) Object.assign(sp, springCurve(sp));

fs.writeFileSync(path.join(HERE, "tokens.json"), JSON.stringify(tokens, null, 2) + "\n");

const v = [];
for (const [k, c] of Object.entries(colors)) v.push(`--c-${k}: ${c};`);
v.push(`--font-display: ${tokens.font.display};`, `--font-body: ${tokens.font.body};`);
for (const [k, t] of Object.entries(tokens.type)) {
  v.push(`--t-${k}-size: ${t.size};`, `--t-${k}-line: ${t.line};`, `--t-${k}-weight: ${t.weight};`, `--t-${k}-family: var(--font-${t.family});`, `--t-${k}-tracking: ${t.tracking};`);
}
for (const [k, s] of Object.entries(tokens.space)) v.push(`--s-${k}: ${s};`);
for (const [k, r] of Object.entries(tokens.radius)) v.push(`--r-${k}: ${r};`);
for (const [k, e] of Object.entries(tokens.elevation)) v.push(`--e-${k}: ${e};`);
for (const [k, d] of Object.entries(tokens.motion.dur)) v.push(`--dur-${k}: ${d};`);
for (const [k, e] of Object.entries(tokens.motion.ease)) v.push(`--ease-${kebab(k)}: ${e};`);
for (const [k, sp] of Object.entries(tokens.motion.spring)) v.push(`--spring-${k}: ${sp.css};`, `--spring-${k}-dur: ${sp.ms}ms;`);
for (const [k, l] of Object.entries(tokens.layout)) v.push(`--l-${kebab(k)}: ${l};`);
const reduceKeys = [...Object.keys(tokens.motion.dur).filter((k) => !tokens.motion.keepInReduce.includes(k)).map((k) => `--dur-${k}`), ...Object.keys(tokens.motion.spring).map((k) => `--spring-${k}-dur`)];
const reduceVars = reduceKeys.map((k) => `${k}: 0ms;`).join(" ");
const roleVars = (mode) => Object.entries(roles[mode]).map(([k, c]) => `  --${kebab(k)}: var(--c-${c});`).join("\n");

const css = `/* Flare design tokens. Generated by design/system/build-tokens.mjs from
   brand/tools/palette.mjs. Do not edit by hand.
   Themes apply to :root or to any element (so one page can show several):
   [data-theme="light"], [data-theme="dark"], and [data-sun] (outdoor screens). */
:root {
${v.map((x) => "  " + x).join("\n")}
  --text-scale: 1;
${roleVars("light")}
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]):not([data-sun]) {
${roleVars("dark").replace(/^/gm, "  ")}
    color-scheme: dark;
  }
}
[data-theme="light"] {
${roleVars("light")}
  color-scheme: light;
}
[data-theme="dark"] {
${roleVars("dark")}
  color-scheme: dark;
}
/* Sun mode wins over any theme: light roles, bigger text, heavier body weight. */
[data-sun], [data-theme][data-sun] {
${roleVars("light")}
  --text-scale: 1.15;
  --t-body-weight: 500;
  color-scheme: light;
}
@media (prefers-reduced-motion: reduce) {
  :root {
    ${reduceVars}
  }
}
[data-reduce-motion] {
  ${reduceVars}
}
`;
fs.writeFileSync(path.join(HERE, "tokens.css"), css);
console.log("tokens.css and tokens.json written:", v.length, "base variables");
