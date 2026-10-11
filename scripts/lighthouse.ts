// Lighthouse on the five website pages (WB3, SRS-PERF-4, SRS-COMP-4), mobile and desktop,
// against the built site served locally, with the installed Google Chrome (no download).
//   npm run build && node scripts/lighthouse.ts [--min 100] [--out docs/website/lighthouse] [--pages /,/how/] [--forms mobile]
// Writes one HTML report per page and form factor plus summary.json; exits 1 if any
// category scores below --min. Ports 8880 (site) and 8882 (Chrome debugging).
import fs from "node:fs";
import path from "node:path";
import lighthouse, { desktopConfig } from "lighthouse";
import { chromium } from "playwright-core";
import { serve } from "../apps/web/test/site/serve.ts";

const ALL_PAGES = ["/", "/how/", "/privacy/", "/accessibility/", "/run/"];
const CATEGORIES = ["performance", "accessibility", "best-practices", "seo"] as const;

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 && process.argv[i + 1] ? (process.argv[i + 1] as string) : fallback;
};
const min = Number(arg("--min", "100"));
// --pages /,/how/ and --forms mobile run a subset while tuning; the proof run uses all.
const PAGES = arg("--pages", ALL_PAGES.join(",")).split(",");
const FORMS = arg("--forms", "mobile,desktop").split(",") as ("mobile" | "desktop")[];
// Lighthouse's simulated mobile timings move a few points between identical runs on a busy
// machine; its docs advise the median of several runs. Each page and form factor runs --runs
// times (default 3); the median-performance report is saved and every run's score is listed.
const RUNS = Number(arg("--runs", "3"));
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

type Row = { page: string; form: "mobile" | "desktop"; runs: number[] } & Record<(typeof CATEGORIES)[number], number>;

const site = await serve(8880, (p) => (p.startsWith("/api/v1/audit") ? { status: 200, body: audit } : null));
const browser = await chromium.launch({ channel: "chrome", args: ["--remote-debugging-port=8882"] });
const rows: Row[] = [];
try {
  fs.mkdirSync(out, { recursive: true });
  for (const form of FORMS) {
    for (const p of PAGES) {
      const runs = [];
      for (let i = 0; i < RUNS; i++) {
        const r = await lighthouse(
          site.url + p,
          { port: 8882, output: "html", logLevel: "error", onlyCategories: [...CATEGORIES] },
          form === "desktop" ? desktopConfig : undefined,
        );
        if (!r) throw new Error(`lighthouse returned nothing for ${p}`);
        runs.push(r);
      }
      runs.sort((a, b) => (a.lhr.categories.performance?.score ?? 0) - (b.lhr.categories.performance?.score ?? 0));
      const result = runs[Math.floor(runs.length / 2)] as (typeof runs)[number];
      const cats = result.lhr.categories;
      const score = (c: (typeof CATEGORIES)[number]) => Math.round((cats[c]?.score ?? 0) * 100);
      const row: Row = {
        page: p,
        form,
        performance: score("performance"),
        accessibility: score("accessibility"),
        "best-practices": score("best-practices"),
        seo: score("seo"),
        runs: runs.map((r) => Math.round((r.lhr.categories.performance?.score ?? 0) * 100)),
      };
      rows.push(row);
      const name = `${form}-${p === "/" ? "home" : p.replace(/\//g, "")}.html`;
      fs.writeFileSync(path.join(out, name), String(result.report));
      console.log(
        `${form.padEnd(7)} ${p.padEnd(16)} perf ${row.performance} (runs ${row.runs.join(" ")}) a11y ${row.accessibility} bp ${row["best-practices"]} seo ${row.seo}`,
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
  `${JSON.stringify({ at: new Date().toISOString(), lighthouse: "13.5.0", chrome: browser.version(), runs: RUNS, pick: "median performance", min, lowest, rows }, null, 2)}\n`,
);
console.log(`lowest score ${lowest} (need ${min}); reports in ${path.relative(process.cwd(), out)}`);
process.exit(lowest >= min ? 0 : 1);
