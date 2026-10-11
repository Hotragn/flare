// Runs the device check capability page in Google Chrome on this Mac and prints the automatic
// results plus the resize and shader cards. Usage: node apps/web/test/e2e/check-mac.ts [--headed]
// Port 8841 (ODAI range). Results are also written as the device-check kit would receive them.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const CHECK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../static/check");
const PORT = 8841;
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
};

let posted: unknown = null;
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
  if (req.method === "POST" && p === "/api/device-check") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      posted = JSON.parse(body);
      res.writeHead(204).end();
    });
    return;
  }
  let f = path.resolve(CHECK, `.${p.replace(/^\/check/, "") || "/"}`);
  if (!f.startsWith(CHECK)) return res.writeHead(403).end();
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
  if (!fs.existsSync(f)) return res.writeHead(404).end();
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] ?? "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});
await new Promise<void>((r) => server.listen(PORT, "127.0.0.1", r));

const browser = await chromium.launch({ channel: "chrome", headless: !process.argv.includes("--headed") });
try {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${PORT}/check/capability/`);
  await page.waitForFunction(() => document.querySelector("#s-icd8 .st")?.textContent !== "");
  await page.click('[data-run="resize"]');
  await page.waitForFunction(
    () => /OK|SLOW|FAIL/.test(document.querySelector("#s-resize .st")?.textContent ?? ""),
    null,
    {
      timeout: 60_000,
    },
  );
  await page.click('[data-run="shader"]');
  await page.waitForFunction(
    () => !/RUNNING|TAP/.test(document.querySelector("#s-shader .st")?.textContent ?? "x"),
    null,
    {
      timeout: 30_000,
    },
  );
  await page.click("#send");
  await page.waitForFunction(() => document.querySelector("#send")?.textContent !== "Send to laptop");
  const cards = await page.$$eval("section", (ss) =>
    ss.map((s) => ({
      id: s.id,
      status: s.querySelector(".st")?.textContent ?? "",
      body: s.querySelector("pre")?.textContent ?? "",
    })),
  );
  const version = browser.version();
  console.log(JSON.stringify({ browser: `Chrome ${version}`, errors, sent: posted !== null, cards }, null, 2));
} finally {
  await browser.close();
  server.close();
}
