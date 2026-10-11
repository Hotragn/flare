// Performance budget per page (SRS-PERF-2: the link page ships at most 150 KB of JavaScript,
// gzipped, excluding model files). Measures what a route loads before it is interactive: the
// SvelteKit entry and app chunks, the root and route layouts and the page node, plus every
// chunk they import statically (from the Vite client manifest). Dynamic imports load later
// and are reported separately. Usage: npm run build && node scripts/budget.ts
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const KIT = path.join(ROOT, "apps/web/.svelte-kit");
const CLIENT = path.join(KIT, "output/client");
const MANIFEST = path.join(CLIENT, ".vite/manifest.json");
const APP = path.join(KIT, "generated/build/client-optimized/app.js");
/** Budgets in KB gzipped. The link page is the requirement; the others keep us honest. */
const BUDGETS: Record<string, number> = { "/g/[id]": 150, "/app": 150, "/(site)": 150 };

if (!fs.existsSync(MANIFEST) || !fs.existsSync(APP)) {
  console.error("FAIL no web build: run npm run build");
  process.exit(1);
}
type Entry = { file: string; imports?: string[]; dynamicImports?: string[] };
const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8")) as Record<string, Entry>;
const dict = (fs.readFileSync(APP, "utf8").match(/export const dictionary = (\{[\s\S]*?\});/)?.[1] ?? "{}").replace(
  /,\s*\}/g,
  "}",
);
const routes = JSON.parse(dict) as Record<string, [number, number[]?]>;
const key = (suffix: string) => Object.keys(manifest).find((k) => k.endsWith(suffix));
const gz = new Map<string, number>();
const size = (file: string) => {
  if (!gz.has(file)) gz.set(file, gzipSync(fs.readFileSync(path.join(CLIENT, file)), { level: 9 }).length);
  return gz.get(file) ?? 0;
};
function closure(starts: string[]): Set<string> {
  const seen = new Set<string>();
  const walk = (k: string) => {
    if (seen.has(k) || !manifest[k]) return;
    seen.add(k);
    for (const i of manifest[k].imports ?? []) walk(i);
  };
  for (const s of starts) walk(s);
  return seen;
}
const base = [key("client/entry.js"), key("client-optimized/app.js"), key("client-optimized/nodes/0.js")].filter(
  (k): k is string => !!k,
);
let failed = false;
const rows: string[] = [];
for (const [route, [page, layouts = []]] of Object.entries(routes).sort()) {
  const nodes = [...layouts, page].map((n) => key(`client-optimized/nodes/${n}.js`)).filter((k): k is string => !!k);
  const files = new Set([...closure([...base, ...nodes])].map((k) => manifest[k]?.file ?? ""));
  const kb = Math.round(([...files].reduce((n, f) => n + size(f), 0) / 1024) * 10) / 10;
  const budget = BUDGETS[route];
  const over = budget !== undefined && kb > budget;
  failed ||= over;
  rows.push(
    `${over ? "FAIL" : "ok  "} ${route.padEnd(28)} ${String(kb).padStart(6)} KB${budget ? ` (budget ${budget})` : ""}`,
  );
}
console.log(rows.join("\n"));
process.exit(failed ? 1 : 0);
