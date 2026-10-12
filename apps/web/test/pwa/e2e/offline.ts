// PWA end-to-end test in Google Chrome (playwright-core, no browser download): service worker
// precache and offline reload (SRS-OFF-4), saved Lit data offline (SRS-OFF-1, T-OFF-1 data
// part), outbox replay exactly once offline and on a flaky network (SRS-OFF-3, T-OFF-2),
// live view under a throttled network (SRS-SOL-3), sealed push notices (SRS-IF-3), and the
// update flow. Usage: npm run build && node apps/web/test/pwa/e2e/offline.ts
// Writes docs/pwa/evidence/e2e-offline.txt. Port 8871 (PWA range 8870 to 8879).
import fs from "node:fs";
import type http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ClientIcd } from "@flare/shared/icd/index";
import { chromium } from "playwright-core";
import { build } from "vite";
import type { aad } from "../../../src/lib/crypto/index.ts";
import type { FlareLive } from "../../../src/lib/live/index.ts";
import type { FlareOutbox } from "../../../src/lib/outbox/index.ts";
import type { FlareStore } from "../../../src/lib/store/index.ts";
import { startFakeApi } from "../fakes/api.ts";

/** What harness.ts puts on window. */
type Win = {
  pwa: { crypto: ClientIcd.Crypto; store: FlareStore; outbox: FlareOutbox; live: FlareLive; aad: typeof aad };
  views: { v: unknown; o: number }[];
  stopOutbox?: () => void;
};

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../../../..");
const WEB_BUILD = path.join(ROOT, "apps/web/build");
const OUT = path.join(ROOT, "docs/pwa/evidence/e2e-offline.txt");
const PORT = Number(process.env.PWA_E2E_PORT ?? 8871);
const ORIGIN = `http://127.0.0.1:${PORT}`;
const GROUP = "11111111-1111-4111-8111-111111111111";
const GATH = "22222222-2222-4222-8222-222222222222";
const OTHER = "33333333-3333-4333-8333-333333333333";
const MAP_FIXTURE = JSON.stringify({ test: "map pack stand-in: MAP's pack is not on this branch" });

if (!fs.existsSync(path.join(WEB_BUILD, "service-worker.js"))) {
  process.stderr.write("FAIL no web build with a service worker: run npm run build\n");
  process.exit(1);
}

const lines: string[] = [];
let failed = 0;
const log = (s: string) => {
  lines.push(s);
  process.stdout.write(`${s}\n`);
};
function check(name: string, ok: boolean, detail = "") {
  if (!ok) failed++;
  log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
}

// 1. Harness bundle with the real modules.
const harnessDir = fs.mkdtempSync(path.join(os.tmpdir(), "flare-pwa-"));
await build({
  configFile: false,
  logLevel: "warn",
  root: ROOT,
  build: {
    outDir: harnessDir,
    emptyOutDir: true,
    minify: false,
    lib: { entry: path.join(HERE, "harness.ts"), formats: ["es"], fileName: () => "harness.js" },
  },
});
const harnessJs = fs.readFileSync(path.join(harnessDir, "harness.js"));

// 2. One origin: the web build, the harness and the fake API.
let swSuffix = "";
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};
function serveStatic(req: http.IncomingMessage, res: http.ServerResponse): boolean {
  const url = new URL(req.url ?? "/", ORIGIN);
  if (url.pathname.startsWith("/api/")) return false;
  const send = (status: number, type: string, body: Buffer | string) => {
    res.writeHead(status, { "content-type": type, "cache-control": "no-cache" });
    res.end(body);
    return true;
  };
  if (url.pathname === "/__pwa/harness.js") return send(200, TYPES[".js"] as string, harnessJs);
  if (url.pathname === "/__pwa/") {
    send(
      200,
      TYPES[".html"] as string,
      '<!doctype html><title>harness</title><body><script type="module" src="/__pwa/harness.js"></script>',
    );
    return true;
  }
  if (url.pathname === "/service-worker.js") {
    send(200, TYPES[".js"] as string, fs.readFileSync(path.join(WEB_BUILD, "service-worker.js"), "utf8") + swSuffix);
    return true;
  }
  let file = path.join(WEB_BUILD, decodeURIComponent(url.pathname));
  if (!file.startsWith(WEB_BUILD)) return send(403, "text/plain", "no");
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (fs.existsSync(file)) {
    send(200, TYPES[path.extname(file)] ?? "application/octet-stream", fs.readFileSync(file));
    return true;
  }
  if (url.pathname === "/maps/fairlane.json") return send(200, TYPES[".json"] as string, MAP_FIXTURE);
  const shell = ["200.html", "404.html"].map((f) => path.join(WEB_BUILD, f)).find((f) => fs.existsSync(f));
  if (shell) send(200, TYPES[".html"] as string, fs.readFileSync(shell));
  else send(404, "text/plain", "not found");
  return true;
}
const api = await startFakeApi(PORT, serveStatic);
const view = (version: number, extra: Record<string, unknown> = {}) => ({
  id: GATH,
  group_id: GROUP,
  state: "kindling",
  need: 2,
  version,
  server_time: new Date().toISOString(),
  ...extra,
});

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const until = async (fn: () => Promise<boolean> | boolean, ms = 8000) => {
  const t = Date.now();
  while (!(await fn())) {
    if (Date.now() - t > ms) return false;
    await new Promise((r) => setTimeout(r, 50));
  }
  return true;
};

try {
  log(`# PWA e2e, ${new Date().toISOString()}, Chrome ${browser.version()}, 390 x 844`);

  // A. Install and control.
  const t0 = Date.now();
  await page.goto(`${ORIGIN}/`);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
  check("SW installs and controls the page after one reload", controlled, `${Date.now() - t0} ms`);
  const cached = await page.evaluate(async () => {
    const names = await caches.keys();
    const c = await caches.open(names.find((n) => n.startsWith("flare-")) ?? "none");
    return { names, keys: (await c.keys()).map((r) => new URL(r.url).pathname) };
  });
  check(
    "one versioned cache",
    cached.names.filter((n) => n.startsWith("flare-")).length === 1,
    cached.names.join(", "),
  );
  check(
    "precache has the shell, /hello/ and the map pack",
    ["/", "/hello/", "/maps/fairlane.json"].every((k) => cached.keys.includes(k)),
    `${cached.keys.length} entries`,
  );
  check(
    "precache skips splash and the device-check kit",
    !cached.keys.some((k) => k.startsWith("/splash/") || k.startsWith("/check/")),
  );

  // C (online part). Saved Lit data and a group key, written by the real store.
  await page.goto(`${ORIGIN}/__pwa/`);
  await page.waitForSelector("body[data-ready]", { state: "attached" });
  await page.evaluate(
    async ({ GROUP, GATH }) => {
      const { crypto, store } = (globalThis as unknown as Win).pwa;
      const { key } = await crypto.newGroupKey();
      await store.saveGroup({
        groupId: GROUP,
        key,
        memberId: "m1",
        token: "tok_tok_tok_tok_tok_to",
        names: { m1: "Fuego" },
      });
      await store.rememberGathering(GATH, GROUP);
      await store.saveLit(GATH, {
        spot: "Ford Woods Park pond",
        target: { lat: 42.3, lon: -83.21 },
        access: "Bench 40 m",
      });
    },
    { GROUP, GATH },
  );

  // B. Airplane mode.
  await context.setOffline(true);
  const offStart = Date.now();
  await page.goto(`${ORIGIN}/`);
  const h1 = await page.textContent("h1").catch(() => null);
  // `/` is the website's home since integration (url-map.md); any rendered h1 proves the shell loaded.
  check("SRS-OFF-4: app shell loads offline", !!h1 && h1.length > 0, `h1=${h1}, ${Date.now() - offStart} ms`);
  await page.goto(`${ORIGIN}/hello/`);
  check(
    "SRS-OFF-4: a prerendered page loads offline",
    (await page.textContent("h1").catch(() => null)) === "Hello, hub",
  );
  const spa = await page
    .goto(`${ORIGIN}/g/${GATH}/`)
    .then((r) => r?.status() ?? 0)
    .catch(() => 0);
  check("SRS-OFF-4: an SPA link route gets the cached shell offline", spa === 200, `status ${spa}`);
  await page.goto(`${ORIGIN}/`);
  const mapOk = await page.evaluate(() =>
    fetch("/maps/fairlane.json")
      .then((r) => r.ok)
      .catch(() => false),
  );
  check("ADR-0010: the map pack answers offline", mapOk);
  const lit = await page.evaluate(
    (GATH) =>
      new Promise<unknown>((resolve) => {
        const req = indexedDB.open("flare");
        req.onsuccess = () => {
          const get = req.result.transaction("lit").objectStore("lit").get(GATH);
          get.onsuccess = () => resolve(get.result?.data ?? null);
          get.onerror = () => resolve(null);
        };
        req.onerror = () => resolve(null);
      }),
    GATH,
  );
  check(
    "SRS-OFF-1 / T-OFF-1 (data): saved Lit data reads back in airplane mode",
    JSON.stringify(lit).includes("Ford Woods Park pond"),
    JSON.stringify(lit),
  );
  await context.setOffline(false);

  // D. Outbox: offline taps, then reconnect.
  await page.goto(`${ORIGIN}/__pwa/`);
  await page.waitForSelector("body[data-ready]", { state: "attached" });
  await page.evaluate(() => {
    (globalThis as unknown as Win).stopOutbox = (globalThis as unknown as Win).pwa.outbox.start(window);
  });
  await context.setOffline(true);
  const queued = await page.evaluate(async (GATH) => {
    const { outbox } = (globalThis as unknown as Win).pwa;
    const out: unknown[] = [];
    for (let i = 0; i < 5; i++)
      out.push(await outbox.send({ method: "POST", path: `/api/v1/gatherings/${GATH}/arrivals`, body: { i } }));
    return { out, size: await outbox.size() };
  }, GATH);
  check(
    "SRS-OFF-3: 5 offline taps queue (send resolves null)",
    queued.out.every((x) => x === null) && queued.size === 5,
    `size ${queued.size}`,
  );
  const before = api.effects.length;
  await context.setOffline(false);
  const flushed = await until(() => api.effects.length - before === 5);
  const left = await page.evaluate(() => (globalThis as unknown as Win).pwa.outbox.size());
  check(
    "SRS-OFF-3: the online event sends all 5, in order, once",
    flushed && left === 0 && api.effects.slice(before).every((e, i) => (e.body as { i: number }).i === i),
    `effects ${api.effects.length - before}, left ${left}`,
  );

  // D2. Flaky network: lost responses and 503s, 20 taps.
  const b2 = api.effects.length;
  const r2 = api.replays;
  const pattern: ("none" | "drop" | "error")[] = [
    "drop",
    "none",
    "error",
    "drop",
    "none",
    "none",
    "drop",
    "error",
    "none",
    "drop",
  ];
  api.faults = Array.from({ length: 60 }, (_, i) => pattern[i % pattern.length] ?? "none");
  await page.evaluate(async (GATH) => {
    const { outbox } = (globalThis as unknown as Win).pwa;
    for (let i = 0; i < 20; i++)
      await outbox.send({ method: "POST", path: `/api/v1/gatherings/${GATH}/arrivals`, body: { i: 100 + i } });
    for (let k = 0; k < 60 && (await outbox.size()) > 0; k++) await outbox.flush();
  }, GATH);
  const flaky = api.effects.slice(b2);
  const idems = new Set(flaky.map((e) => e.idem));
  check(
    "T-OFF-2: 20 taps on a flaky network are applied exactly once each, in order",
    flaky.length === 20 && idems.size === 20 && flaky.every((e, i) => (e.body as { i: number }).i === 100 + i),
    `effects ${flaky.length}, unique keys ${idems.size}, replays served ${api.replays - r2}`,
  );
  api.faults = [];

  // E. Throttled network (CDP): ~400 ms latency, 400 kbit/s down, 150 kbit/s up.
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 400,
    downloadThroughput: 50_000,
    uploadThroughput: 18_750,
  });
  api.setView(view(1));
  await page.evaluate((GATH) => {
    (globalThis as unknown as Win).views = [];
    (globalThis as unknown as Win).pwa.live.follow(GATH, (v: unknown, o: number) =>
      (globalThis as unknown as Win).views.push({ v, o }),
    );
  }, GATH);
  await until(
    async () =>
      (await page.evaluate(() => (globalThis as unknown as Win).views.length)) >= 1 && api.sseConnects.length >= 1,
    15000,
  );
  const tPush = Date.now();
  api.push(view(2, { need: 1 }));
  const gotIt = await until(
    async () => (await page.evaluate(() => (globalThis as unknown as Win).views.length)) >= 2,
    10000,
  );
  check(
    "SRS-SOL-3: under throttling a change reaches the page within 5 s",
    gotIt && Date.now() - tPush < 5000,
    `${Date.now() - tPush} ms`,
  );
  const tTap = Date.now();
  const res = await page.evaluate(
    (GATH) =>
      (globalThis as unknown as Win).pwa.outbox.send({
        method: "PUT",
        path: `/api/v1/gatherings/${GATH}/me`,
        body: { answer: "yes" },
      }),
    GATH,
  );
  check("outbox write under throttling is confirmed", !!res, `${Date.now() - tTap} ms round trip`);
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });

  // F. Push notices through the real service worker (CDP delivers the push message).
  await context.grantPermissions(["notifications"], { origin: ORIGIN });
  const notice = await page.evaluate(async (GATH) => {
    const { crypto, store, aad } = (globalThis as unknown as Win).pwa;
    const g = await store.groupOf(GATH);
    if (!g) throw new Error("group not saved");
    return crypto.sealJson(g.key, aad.notice(GATH), { v: 1, host: "Fuego", spot: "Ford Woods Park pond" });
  }, GATH);
  const swCdp = await context.newCDPSession(page);
  const regs: { registrationId: string; scopeURL: string }[] = [];
  swCdp.on(
    "ServiceWorker.workerRegistrationUpdated",
    (e: { registrations: { registrationId: string; scopeURL: string }[] }) => regs.push(...e.registrations),
  );
  await swCdp.send("ServiceWorker.enable");
  await until(() => regs.some((r) => r.scopeURL === `${ORIGIN}/`));
  const registrationId = regs.find((r) => r.scopeURL === `${ORIGIN}/`)?.registrationId ?? "";
  const deliver = (data: unknown) =>
    swCdp.send("ServiceWorker.deliverPushMessage", { origin: ORIGIN, registrationId, data: JSON.stringify(data) });
  const bodies = async () =>
    page.evaluate(async () =>
      (await (await navigator.serviceWorker.ready).getNotifications()).map((n) => `${n.title} | ${n.body}`),
    );
  await deliver({ v: 1, g: GATH, kind: "flare", event: "lit", notice_ct: notice });
  await until(async () => (await bodies()).length >= 1);
  const b1 = await bodies();
  check(
    "SRS-IF-3: push opens notice_ct with the key from IndexedDB",
    b1.includes("Fuego's Flare | It's lit. Fuego is at Ford Woods Park pond."),
    JSON.stringify(b1),
  );
  await deliver({ v: 1, g: OTHER, kind: "flare", event: "lit", notice_ct: notice });
  await until(async () => (await bodies()).length >= 2);
  const b2b = await bodies();
  check(
    "ADR-0014: no key on this phone shows the generic notice",
    b2b.includes("Flare | It's lit. Open Flare to see where."),
    JSON.stringify(b2b),
  );

  // G. Update flow (live bug 6): a new worker takes over at once, with no prompt to wait for.
  await page.goto(`${ORIGIN}/`);
  swSuffix = `\n// update ${Date.now()}\n`;
  const switched = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    const changed = new Promise<boolean>((resolve) => {
      navigator.serviceWorker.addEventListener("controllerchange", () => resolve(true), { once: true });
      setTimeout(() => resolve(false), 8000);
    });
    await reg.update();
    return changed;
  });
  check("update: the new version takes over at once (skipWaiting, controllerchange)", switched);
  const names = await page.evaluate(async () => (await caches.keys()).filter((n) => n.startsWith("flare-")));
  check("versioning: still one flare cache after the update", names.length === 1, names.join(", "));
} catch (e) {
  failed++;
  log(`FAIL crashed: ${(e as Error).message}`);
} finally {
  await browser.close();
  await api.close();
  fs.rmSync(harnessDir, { recursive: true, force: true });
}

log(`${failed === 0 ? "ALL PASS" : `${failed} FAILED`}`);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${lines.join("\n")}\n`);
process.exit(failed === 0 ? 0 : 1);
