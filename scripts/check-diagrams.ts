// Renders every Mermaid diagram in docs/ with the real Mermaid library in headless
// Chrome and fails on any parse or render error, so no broken diagram ships.
// Usage: npm run diagrams
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MERMAID = path.join(ROOT, "node_modules/mermaid/dist/mermaid.min.js");

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? walk(p) : p.endsWith(".md") ? [p] : [];
  });
}
const blocks = walk(path.join(ROOT, "docs")).flatMap((file) => {
  const text = fs.readFileSync(file, "utf8");
  return [...text.matchAll(/```mermaid\n([\s\S]*?)```/g)].map((m) => ({
    file: path.relative(ROOT, file),
    line: text.slice(0, m.index).split("\n").length,
    code: m[1] ?? "",
  }));
});

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage();
await page.setContent("<!doctype html><body></body>");
await page.addScriptTag({ path: MERMAID });
await page.evaluate(() =>
  (window as unknown as { mermaid: { initialize: (o: object) => void } }).mermaid.initialize({ startOnLoad: false }),
);
let bad = 0;
for (const [i, b] of blocks.entries()) {
  const err = await page.evaluate(
    async ({ code, id }) => {
      try {
        await (
          window as unknown as { mermaid: { render: (id: string, c: string) => Promise<unknown> } }
        ).mermaid.render(id, code);
        return null;
      } catch (e) {
        return e instanceof Error ? e.message : String(e);
      }
    },
    { code: b.code, id: `d${i}` },
  );
  if (err) {
    bad++;
    console.error(`FAIL ${b.file}:${b.line} ${err.split("\n").slice(0, 3).join(" ")}`);
  }
}
await browser.close();
console.log(`diagrams: ${blocks.length} rendered, ${bad} failed`);
process.exit(bad ? 1 : 0);
