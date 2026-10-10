// Renders the Flare app icon at iOS home-screen sizes (60 and 120 px) next to
// real App Store icons on light and dark wallpapers, using the installed Chrome.
// Usage: node icon-check.mjs <icons.json> <out.png>
// icons.json: [{ "name": "...", "art": "<artworkUrl512 from the iTunes Search API>" }]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const [listFile, outFile] = process.argv.slice(2);
const others = JSON.parse(fs.readFileSync(listFile, "utf8"));
const ours = "data:image/png;base64," + fs.readFileSync(path.join(HERE, "../export/icons/icon-180.png")).toString("base64");
const ours1024 = "data:image/png;base64," + fs.readFileSync(path.join(HERE, "../export/icons/icon-1024.png")).toString("base64");

// iOS masks icons to a continuous-corner squircle; a 22.37% radius is the common approximation.
const tile = (src, size, name) => `<figure><img src="${src}" width="${size}" height="${size}" style="border-radius:${size * 0.2237}px"><figcaption>${name}</figcaption></figure>`;
const grid = (size, bg) => `<section style="background:${bg}"><h2>${size} px</h2><div class="row">${tile(size <= 60 ? ours : ours1024, size, "Flare")}${others.map((o) => tile(o.art, size, o.name.split(/[:\-]/)[0].trim())).join("")}</div></section>`;
const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;font:13px -apple-system,system-ui,sans-serif}
section{padding:18px 22px} h2{margin:0 0 12px;font-size:13px;color:#888}
.row{display:flex;gap:22px;flex-wrap:wrap} figure{margin:0;text-align:center;width:120px}
figcaption{margin-top:6px;color:inherit;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
section:nth-child(odd){color:#222} section:nth-child(even){color:#eee}
</style>${grid(60, "linear-gradient(#cfd8e3,#eef1f5)")}${grid(60, "linear-gradient(#0d1424,#28324a)")}${grid(120, "linear-gradient(#cfd8e3,#eef1f5)")}${grid(120, "linear-gradient(#0d1424,#28324a)")}`;

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: "networkidle" });
await page.screenshot({ path: outFile, fullPage: true });
await browser.close();
console.log("Saved", outFile);
