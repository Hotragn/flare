// Bench to Bench end to end in Chrome on the real server (SRS-REST-1 to -6, E16): words in,
// read-back, location, the bundled Fairlane walking map, a loop, the large-print PDF card.
// At Village Green a 40-minute loop exists; at Ford Woods the benches are clustered and the
// screen must say there is no loop (docs/maps/05-rest-loops.md). Also checks that the words
// never reach the server (SRS-PRIV-1).
// Usage: npm run build && node apps/web/test/e2e/loop.ts
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const OUT = path.join(ROOT, "docs/frontend/evidence");
const PORT = 8868;
const URL0 = `http://localhost:${PORT}`;
const WORDS = "Knee's bad, 40 minutes, want trees";
const fails: string[] = [];
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) fails.push(name);
  console.info(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
};

const server = spawn(process.execPath, ["apps/server/src/main.ts"], {
  cwd: ROOT,
  env: {
    ...process.env,
    LOG_LEVEL: "warn",
    SENTRY_DSN: "",
    PORT: String(PORT),
    DATABASE_URL: "pglite:memory",
    PUBLIC_BASE_URL: URL0,
  },
  stdio: "ignore",
});
process.on("exit", () => server.kill("SIGTERM"));
for (let i = 0; i < 120; i++) {
  if (
    await fetch(`${URL0}/api/v1/health`).then(
      (r) => r.ok,
      () => false,
    )
  )
    break;
  await new Promise((r) => setTimeout(r, 250));
}

const browser = await chromium.launch({ channel: "chrome" });
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true };

async function run(where: string, at: { latitude: number; longitude: number }) {
  const ctx = await browser.newContext({
    ...phone,
    permissions: ["geolocation"],
    geolocation: at,
    acceptDownloads: true,
  });
  const page = await ctx.newPage();
  const sent: string[] = [];
  page.on("pageerror", (e) => fails.push(`${where}: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && /Content Security Policy/i.test(m.text())) fails.push(`${where}: ${m.text()}`);
  });
  page.on("request", (r) => {
    if (r.url().startsWith(`${URL0}/api/`)) sent.push(`${r.url()} ${r.postData() ?? ""}`);
  });
  await page.goto(`${URL0}/app/loop/`);
  await page.getByLabel("In your words").fill(WORDS);
  await page.getByRole("button", { name: "Check it" }).click();
  const rb = await page
    .getByRole("heading", { name: /Got it: 40 min, a bench every 200 m, under trees/ })
    .isVisible({ timeout: 5000 })
    .catch(() => false);
  check(`${where}: read-back says 40 min, 200 m, trees (SRS-REST-1)`, rb);
  const t0 = Date.now();
  await page.getByRole("button", { name: "Make the loop" }).click();
  return { ctx, page, sent, t0 };
}

try {
  // Village Green: a loop and a card.
  {
    const { ctx, page, sent, t0 } = await run("Village Green", { latitude: 42.3064, longitude: -83.227 });
    await page.getByRole("button", { name: "Print card" }).waitFor({ timeout: 15_000 });
    const ms = Date.now() - t0;
    const summary = (await page.getByRole("heading", { level: 1 }).textContent()) ?? "";
    check(
      "a loop is shown with minutes, km and benches (SRS-REST-2, -3)",
      /\d+ min · \d+\.\d km · \d+ benches/.test(summary),
      `${summary}, ${ms} ms`,
    );
    const turns = await page.locator(".turns li").allTextContents();
    check(
      "the turn list starts and ends at the spot (SRS-REST-5)",
      /^Start at /.test(turns[0] ?? "") && /That's the loop/.test(turns.at(-1) ?? ""),
      `${turns.length} lines`,
    );
    const [dl] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Print card" }).click(),
    ]);
    const file = path.join(OUT, "e2e-o5-card.pdf");
    await dl.saveAs(file);
    const pdf = fs.readFileSync(file);
    check(
      "Print card saves a PDF (SRS-REST-6)",
      pdf.subarray(0, 5).toString() === "%PDF-" && dl.suggestedFilename() === "bench-to-bench.pdf",
      `${pdf.length} bytes`,
    );
    await page.getByRole("button", { name: "Read it aloud" }).click();
    check(
      "Read it aloud turns into Stop reading",
      await page.getByRole("button", { name: "Stop reading" }).isVisible(),
    );
    check(
      "the words never reach the server (SRS-PRIV-1)",
      !sent.some((s) => /knee|trees|40 minutes/i.test(decodeURIComponent(s))),
      `${sent.length} API calls`,
    );
    await page.screenshot({ path: path.join(OUT, "e2e-o5-loop.png"), fullPage: true });
    await ctx.close();
  }
  // Ford Woods (the field-test spot): clustered benches, so no loop, and an honest next step.
  {
    const { ctx, page } = await run("Ford Woods", { latitude: 42.3196, longitude: -83.2129 });
    const none = await page
      .getByRole("heading", { name: /No loop keeps benches that close/ })
      .waitFor({ timeout: 15_000 })
      .then(
        () => true,
        () => false,
      );
    check("Ford Woods: no loop is said plainly (SRS-REST-4)", none);
    check(
      "Ford Woods: offers the next gap",
      await page
        .getByRole("button", { name: "Try 400 m" })
        .isVisible()
        .catch(() => false),
    );
    await page.screenshot({ path: path.join(OUT, "e2e-o5-none.png") });
    await ctx.close();
  }
  // Fix the map (SRS-MAP-1 to -4): pick, check every tag, export; nothing goes to OSM or our API.
  {
    const ctx = await browser.newContext({
      ...phone,
      permissions: ["geolocation", "clipboard-read", "clipboard-write"],
      geolocation: { latitude: 42.3196, longitude: -83.2129 },
      acceptDownloads: true,
    });
    const page = await ctx.newPage();
    const hosts = new Set<string>();
    page.on("pageerror", (e) => fails.push(`fix-map: ${e.message}`));
    page.on("request", (r) => {
      const u = new URL(r.url());
      if (u.pathname.startsWith("/api/") || u.host !== `localhost:${PORT}`) hosts.add(`${u.host}${u.pathname}`);
    });
    await page.goto(`${URL0}/app/fix-map/`);
    await page.getByRole("radio", { name: "Bench" }).check();
    await page.getByRole("button", { name: "Check the tags" }).click();
    const exportNote = page.getByRole("button", { name: "Export note" });
    await page.getByText("3 tags left to check").waitFor({ timeout: 10_000 });
    check("fix-map: export waits until every tag is checked (SRS-MAP-2)", await exportNote.isDisabled());
    await page.getByRole("group", { name: "Review backrest" }).getByRole("button", { name: "Keep" }).click();
    await page.getByRole("group", { name: "Review material" }).getByRole("button", { name: "Remove" }).click();
    await page.getByRole("group", { name: "Review seats" }).getByRole("button", { name: "Change" }).click();
    await page.getByLabel("New value for seats").fill("lots");
    await page.getByRole("button", { name: "Save" }).click();
    check("fix-map: a bad value is refused", await page.getByText("That value doesn't fit seats.").isVisible());
    await page.getByLabel("New value for seats").fill("2");
    await page.getByRole("button", { name: "Save" }).click();
    check("fix-map: ready after the last tag", await page.getByText("Ready. You choose where to post it.").isVisible());
    await exportNote.click();
    const note = await page.evaluate(() => navigator.clipboard.readText());
    check(
      "fix-map: the note has the kept and changed tags only (SRS-MAP-3)",
      /Missing bench here.*amenity=bench, backrest=yes, seats=2\./s.test(note) &&
        !note.includes("material") &&
        /42\.3196, -83\.2129/.test(note),
    );
    const [dl] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export .osm file" }).click(),
    ]);
    const osm = fs.readFileSync(await dl.path());
    check(
      "fix-map: the .osm file has one new node",
      /<node id="-1"[^>]*>[\s\S]*k="seats" v="2"/.test(osm.toString()),
      `${osm.length} bytes`,
    );
    check("fix-map: no request to OpenStreetMap or our API (SRS-MAP-3)", hosts.size === 0, [...hosts].join(", "));
    await page.screenshot({ path: path.join(OUT, "e2e-o6-fixmap.png"), fullPage: true });
    await ctx.close();
  }
} catch (e) {
  fails.push(e instanceof Error ? (e.message.split("\n")[0] ?? "error") : String(e));
}
await browser.close();
server.kill("SIGTERM");
console.info(fails.length ? `\nFAIL ${fails.join(" | ")}` : "\nloop e2e: all pass");
process.exit(fails.length ? 1 : 0);
