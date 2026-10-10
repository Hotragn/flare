// Puts PNG frames side by side in one image, with their file names as captions.
// Usage (from design/prototype): node ../motion/contact.mjs <out.png> <frame.png> [frame.png ...]
import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";

const require = createRequire(path.resolve("package.json"));
const { chromium } = require("playwright-core");
const [out, ...files] = process.argv.slice(2);
const cells = files
  .map((f) => `<figure><img src="data:image/png;base64,${fs.readFileSync(f).toString("base64")}"><figcaption>${path.basename(f, ".png")}</figcaption></figure>`)
  .join("");
const html = `<html><body style="margin:0;background:#F6F1E7;font:14px system-ui"><div style="display:flex;flex-wrap:wrap;gap:12px;padding:12px">${cells}</div>
<style>figure{margin:0}img{width:${files.length > 4 ? 180 : 240}px;display:block;border:1px solid #ddd}figcaption{padding:4px 0}</style></body></html>`;
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: files.length > 4 ? 1000 : 1040, height: 400 } });
await page.setContent(html);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log(out);
