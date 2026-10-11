// axe on the device-check kit pages (BUG-056), light and dark, after every status colour is
// applied, as the page looks after a run. Usage: npm run build && npm run e2e:kit-a11y
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { serve } from "../site/serve.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
let bad = 0;
const site = await serve(8886, () => null);
const axe = fs.readFileSync(path.join(ROOT, "node_modules/axe-core/axe.min.js"), "utf8");
const b = await chromium.launch({ channel: "chrome" });
for (const scheme of ["light", "dark"] as const)
  for (const p of ["/check/", "/check/capability/", "/check/compass.html"]) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme });
    const page = await ctx.newPage();
    await page.goto(site.url + p);
    await page.waitForTimeout(400);
    // After a run: every status colour on every card (BUG-056 was the post-run look).
    await page.evaluate(() =>
      document.querySelectorAll(".st").forEach((el, i) => {
        el.textContent = ["OK done", "FAIL no", "WAIT maybe"][i % 3];
        el.className = "st " + ["ok", "bad", "warn"][i % 3];
        const pre = el.closest("section")?.querySelector("pre");
        if (pre) pre.textContent = "result text line";
      }),
    );
    await page.addScriptTag({ content: axe });
    const r = await page.evaluate(async () =>
      (await (window as any).axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "best-practice"] })).violations.map(
        (v: any) => ({
          id: v.id,
          n: v.nodes.length,
          ex: v.nodes.slice(0, 3).map((x: any) => x.target.join(" ") + " :: " + (x.any[0]?.message ?? "").slice(0, 90)),
        }),
      ),
    );
    bad += r.length;
    console.info(scheme, p, r.length ? JSON.stringify(r, null, 1) : "0 violations");
    await ctx.close();
  }
await b.close();
await site.close();
console.info(bad ? `\nFAIL ${bad} violations` : "\nkit a11y: 0 violations");
process.exit(bad ? 1 : 0);
