// axe on the device-check kit pages (BUG-056), light and dark, after every status colour is
// applied, as the page looks after a run. Usage: npm run build && npm run e2e:kit-a11y
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { serve } from "../site/serve.ts";

type Violation = { id: string; nodes: { target: string[]; any: { message?: string }[] }[] };
type Axe = { run(ctx: Document, opts: unknown): Promise<{ violations: Violation[] }> };

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const axe = fs.readFileSync(path.join(ROOT, "node_modules/axe-core/axe.min.js"), "utf8");
const site = await serve(8886, () => null);
const browser = await chromium.launch({ channel: "chrome" });
let bad = 0;
for (const scheme of ["light", "dark"] as const) {
  for (const p of ["/check/", "/check/capability/", "/check/compass.html"]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme });
    const page = await ctx.newPage();
    await page.goto(site.url + p);
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      document.querySelectorAll(".st").forEach((el, i) => {
        el.textContent = ["OK done", "FAIL no", "WAIT maybe"][i % 3] ?? "";
        el.className = `st ${["ok", "bad", "warn"][i % 3]}`;
        const pre = el.closest("section")?.querySelector("pre");
        if (pre) pre.textContent = "result text line";
      });
    });
    await page.addScriptTag({ content: axe });
    const found = await page.evaluate(async () => {
      const a = (window as unknown as { axe: Axe }).axe;
      const r = await a.run(document, { runOnly: ["wcag2a", "wcag2aa", "best-practice"] });
      return r.violations.map((v) => ({
        id: v.id,
        n: v.nodes.length,
        ex: v.nodes.slice(0, 3).map((x) => `${x.target.join(" ")} :: ${(x.any[0]?.message ?? "").slice(0, 90)}`),
      }));
    });
    bad += found.length;
    console.info(scheme, p, found.length ? JSON.stringify(found, null, 1) : "0 violations");
    await ctx.close();
  }
}
await browser.close();
await site.close();
console.info(bad ? `\nFAIL ${bad} violations` : "\nkit a11y: 0 violations");
process.exit(bad ? 1 : 0);
