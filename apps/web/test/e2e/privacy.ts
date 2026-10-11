// SRS-COND-6 / BR-C-9 proof in a real browser: open the built /ai/ page in Google Chrome,
// type conditions with marker words, and capture every network request and the page's storage.
// Pass = no request after load, and no marker word in any request or in localStorage.
// Usage: npm run build && node apps/web/test/e2e/privacy.ts   (port 8842, ODAI range)
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const BUILD = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../build");
const PORT = 8842;
const MARKERS = ["ZEBRA", "dentist", "Mabel", "porch"];
const PHRASES = [
  "back by 5 after the dentist ZEBRA",
  "only with Mabel",
  "porch only, max 10 min walk",
  "gotta be home for dinner at 6 ZEBRA",
];
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

if (!fs.existsSync(path.join(BUILD, "ai/index.html"))) throw new Error("run npm run build first");
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
  let f = path.resolve(BUILD, `.${p}`);
  if (!f.startsWith(BUILD)) return res.writeHead(403).end();
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
  if (!fs.existsSync(f)) return res.writeHead(404).end();
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] ?? "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});
await new Promise<void>((r) => server.listen(PORT, "127.0.0.1", r));

const browser = await chromium.launch({ channel: "chrome", headless: true });
let failed = false;
try {
  const page = await browser.newPage();
  const requests: { phase: string; url: string; method: string; body: string }[] = [];
  let phase = "load";
  page.on("request", (r) => requests.push({ phase, url: r.url(), method: r.method(), body: r.postData() ?? "" }));
  await page.goto(`http://127.0.0.1:${PORT}/ai/`, { waitUntil: "networkidle" });
  phase = "typing";
  const results: string[] = [];
  for (const text of PHRASES) {
    await page.fill("#cond", text);
    await page.click('button[type="submit"]');
    await page.waitForSelector('[data-testid="try-result"]');
    results.push((await page.textContent('[data-testid="try-result"]')) ?? "");
  }
  await page.waitForTimeout(500);
  const storage = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
  const after = requests.filter((r) => r.phase === "typing");
  const leaks = requests.filter((r) => MARKERS.some((m) => r.url.includes(m) || r.body.includes(m)));
  const stored = MARKERS.filter((m) => storage.includes(m));
  const lastConditions = await page.textContent('[data-testid="last-conditions"]');
  failed = after.length > 0 || leaks.length > 0 || stored.length > 0;
  console.info(
    JSON.stringify(
      {
        browser: `Chrome ${browser.version()}`,
        requests_on_load: requests.filter((r) => r.phase === "load").length,
        requests_while_typing: after.length,
        marker_hits_in_requests: leaks.length,
        marker_hits_in_storage: stored,
        read_backs: results,
        last_conditions_line: lastConditions?.trim(),
        pass: !failed,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
  server.close();
}
process.exit(failed ? 1 : 0);
