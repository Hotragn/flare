// Photo-fit gate (live bug, 11 Oct): a friend opened a dim indoor photo in Brave on an iPhone
// and saw only the top third of it, under the six words and the sheet. Every older test used
// bright daylight photos on a full 390 x 844 viewport. This one sends a Flare with two photos
// on three viewports and, at first paint of each photo screen (H2 Develop, H3 Send, I1 Invite),
// measures how much of the photo is covered by text or by a sheet. It fails over 25%.
//
// Photos (apps/web/test/fixtures, credits in docs/credits/photos.md):
//   dark: "darkened real photo". The repo has no real indoor photo, so this is the CC0 Autumn
//         trail photo scaled to 1024 px with its light cut to 22% (mean luma about 0.10).
//   tall: a 9:16 portrait crop of the public-domain Pictured Rocks cliffs photo, 720 x 1280.
// Viewports: 390 x 664 (Brave or a WhatsApp in-app browser with a bottom bar), 375 x 667
// (iPhone SE), 390 x 844 (the older tests).
// Also checks: the dark photo gets a display-only filter and the bright one doesn't; the photo
// the friend decrypts is byte-for-byte the photo the host saw on Send (the filter never touches
// bytes); the main button is on screen without scrolling; the privacy tip is one line at
// 375 px and stays closed after a reload; tapping the photo opens a full-screen dialog with a
// 44 px close button, Escape closes it and focus goes back to the photo. axe (WCAG 2 A and AA,
// best practice) on each photo screen at 390 x 664, and on the open viewer.
// Real built app, in-memory fake API (serve.ts), Chrome. No network beyond localhost.
// Usage: npm run build && node apps/web/test/e2e/photo-fit.ts [before]
//   `before` only names the screenshots *-before.png and skips the checks main can't pass.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright-core";
import { startServer } from "./serve.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const OUT = path.join(ROOT, "docs/frontend/evidence/photo-fit");
const FIX = path.join(ROOT, "apps/web/test/fixtures");
const BEFORE = process.argv.includes("before");
const MAX_COVER = 0.25;
fs.mkdirSync(OUT, { recursive: true });

const PHOTOS = [
  { name: "dark", label: "darkened real photo", file: path.join(FIX, "photo-dark-autumn-trail.jpg"), dark: true },
  {
    name: "tall",
    label: "portrait crop of a real photo",
    file: path.join(FIX, "photo-tall-pictured-rocks.jpg"),
    dark: false,
  },
];
const VIEWPORTS = [
  { width: 390, height: 664 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
];

const AXE = fs.readFileSync(path.join(ROOT, "node_modules/axe-core/axe.min.js"), "utf8");
const fails: string[] = [];
const rows: string[] = [];
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) fails.push(name);
  console.info(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
};

/** The photo on screen: the in-flow photo (fix) or the full-bleed backdrop (main). */
const PHOTO_SEL = ".pf img, .print img, img.backdrop";

async function photoReady(page: Page) {
  await page.waitForFunction(
    (sel) => {
      const img = document.querySelector<HTMLImageElement>(sel);
      return !!img && img.complete && img.naturalWidth > 0 && img.getBoundingClientRect().height > 0;
    },
    PHOTO_SEL,
    { timeout: 15_000 },
  );
  await page.waitForTimeout(700); // the lazy light check and any layout settle
}

/** Share of the photo's on-screen area covered by the union of text boxes and sheets. */
function coverage(page: Page) {
  return page.evaluate((sel) => {
    const img = document.querySelector<HTMLImageElement>(sel);
    if (!img) return { cover: 1, filter: "", luma: "", shown: 0 };
    const vw = innerWidth;
    const vh = innerHeight;
    const r = img.getBoundingClientRect();
    const P = { l: Math.max(0, r.left), t: Math.max(0, r.top), r: Math.min(vw, r.right), b: Math.min(vh, r.bottom) };
    const boxes: { l: number; t: number; r: number; b: number }[] = [];
    const add = (b: DOMRect) => {
      if (b.width > 0 && b.height > 0) boxes.push({ l: b.left, t: b.top, r: b.right, b: b.bottom });
    };
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      if (!n.textContent?.trim()) continue;
      const el = n.parentElement;
      if (!el || el.closest(".visually-hidden, dialog:not([open]), script, style")) continue;
      if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      for (const b of range.getClientRects()) add(b);
    }
    for (const s of document.querySelectorAll<HTMLElement>(".sheet"))
      if (s.checkVisibility()) add(s.getBoundingClientRect());
    // Union by sampling a 2 px grid over the photo.
    let inside = 0;
    let covered = 0;
    for (let y = P.t + 1; y < P.b; y += 2)
      for (let x = P.l + 1; x < P.r; x += 2) {
        inside++;
        if (boxes.some((b) => x >= b.l && x < b.r && y >= b.t && y < b.b)) covered++;
      }
    // How much of the photo is on screen: object-fit cover crops a portrait on a wide box, and a
    // full-bleed backdrop crops whatever falls off the viewport.
    const fit = getComputedStyle(img).objectFit;
    const sx = r.width / img.naturalWidth;
    const sy = r.height / img.naturalHeight;
    const scale = fit === "cover" ? Math.max(sx, sy) : Math.min(sx, sy);
    const drawn = img.naturalWidth * scale * img.naturalHeight * scale;
    return {
      cover: inside ? covered / inside : 1,
      filter: getComputedStyle(img).filter,
      luma: img.dataset.luma ?? "",
      shown: Math.min(1, ((P.r - P.l) * (P.b - P.t)) / drawn),
    };
  }, PHOTO_SEL);
}

const hashOf = (page: Page) =>
  page.evaluate(async (sel) => {
    const img = document.querySelector<HTMLImageElement>(sel);
    if (!img) return "";
    const buf = await (await fetch(img.src)).arrayBuffer();
    return [...new Uint8Array(await crypto.subtle.digest("SHA-256", buf))]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }, PHOTO_SEL);

/** The main button's bottom edge is inside the viewport (no scroll needed). */
const onScreen = (page: Page, name: string | RegExp) =>
  page
    .getByRole("button", { name })
    .first()
    .evaluate((b) => {
      const r = b.getBoundingClientRect();
      return r.bottom <= innerHeight && r.top >= 0;
    });

async function measure(
  page: Page,
  screen: string,
  photo: (typeof PHOTOS)[number],
  vp: { width: number; height: number },
  main: string | RegExp,
) {
  await photoReady(page);
  const m = await coverage(page);
  const pct = Math.round(m.cover * 1000) / 10;
  const shownPct = Math.round(m.shown * 1000) / 10;
  const tag = `${screen} ${photo.name} ${vp.width}x${vp.height}`;
  rows.push(
    `${tag}: ${pct}% covered, ${shownPct}% of the photo on screen${m.luma ? `, luma ${m.luma}` : ""}${m.filter && m.filter !== "none" ? `, ${m.filter}` : ""}`,
  );
  check(`${tag}: text and sheets cover at most 25% of the photo`, m.cover <= MAX_COVER, `${pct}%`);
  check(`${tag}: the whole photo is on screen (no crop)`, m.shown >= 0.97, `${shownPct}%`);
  check(`${tag}: the main button fits without scrolling`, await onScreen(page, main));
  if (!BEFORE) {
    if (photo.dark) check(`${tag}: the dark photo is brightened for display`, /brightness/.test(m.filter), m.filter);
    else check(`${tag}: a bright photo has no filter`, !m.filter || m.filter === "none", m.filter);
  }
  if (!BEFORE && vp.height === 664) await audit(page, tag);
  if (vp.width === 390 && vp.height === 664 && photo.dark)
    await page.screenshot({ path: path.join(OUT, `${screen}-${BEFORE ? "before" : "after"}.png`) });
}

type Axe = {
  run: (c: Document, o: object) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }>;
};
async function audit(page: Page, tag: string) {
  await page.evaluate(AXE); // evaluate, not a script tag: the app's CSP blocks inline scripts
  const found = await page.evaluate(async () => {
    const a = (window as unknown as { axe: Axe }).axe;
    const r = await a.run(document, { runOnly: ["wcag2a", "wcag2aa", "best-practice"] });
    return r.violations.map((v) => `${v.id} (${v.nodes.length}): ${v.nodes[0]?.target.join(" ")}`);
  });
  check(`${tag}: axe 0 violations`, found.length === 0, found.join("; "));
}

async function viewer(page: Page, tag: string) {
  const trigger = page.locator(".pf, .print button.image").first();
  await trigger.click();
  const dlg = page.locator("dialog.photo-view[open]");
  const opened = await dlg.waitFor({ timeout: 5000 }).then(
    () => true,
    () => false,
  );
  check(`${tag}: tapping the photo opens it full screen`, opened);
  if (!opened) return;
  await audit(page, `${tag} viewer`);
  const box = await dlg.getByRole("button", { name: "Close" }).boundingBox();
  check(
    `${tag}: the close button is 44 px`,
    !!box && box.width >= 44 && box.height >= 44,
    `${box?.width}x${box?.height}`,
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  check(`${tag}: Escape closes it`, (await page.locator("dialog.photo-view").count()) === 0);
  check(
    `${tag}: focus goes back to the photo`,
    await page.evaluate(() => !!document.activeElement?.matches(".pf, .print button.image")),
  );
}

const srv = await startServer(8879);
const browser = await chromium.launch({ channel: "chrome" });
try {
  for (const photo of PHOTOS)
    for (const vp of VIEWPORTS) {
      const tag = `${photo.name} ${vp.width}x${vp.height}`;
      const phone = { viewport: vp, deviceScaleFactor: 2, hasTouch: true, isMobile: true };
      const hostCtx = await browser.newContext({
        ...phone,
        permissions: ["geolocation", "clipboard-read", "clipboard-write"],
        geolocation: { latitude: 42.3196, longitude: -83.2129 },
      });
      await hostCtx.addInitScript(() => {
        try {
          localStorage.setItem("flare.onboarded", "1");
        } catch {}
      });
      const host = await hostCtx.newPage();
      host.on("pageerror", (e) => fails.push(`host ${tag}: ${e.message}`));
      await host.goto(`${srv.url}/app/`);
      await host.getByRole("button", { name: "Light a Flare" }).click({ timeout: 15_000 });
      await host.locator('input[type="file"]').setInputFiles(photo.file);
      await host.getByRole("button", { name: /Use this|Use my words/ }).waitFor({ timeout: 15_000 });
      await measure(host, "develop", photo, vp, /Use this|Use my words/);
      const sheetWhere = host.getByLabel("Where are you?");
      if (await sheetWhere.isVisible().catch(() => false)) {
        await sheetWhere.fill("Ford Woods Park, by the pond");
        await host.getByRole("button", { name: "Not now" }).click();
      }
      if (!BEFORE && vp.height === 664) await viewer(host, `develop ${tag}`);
      const use = host.getByRole("button", { name: "Use this" });
      if (await use.isVisible().catch(() => false)) await use.click();
      else {
        await host.getByRole("textbox").first().fill("Pond walk, come sit");
        await host.getByRole("button", { name: "Use my words" }).click();
      }
      await host.getByRole("button", { name: "Send it" }).waitFor({ timeout: 15_000 });
      await measure(host, "send", photo, vp, "Send it");
      const sent = await hashOf(host);
      if (!BEFORE && vp.height === 664) await viewer(host, `send ${tag}`);
      const where = host.getByLabel("Where are you?");
      if (await where.isVisible().catch(() => false)) await where.fill("Ford Woods Park, by the pond");
      const name = host.getByLabel("Your first name");
      if (await name.isVisible().catch(() => false)) await name.fill("Fuego");
      await host.getByRole("button", { name: "Send it" }).click();
      await host.getByRole("heading", { name: /^(Sent\.|Ready\. Share the link\.)$/ }).waitFor({ timeout: 15_000 });
      await host.getByRole("button", { name: "Copy as text" }).click();
      const clip = await host.evaluate(() => navigator.clipboard.readText());
      const link = clip.match(/(\/g\/[0-9a-f-]{36}\/#k=[A-Za-z0-9_-]{43})/)?.[1];
      check(`${tag}: the host gets a link`, !!link);
      await hostCtx.close();
      if (!link) continue;

      const friendCtx = await browser.newContext({ ...phone });
      const friend = await friendCtx.newPage();
      friend.on("pageerror", (e) => fails.push(`friend ${tag}: ${e.message}`));
      await friend.goto(srv.url + link);
      await friend.getByRole("button", { name: "I'm in" }).waitFor({ timeout: 15_000 });
      await measure(friend, "invite", photo, vp, "I'm in");
      check(`invite ${tag}: the friend's photo is the bytes the host sent`, !!sent && (await hashOf(friend)) === sent);
      if (!BEFORE && vp.width === 375) {
        const tip = friend.getByRole("note");
        const lines = await tip.evaluate((el) => {
          const s = el.querySelector("span");
          if (!s) return 0;
          const cs = getComputedStyle(s);
          const lh = Number.parseFloat(cs.lineHeight) || Number.parseFloat(cs.fontSize) * 1.25;
          return Math.round(s.getBoundingClientRect().height / lh);
        });
        check(`invite ${tag}: the privacy tip is one line at 375 px`, lines === 1, `${lines} lines`);
        await tip.getByRole("button").click();
        await friend.reload();
        await friend.getByRole("button", { name: "I'm in" }).waitFor({ timeout: 15_000 });
        await friend.waitForTimeout(400);
        check(
          `invite ${tag}: a closed tip stays closed after a reload`,
          (await friend.getByRole("note").count()) === 0,
        );
      }
      if (!BEFORE && vp.height === 664) await viewer(friend, `invite ${tag}`);
      await friendCtx.close();
    }
} finally {
  await browser.close();
  srv.close();
}
console.info(`\nCoverage (${BEFORE ? "before" : "after"}):\n${rows.join("\n")}`);
console.info(fails.length ? `\n${fails.length} FAIL:\n${fails.join("\n")}` : "\nAll photo-fit checks pass.");
process.exit(fails.length ? 1 : 0);
