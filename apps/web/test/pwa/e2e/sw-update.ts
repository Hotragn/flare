// Live bug 6 (Oct 11): returning visitors kept the old site and app after a deploy. Two real
// builds, N and N+1, served from one origin: load N until the service worker controls the page,
// switch the server to N+1, reload once, and check N+1's HTML and JS are what runs.
// Usage: node apps/web/test/pwa/e2e/sw-update.ts   Writes docs/pwa/evidence/e2e-sw-update.txt.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../../../..");
const WEB = path.join(ROOT, "apps/web");
const OUT = path.join(ROOT, "docs/pwa/evidence/e2e-sw-update.txt");
const PORT = Number(process.env.PWA_E2E_PORT ?? 8874);
const ORIGIN = `http://127.0.0.1:${PORT}`;
const lines: string[] = [];
let failed = 0;
const log = (s: string) => {
  lines.push(s);
  process.stdout.write(`${s}\n`);
};
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) failed++;
  log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
};

// Two builds that differ only in their build id (the SvelteKit version, so new chunk hashes too).
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "flare-swup-"));
const builds: Record<string, string> = {};
for (const id of ["buildN000000", "buildN100000"]) {
  execFileSync("npx", ["vite", "build", "--logLevel", "error"], {
    cwd: WEB,
    env: { ...process.env, FLARE_BUILD: id },
    stdio: "inherit",
  });
  const dir = path.join(tmp, id);
  fs.cpSync(path.join(WEB, "build"), dir, { recursive: true });
  builds[id] = dir;
}
let current = builds.buildN000000 as string;
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
};
const missing: string[] = [];
const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", ORIGIN);
  if (url.pathname.startsWith("/api/")) {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(url.pathname.endsWith("/health") ? '{"ok":true,"version":"x","hub":"down","db":"ok"}' : "{}");
    return;
  }
  let file = path.join(current, decodeURIComponent(url.pathname));
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!fs.existsSync(file)) {
    if (url.pathname.startsWith("/_app/")) missing.push(url.pathname);
    file = path.join(current, "200.html");
  }
  const immutable = url.pathname.startsWith("/_app/immutable/");
  res.writeHead(fs.existsSync(file) ? 200 : 404, {
    "content-type": TYPES[path.extname(file)] ?? "application/octet-stream",
    "cache-control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
  });
  res.end(fs.existsSync(file) ? fs.readFileSync(file) : "");
});
await new Promise<void>((r) => server.listen(PORT, "127.0.0.1", r));

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await (await browser.newContext()).newPage();
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
const build = async () => (await page.locator(".site .build").textContent())?.trim() ?? "";
const swVersion = () =>
  page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        const c = navigator.serviceWorker.controller;
        if (!c) return resolve("");
        navigator.serviceWorker.addEventListener("message", (e) => resolve(String(e.data?.version ?? "")), {
          once: true,
        });
        c.postMessage({ type: "version" });
        setTimeout(() => resolve("timeout"), 3000);
      }),
  );
try {
  await page.goto(`${ORIGIN}/`);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  check("build N is controlled by its service worker", (await swVersion()) === "buildN000000");
  check("build N footer", (await build()) === "Build buildN000000", await build());

  current = builds.buildN100000 as string; // the deploy
  await page.reload();
  check("one reload after the deploy shows N+1's HTML", (await build()) === "Build buildN100000", await build());
  const scripts = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .map((e) => new URL(e.name).pathname)
      .filter((p) => p.startsWith("/_app/immutable/") && p.endsWith(".js")),
  );
  const fromN1 = scripts.filter((p) => fs.existsSync(path.join(builds.buildN100000 as string, p)));
  check(
    "the JS that ran is N+1's",
    scripts.length > 0 && fromN1.length === scripts.length,
    `${fromN1.length}/${scripts.length}`,
  );
  // The browser checks for a new worker on each navigation; it must take over with no prompt.
  let v = "";
  const t0 = Date.now();
  while (Date.now() - t0 < 15000) {
    v = await swVersion();
    if (v === "buildN100000") break;
    await page.waitForTimeout(250);
  }
  check("the new service worker took over with no waiting step", v === "buildN100000", `${v} in ${Date.now() - t0} ms`);
  await page.goto(`${ORIGIN}/how/`);
  check("after the takeover, another page is N+1 too", (await build()) === "Build buildN100000");
  check(
    "no missing chunk and no page error",
    missing.length === 0 && errors.length === 0,
    [...missing, ...errors].join(", "),
  );

  await page.context().setOffline(true);
  await page.reload();
  check("offline: the cached page still opens", (await build()) === "Build buildN100000");
} finally {
  await browser.close();
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(
  OUT,
  `${lines.join("\n")}\n${failed ? `${failed} FAILED` : "all passed"} (${new Date().toISOString()})\n`,
);
log(failed ? `${failed} FAILED` : "all passed");
process.exit(failed ? 1 : 0);
