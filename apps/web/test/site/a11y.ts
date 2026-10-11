// FE7 accessibility pass (SRS-A11Y-1 to -6): axe-core on every page of the built app, light
// and dark, phone and desktop widths, plus a 44 px touch-target check on the phone width.
// Fails on any serious or critical axe result or any small target.
//   npm run build && node apps/web/test/site/a11y.ts [--out docs/website/evidence/a11y.json]
// Uses the installed Google Chrome through playwright-core (no browser download). Port 8881.
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright-core";
import { BUILD, serve } from "./serve.ts";

const require = createRequire(import.meta.url);
const AXE = require.resolve("axe-core/axe.min.js");
const ROUTES_DIR = fileURLToPath(new URL("../../src/routes/", import.meta.url));
const SAMPLE_ID = "11111111-1111-4111-8111-111111111111";

/** Every +page.svelte as a URL; route groups dropped, [params] filled with a sample id. */
export function pagesFrom(dir: string, base = ""): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isFile() && e.name === "+page.svelte") out.push(`${base}/`);
    if (!e.isDirectory()) continue;
    const seg = e.name.startsWith("(") ? "" : e.name.startsWith("[") ? `/${SAMPLE_ID}` : `/${e.name}`;
    out.push(...pagesFrom(path.join(dir, e.name), `${base}${seg}`));
  }
  return [...new Set(out.map((p) => p.replace(/\/+/g, "/")))].sort();
}

/** Static pages copied as-is from apps/web/static (the device check). */
function staticPages(): string[] {
  const out: string[] = [];
  const walk = (d: string, base: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) walk(path.join(d, e.name), `${base}/${e.name}`);
      else if (e.name.endsWith(".html") && !/^(200|404)\.html$/.test(e.name) && base !== "")
        out.push(e.name === "index.html" ? `${base}/` : `${base}/${e.name}`);
    }
  };
  walk(BUILD, "");
  return out.filter((p) => p.startsWith("/check/"));
}

type Finding = { page: string; scheme: string; width: number; id: string; impact: string; nodes: number; help: string };
type Small = { page: string; selector: string; w: number; h: number };

async function smallTargets(page: Page): Promise<Omit<Small, "page">[]> {
  return page.evaluate(() => {
    const out: { selector: string; w: number; h: number }[] = [];
    const els = document.querySelectorAll<HTMLElement>(
      "a[href], button, input, select, textarea, [role=button], [tabindex]",
    );
    for (const el of els) {
      if (el.tabIndex < 0 && el.tagName !== "A") continue;
      const r = el.getBoundingClientRect();
      if (r.width <= 1 || r.height <= 1) continue; // visually hidden (a label carries the target)
      const st = getComputedStyle(el);
      if (st.visibility === "hidden" || st.display === "none") continue;
      // WCAG 2.5.8 exception: links inside a sentence.
      if (el.tagName === "A" && st.display === "inline" && el.closest("p, li, td, dd")) continue;
      if (r.width < 44 || r.height < 44) {
        const id = el.id ? `#${el.id}` : "";
        const cls =
          el.className && typeof el.className === "string" ? `.${el.className.trim().split(/\s+/).join(".")}` : "";
        out.push({
          selector: `${el.tagName.toLowerCase()}${id}${cls}`.slice(0, 120),
          w: Math.round(r.width),
          h: Math.round(r.height),
        });
      }
    }
    return out;
  });
}

export async function run(opts: { out?: string; port?: number } = {}) {
  if (!fs.existsSync(BUILD)) throw new Error("No build. Run `npm run build` first.");
  const server = await serve(opts.port ?? 8881);
  const pages = [...pagesFrom(ROUTES_DIR), ...staticPages()];
  const browser = await chromium.launch({ channel: "chrome" });
  const findings: Finding[] = [];
  const small: Small[] = [];
  let checked = 0;
  try {
    for (const width of [390, 1280]) {
      for (const scheme of ["light", "dark"] as const) {
        const ctx = await browser.newContext({
          viewport: { width, height: width === 390 ? 844 : 800 },
          colorScheme: scheme,
        });
        const page = await ctx.newPage();
        for (const p of pages) {
          await page.goto(server.url + p, { waitUntil: "networkidle" });
          await page.waitForTimeout(150);
          await page.addScriptTag({ path: AXE });
          const res = (await page.evaluate(async () => {
            // biome-ignore lint/suspicious/noExplicitAny: axe is injected at run time
            const axe = (window as any).axe;
            return axe.run(document, { resultTypes: ["violations"] });
          })) as { violations: { id: string; impact: string; nodes: unknown[]; help: string }[] };
          for (const v of res.violations)
            findings.push({ page: p, scheme, width, id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help });
          if (width === 390 && scheme === "light")
            for (const s of await smallTargets(page)) small.push({ page: p, ...s });
          checked++;
        }
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
    await server.close();
  }
  // The device-check kit (/check/) is a developer tool for Sunday morning: reported, not blocking.
  const advisory = (p: string) => p.startsWith("/check/");
  const blocking = findings.filter((f) => (f.impact === "serious" || f.impact === "critical") && !advisory(f.page));
  const smallBlocking = small.filter((s) => !advisory(s.page));
  const report = {
    at: new Date().toISOString(),
    pages,
    checked,
    findings,
    small_targets: small,
    blocking: blocking.length,
    small_blocking: smallBlocking.length,
  };
  if (opts.out) {
    fs.mkdirSync(path.dirname(opts.out), { recursive: true });
    fs.writeFileSync(opts.out, `${JSON.stringify(report, null, 2)}\n`);
  }
  return report;
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? "")) {
  const i = process.argv.indexOf("--out");
  const r = await run({ out: i > 0 ? process.argv[i + 1] : undefined });
  for (const f of r.findings)
    console.info(`${f.impact.padEnd(8)} ${f.id} ${f.page} ${f.scheme} ${f.width}px (${f.nodes})`);
  for (const s of r.small_targets) console.info(`small    ${s.selector} ${s.w}x${s.h} on ${s.page}`);
  console.info(
    `axe: ${r.checked} page views (${r.pages.length} pages x 2 widths x 2 schemes), ${r.findings.length} findings, ${r.blocking} serious or critical outside /check/; ${r.small_blocking} targets under 44 px outside /check/`,
  );
  process.exit(r.blocking || r.small_blocking ? 1 : 0);
}
