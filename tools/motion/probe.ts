// Runs one JS expression in a /dev/components/?s= page and prints the result (debugging the catalog).
// Usage: node tools/motion/probe.ts <base-url> <catalog-query> <expression>
import { chromium } from "playwright-core";

const [base, query, expr] = process.argv.slice(2);
if (!base || !query || !expr) throw new Error("usage: probe.ts <base-url> <query> <expression>");
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("console", (m) => console.info("console:", m.text()));
page.on("pageerror", (e) => console.info("pageerror:", e.message));
await page.goto(`${base}/dev/components/?${query}`);
await page.waitForTimeout(1500);
console.info(JSON.stringify(await page.evaluate(expr), null, 1));
await browser.close();
