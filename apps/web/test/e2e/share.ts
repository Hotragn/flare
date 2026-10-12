// Share from the host's phone (founder bug: Brave on iPhone, share tapped, WhatsApp never
// opened). navigator.share is stubbed in an init script, so this checks our side only: the sheet
// is asked for inside the tap, before any network request (iOS drops the tap after an await);
// a closed sheet changes nothing; a failed or missing sheet turns Share into Copy link, which
// writes to the clipboard and shows a toast; any WhatsApp control is a real https://wa.me link.
// Real server, real hub, PGlite. Chrome always; WebKit too when Playwright's WebKit is installed.
// Usage: npm run build && node apps/web/test/e2e/share.ts
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type Browser, chromium, type Page, webkit } from "playwright-core";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const OUT = path.join(ROOT, "docs/frontend/evidence");
const PHOTO = path.join(ROOT, "apps/web/static/demo/pond.jpg");
const axe = fs.readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const PORT = 8874;
const URL0 = `http://localhost:${PORT}`;
const fails: string[] = [];
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) fails.push(name);
  console.info(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
};

const env = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  FLARE_ENV_FILE: path.join(ROOT, "node_modules/.cache/no-such.env"), // never the real .env
  LOG_LEVEL: "warn",
  HUB_SECRET: randomBytes(24).toString("base64url"),
};
const server = spawn(process.execPath, ["apps/server/src/main.ts"], {
  cwd: ROOT,
  env: { ...env, PORT: String(PORT), DATABASE_URL: "pglite:memory", PUBLIC_BASE_URL: URL0 },
  stdio: "ignore",
});
const hub = spawn(process.execPath, ["apps/hub/src/main.ts"], {
  cwd: ROOT,
  env: { ...env, FLARE_SERVER_URL: `ws://localhost:${PORT}` },
  stdio: "ignore",
});
const stop = () => {
  hub.kill("SIGTERM");
  server.kill("SIGTERM");
};
process.on("exit", stop);
for (let i = 0; i < 240; i++) {
  const h = await fetch(`${URL0}/api/v1/health`).then(
    (r) => r.json() as Promise<{ hub: string }>,
    () => ({ hub: "" }),
  );
  if (h.hub === "connected") break;
  await new Promise((r) => setTimeout(r, 250));
}

type Mode = "ok" | "abort" | "fail" | "none";
type Log = { log: string[]; shares: { inClick: boolean; url: string }[]; copied: string[] };

/** Runs in the page before the app. Logs clicks, fetches and share calls in order. */
function stubs(mode: Mode) {
  const w = window as unknown as Log & { __inClick: boolean };
  w.log = [];
  w.shares = [];
  w.copied = [];
  w.__inClick = false;
  try {
    localStorage.setItem("flare.onboarded", "1");
  } catch {}
  // Capture on window runs first; bubble on window runs after Svelte's delegated handlers.
  addEventListener("click", () => ((w.__inClick = true), w.log.push("click")), true);
  addEventListener("click", () => (w.__inClick = false));
  const f = window.fetch;
  window.fetch = (...a: Parameters<typeof fetch>) => (w.log.push("fetch"), f(...a));
  const n = navigator as Navigator & { share?: unknown };
  if (mode === "none") {
    Object.defineProperty(n, "share", { value: undefined, configurable: true });
  } else {
    Object.defineProperty(n, "share", {
      configurable: true,
      value: (d: ShareData) => {
        w.log.push("share");
        w.shares.push({ inClick: w.__inClick, url: String(d.url ?? "") });
        if (mode === "abort") return Promise.reject(new DOMException("closed", "AbortError"));
        if (mode === "fail") return Promise.reject(new DOMException("no activation", "NotAllowedError"));
        return Promise.resolve();
      },
    });
  }
  // The clipboard: record what is written, then pass it on when the browser allows it.
  const c = navigator.clipboard;
  const real = c?.writeText?.bind(c);
  const writeText = async (s: string) => {
    w.copied.push(s);
    await real?.(s).catch(() => {});
  };
  if (c) Object.defineProperty(c, "writeText", { configurable: true, value: writeText });
  else Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
}

async function sendFlare(page: Page): Promise<void> {
  await page.goto(`${URL0}/app/`);
  await page.getByRole("button", { name: "Light a Flare" }).click({ timeout: 15_000 });
  await page.locator('input[type="file"]').setInputFiles(PHOTO);
  await page.getByRole("button", { name: /Use this|Use my words/ }).waitFor({ timeout: 20_000 });
  const where = page.getByLabel("Where are you?");
  if (await where.isVisible().catch(() => false)) {
    await where.fill("Ford Woods Park, by the pond");
    await page.getByRole("button", { name: "Not now" }).click();
  }
  const use = page.getByRole("button", { name: "Use this" });
  if (
    await use.waitFor({ timeout: 15_000 }).then(
      () => true,
      () => false,
    )
  )
    await use.click();
  else {
    await page.getByRole("textbox").first().fill("Pond walk, come sit");
    await page.getByRole("button", { name: "Use my words" }).click();
  }
  const name = page.getByLabel("Your first name");
  if (await name.isVisible().catch(() => false)) await name.fill("Fuego");
  const typed = page.getByLabel("Where are you?");
  if (await typed.isVisible().catch(() => false)) await typed.fill("Ford Woods Park, by the pond");
  await page.getByRole("button", { name: "Send it" }).click();
  await page.getByRole("heading", { name: "Sent." }).waitFor({ timeout: 20_000 });
  await page.waitForTimeout(300);
}

const logOf = (p: Page) => p.evaluate(() => (window as unknown as Log).log.slice());
const sharesOf = (p: Page) => p.evaluate(() => (window as unknown as Log).shares.slice());
const copiedOf = (p: Page) => p.evaluate(() => (window as unknown as Log).copied.slice());

async function axeRun(page: Page): Promise<string[]> {
  await page.addScriptTag({ content: axe });
  return page.evaluate(async () => {
    type V = { id: string; nodes: unknown[] };
    const a = (window as unknown as { axe: { run(d: Document, o: unknown): Promise<{ violations: V[] }> } }).axe;
    const r = await a.run(document, { runOnly: ["wcag2a", "wcag2aa", "best-practice"] });
    return r.violations.map((v) => `${v.id} (${v.nodes.length})`);
  });
}

async function run(name: string, browser: Browser, real: boolean) {
  const open = async (mode: Mode) => {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      bypassCSP: true, // only so axe can be injected; the app's own scripts are unchanged
      hasTouch: true,
      isMobile: name === "chrome",
      permissions: real ? ["geolocation", "clipboard-read", "clipboard-write"] : ["geolocation"],
      geolocation: { latitude: 42.3196, longitude: -83.2129 },
    });
    await ctx.addInitScript(stubs, mode);
    const page = await ctx.newPage();
    page.on("pageerror", (e) => fails.push(`${name} ${mode}: ${e.message}`));
    return page;
  };
  const tag = (s: string) => `[${name}] ${s}`;

  // 1. Slow network (every API call waits 1.5 s, so Send's seal and POST take a while): Send makes
  // the Flare and opens no sheet; the Share step's tap calls navigator.share inside the click,
  // before any fetch. Before the fix, Send called share after its await, outside the tap.
  let page = await open("ok");
  try {
    await page.route("**/api/v1/**", async (r) => {
      await new Promise((ok) => setTimeout(ok, 1500));
      await r.continue();
    });
    await sendFlare(page);
    check(tag("slow Send: no share call after the await"), (await sharesOf(page)).length === 0);
    check(tag("H4: Share is the main button"), await page.locator("button", { hasText: /^Share$/ }).first().isVisible());
    const before = (await logOf(page)).length;
    await page.getByRole("button", { name: "Share", exact: true }).click();
    await page.waitForTimeout(300);
    const after = (await logOf(page)).slice(before);
    const tap = (await sharesOf(page)).at(-1);
    check(tag("Share calls navigator.share inside the click"), tap?.inClick === true);
    check(tag("no network request between the tap and the share call"), after[0] === "click" && after[1] === "share", after.join(" "));
    check(tag("the shared url is the Flare link"), /\/g\/[0-9a-f-]{36}\/#k=/.test(tap?.url ?? ""), tap?.url);
    const wa = await page.evaluate(() =>
      [...document.querySelectorAll("a, button")]
        .filter((el) => /whats\s?app|wa\.me|whatsapp:/i.test(`${el.textContent} ${el.getAttribute("href") ?? ""} ${el.getAttribute("aria-label") ?? ""}`))
        .map((el) => ({ tag: el.tagName, href: el.getAttribute("href") ?? "" })),
    );
    check(
      tag("every WhatsApp control is an <a href=https://wa.me/...>"),
      wa.every((x) => x.tag === "A" && x.href.startsWith("https://wa.me/")),
      `${wa.length} found`,
    );
  } catch (e) {
    fails.push(tag(e instanceof Error ? (e.message.split("\n")[0] ?? "error") : String(e)));
    await page.screenshot({ path: path.join(OUT, `e2e-share-${name}-fail.png`) }).catch(() => {});
  }
  await page.context().close();

  // 2. AbortError (the host closed the sheet): Share stays Share, no toast.
  page = await open("abort");
  try {
    await sendFlare(page);
    await page.getByRole("button", { name: "Share", exact: true }).click();
    await page.waitForTimeout(300);
    check(tag("AbortError: Share stays"), await page.getByRole("button", { name: "Share", exact: true }).isVisible());
    check(tag("AbortError: no Copy link"), (await page.getByRole("button", { name: "Copy link" }).count()) === 0);
  } catch (e) {
    fails.push(tag(e instanceof Error ? (e.message.split("\n")[0] ?? "error") : String(e)));
  }
  await page.context().close();

  // 3. The sheet fails (NotAllowedError): Share turns into Copy link, which copies and toasts.
  page = await open("fail");
  try {
    await sendFlare(page);
    await page.getByRole("button", { name: "Share", exact: true }).click();
    await page.getByText("Share did not open. Tap Copy link.").waitFor({ timeout: 5000 });
    check(tag("failed sheet: a toast says so, nothing swallowed"), true);
    await page.getByRole("button", { name: "Copy link" }).click({ timeout: 5000 });
    await page.getByText("Link copied. Paste it in your chat.").waitFor({ timeout: 5000 });
    const copied = await copiedOf(page);
    check(tag("failed sheet: Copy link writes the link"), /\/g\/[0-9a-f-]{36}\/#k=/.test(copied[0] ?? ""));
  } catch (e) {
    fails.push(tag(e instanceof Error ? (e.message.split("\n")[0] ?? "error") : String(e)));
  }
  await page.context().close();

  // 4. No navigator.share at all: Copy link from the start; the clipboard holds the link; axe 0.
  page = await open("none");
  try {
    await sendFlare(page);
    check(tag("no share: Share is not offered"), (await page.getByRole("button", { name: "Share", exact: true }).count()) === 0);
    await page.getByRole("button", { name: "Copy link" }).click();
    await page.getByText("Link copied. Paste it in your chat.").waitFor({ timeout: 5000 });
    const copied = await copiedOf(page);
    check(tag("no share: Copy link writes the link"), /\/g\/[0-9a-f-]{36}\/#k=/.test(copied[0] ?? ""));
    if (real) {
      const clip = await page.evaluate(() => navigator.clipboard.readText?.() ?? "").catch(() => "");
      check(tag("no share: the real clipboard holds the link"), clip === copied[0], clip.slice(0, 60));
    }
    const v = await axeRun(page);
    check(tag("axe on H4 with Copy link and the toast: 0"), v.length === 0, v.join(", "));
    if (name === "chrome") await page.screenshot({ path: path.join(OUT, "share-copy-link.png") });
  } catch (e) {
    fails.push(tag(e instanceof Error ? (e.message.split("\n")[0] ?? "error") : String(e)));
    await page.screenshot({ path: path.join(OUT, `e2e-share-${name}-fail.png`) }).catch(() => {});
  }
  await page.context().close();
}

const chrome = await chromium.launch({ channel: "chrome" });
await run("chrome", chrome, true);
await chrome.close();
const wk = await webkit.launch().catch((e: Error) => {
  console.info(`SKIP webkit: ${e.message.split("\n")[0]}`);
  return null;
});
if (wk) {
  await run("webkit", wk, false);
  await wk.close();
}
stop();
console.info(fails.length ? `\nFAIL ${fails.join(" | ")}` : `\nshare e2e: all pass (chrome${wk ? " + webkit" : ""})`);
process.exit(fails.length ? 1 : 0);
