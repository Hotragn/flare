// Builds a contact sheet PNG from exported screens. Usage: node scripts/contact.mjs <out.png> <cols> <file...>
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
const [out, cols, ...files] = process.argv.slice(2);
const imgs = files.map((f) => `<figure><img src="data:image/png;base64,${fs.readFileSync(f).toString("base64")}"><figcaption>${path.basename(f, ".png")}</figcaption></figure>`).join("");
const html = `<!doctype html><style>body{margin:0;padding:16px;background:#ddd;font:12px system-ui}main{display:grid;grid-template-columns:repeat(${cols},195px);gap:14px}figure{margin:0}img{width:195px;height:422px;border-radius:14px;display:block;box-shadow:0 2px 8px #0003}figcaption{padding:4px 2px}</style><main>${imgs}</main>`;
const b = await chromium.launch({ channel: "chrome" });
const p = await b.newPage({ viewport: { width: 16 + cols * 209, height: 400 }, deviceScaleFactor: 1.5 });
await p.setContent(html);
await p.screenshot({ path: out, fullPage: true });
await b.close();
console.log("saved", out);
