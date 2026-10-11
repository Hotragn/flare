// Lighthouse on the five website pages (WB3, SRS-PERF-4, SRS-COMP-4), mobile and desktop,
// against the built site served locally, with the installed Google Chrome (no download).
//   npm run build && node scripts/lighthouse.ts [--min 95] [--out docs/website/lighthouse]
// Writes one HTML report per page and form factor plus summary.json; exits 1 if any
// category scores below --min. Ports 8880 (site) and 8882 (Chrome debugging).
import fs from "node:fs";
import path from "node:path";
import lighthouse, { desktopConfig } from "lighthouse";
import { chromium } from "playwright-core";
import { serve } from "../apps/web/test/site/serve.ts";

const PAGES = ["/", "/how/", "/privacy/", "/accessibility/", "/run/"];
const CATEGORIES = ["performance", "accessibility", "best-practices", "seo"] as const;

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 && process.argv[i + 1] ? (process.argv[i + 1] as string) : fallback;
};
const min = Number(arg("--min", "95"));
const out = path.resolve(arg("--out", "docs/website/lighthouse"));

// A plausible audit answer, so the privacy page renders its live table as it will in production.
const audit = {
  at: new Date().toISOString(),
  pass: true,
  stores: [
    { store: "DS1", table: "gatherings", per_gathering: true, total_rows: 0, expired_rows: 0 },
    { store: "DS10", table: "sparks", per_gathering: false, total_rows: 0, expired_rows: 0 },
  ],
};

type Row = { page: string; form: "mobile" | "desktop" } & Record<(typeof CATEGORIES)[number], number>;

const site = await serve(8880, (p) => (p.startsWith("/api/v1/audit") ? { status: 200, body: audit } : null));
const browser = await chromium.launch({ channel: "chrome", args: ["--remote-debugging-port=8882"] });
const rows: Row[] = [];
try {
  fs.mkdirSync(out, { recursive: true });
  for (const form of ["mobile", "desktop"] as const) {
    for (const p of PAGES) {
      const result = await lighthouse(
        site.url + p,
        { port: 8882, output: "html", logLevel: "error", onlyCategories: [...CATEGORIES] },
        form === "desktop" ? desktopConfig : undefined,
      );
      if (!result) throw new Error(`lighthouse returned nothing for ${p}`);
      const cats = result.lhr.categories;
      const score = (c: (typeof CATEGORIES)[number]) => Math.round((cats[c]?.score ?? 0) * 100);
      const row: Row = {
        page: p,
        form,
        performance: score("performance"),
        accessibility: score("accessibility"),
        "best-practices": score("best-practices"),
        seo: score("seo"),
      };
      rows.push(row);
      const name = `${form}-${p === "/" ? "home" : p.replace(/\//g, "")}.html`;
      fs.writeFileSync(path.join(out, name), String(result.report));
      console.log(
        `${form.padEnd(7)} ${p.padEnd(16)} perf ${row.performance} a11y ${row.accessibility} bp ${row["best-practices"]} seo ${row.seo}`,
      );
    }
  }
} finally {
  await browser.close();
  await site.close();
}

const lowest = Math.min(...rows.flatMap((r) => CATEGORIES.map((c) => r[c])));
fs.writeFileSync(
  path.join(out, "summary.json"),
  `${JSON.stringify({ at: new Date().toISOString(), lighthouse: "13.5.0", chrome: browser.version(), min, lowest, rows }, null, 2)}\n`,
);
console.log(`lowest score ${lowest} (need ${min}); reports in ${path.relative(process.cwd(), out)}`);
process.exit(lowest >= min ? 0 : 1);
