// Performance budget for the link page (SRS-PERF-2: at most 150 KB of JavaScript, gzipped,
// excluding model files). Measures every .js file the web build ships, which is an upper
// bound for any one page. Usage: npm run build && node scripts/budget.ts
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BUILD = path.join(ROOT, "apps/web/build");
const BUDGET_KB = 150;

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? walk(p) : p.endsWith(".js") ? [p] : [];
  });
}
if (!fs.existsSync(BUILD)) {
  console.error("FAIL no web build: run npm run build");
  process.exit(1);
}
const files = walk(BUILD);
const total = files.reduce((n, f) => n + gzipSync(fs.readFileSync(f), { level: 9 }).length, 0);
const kb = Math.round((total / 1024) * 10) / 10;
console.log(`web JS: ${files.length} files, ${kb} KB gzipped, budget ${BUDGET_KB} KB`);
process.exit(kb <= BUDGET_KB ? 0 : 1);
