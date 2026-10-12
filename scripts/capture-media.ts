// Post media from the real app on the real stack (docs/post/media/README.md): the server, the
// hub with Gemma 4 E4B on this Mac, the engine and PGlite, driven in Chrome at iPhone size
// (390 x 844 @2x). The host picks a real photo (Eagle Lake, Acadia, public domain, NPS; see
// docs/credits/photos.md) instead of the fake camera's test pattern. The Ember shots use the
// e2e test clock (in-memory database only) to jump 31 minutes; nothing else is staged.
// Usage: npm run build && node scripts/capture-media.ts   (needs Ollama with gemma4:e4b)
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright-core";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "docs/post/media");
const PORT = 8875;
const URL0 = `http://localhost:${PORT}`;
const env = {
  ...process.env,
  LOG_LEVEL: "warn",
  SENTRY_DSN: "",
  ELEVENLABS_API_KEY: "",
  GEMINI_API_KEY: "",
  GEMINI: "",
};
const server = spawn(process.execPath, ["apps/server/src/main.ts"], {
  cwd: ROOT,
  env: { ...env, PORT: String(PORT), DATABASE_URL: "pglite:memory", FLARE_E2E_CLOCK: "1", PUBLIC_BASE_URL: URL0 },
  stdio: "ignore",
});
const hub = spawn(process.execPath, ["apps/hub/src/main.ts"], {
  cwd: ROOT,
  env: { ...env, FLARE_SERVER_URL: `ws://localhost:${PORT}` },
  stdio: "ignore",
});
process.on("exit", () => {
  hub.kill("SIGTERM");
  server.kill("SIGTERM");
});
for (let i = 0; i < 240; i++) {
  const h = await fetch(`${URL0}/api/v1/health`).then(
    (r) => r.json() as Promise<{ hub: string }>,
    () => ({ hub: "" }),
  );
  if (h.hub === "connected") break;
  await new Promise((r) => setTimeout(r, 250));
}
const photo = path.join(ROOT, "scripts/fixtures/media-eagle-lake.jpg");
if (!fs.existsSync(photo))
  await sharp(path.join(ROOT, "apps/web/static/scenery/acadia-eagle-lake-p.webp"))
    .resize({ width: 768 })
    .jpeg({ quality: 70 })
    .toFile(photo);
// Warm the model the way the field runbook does.
await fetch(`${URL0}/api/v1/drafts`, {
  method: "POST",
  headers: { "content-type": "image/jpeg" },
  body: fs.readFileSync(photo),
}).catch(() => null);

const browser = await chromium.launch({ channel: "chrome" });
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true };
const ctxFor = async (name: string, lat: number, extra: string[] = []) => {
  const c = await browser.newContext({
    ...phone,
    permissions: ["geolocation", ...extra],
    geolocation: { latitude: lat, longitude: -83.2129 },
  });
  await c.addInitScript((n) => {
    try {
      localStorage.setItem("flare.onboarded", "1");
      if (n) localStorage.setItem("flare.name", n);
    } catch {}
  }, name);
  return c;
};
const shot = async (p: Page, name: string) => {
  await p.waitForTimeout(1200);
  await p.screenshot({ path: path.join(OUT, name), type: "jpeg", quality: 78 });
  console.info(`shot ${name}`);
};
const clock = (ms: number) =>
  fetch(`${URL0}/__e2e/clock`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ advance_ms: ms }),
  });

async function hostSends(host: Page, quorum: string, prefix: string | null): Promise<string> {
  await host.goto(`${URL0}/app/`);
  if (prefix) await shot(host, "00-home.jpg");
  await host.getByRole("button", { name: "Light a Flare" }).click({ timeout: 15_000 });
  await host.getByRole("button", { name: "Pick a photo" }).waitFor({ timeout: 15_000 });
  await host.locator('input[type="file"]').first().setInputFiles(photo);
  const use = host.getByRole("button", { name: "Use this" });
  await use.waitFor({ timeout: 20_000 });
  const where = host.getByLabel("Where are you?");
  if (await where.isVisible().catch(() => false)) {
    await where.fill("Ford Woods Park, by the pond");
    await host
      .getByRole("button", { name: "Not now" })
      .click()
      .catch(() => {});
  }
  if (prefix) await shot(host, "01-host-words.jpg");
  await use.click();
  await host.getByRole("radio", { name: quorum }).check({ force: true });
  if (prefix) await shot(host, "01-host-send.jpg");
  await host.getByRole("button", { name: "Send it" }).click();
  await host.getByRole("heading", { name: /^(Sent\.|Ready\. Share the link\.)$/ }).waitFor({ timeout: 15_000 });
  if (prefix) await shot(host, "01-host-sent.jpg");
  await host.getByRole("button", { name: "Copy as text" }).click();
  const link =
    (await host.evaluate(() => navigator.clipboard.readText())).match(
      /(\/g\/[0-9a-f-]{36}\/#k=[A-Za-z0-9_-]{43})/,
    )?.[1] ?? "";
  await host.getByRole("button", { name: "Pocket it" }).click();
  return link;
}

const fails: string[] = [];
try {
  // 1. A Flare that lights: the host and Amor.
  const host = await (await ctxFor("Fuego", 42.3196, ["clipboard-read", "clipboard-write"])).newPage();
  const amor = await (await ctxFor("", 42.3232)).newPage();
  const link = await hostSends(host, "2", "first");
  await amor.goto(URL0 + link);
  await amor.getByRole("button", { name: "I'm in" }).waitFor({ timeout: 15_000 });
  await shot(amor, "02-friend-invite.jpg");
  await amor.getByRole("button", { name: "I'm in" }).click();
  const name = amor.getByLabel("Your first name");
  if (await name.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await name.fill("Amor");
    await amor.getByRole("button", { name: "Join" }).click();
  }
  await amor.getByText("It's lit.").first().waitFor({ timeout: 15_000 });
  await shot(amor, "03-friend-lit.jpg");
  await host.waitForTimeout(2500);
  await shot(host, "03-host-lit.jpg");
  await amor.getByRole("button", { name: "Find them" }).click();
  await amor.waitForTimeout(2500);
  await shot(amor, "04-friend-compass.jpg");
  await amor.getByRole("button", { name: "I'm here" }).click();
  await amor.getByRole("button", { name: "Pocket it" }).click({ timeout: 10_000 });
  await amor.getByLabel("Your Spark").fill("The light on the water at 5");
  await shot(amor, "05-friend-spark.jpg");
  await amor.getByRole("button", { name: "Save it" }).click();

  // 2. A Flare that shrinks: needs 3, one yes, then 31 minutes.
  const link2 = await hostSends(host, "3", null);
  const amor2 = await (await ctxFor("Amor", 42.3232)).newPage();
  await amor2.goto(URL0 + link2);
  await amor2.getByRole("button", { name: "I'm in" }).click({ timeout: 15_000 });
  const n2 = amor2.getByLabel("Your first name");
  if (await n2.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await n2.fill("Amor");
    await amor2.getByRole("button", { name: "Join" }).click();
  }
  await amor2.waitForTimeout(1500);
  await clock(31 * 60_000);
  await amor2.reload();
  await amor2
    .getByText(/Smaller plan/)
    .first()
    .waitFor({ timeout: 20_000 });
  await shot(amor2, "06-friend-ember.jpg");
} catch (e) {
  fails.push(e instanceof Error ? (e.message.split("\n")[0] ?? "error") : String(e));
}
await browser.close();
console.info(fails.length ? `FAIL ${fails.join(" | ")}` : "media: all captured");
process.exit(fails.length ? 1 : 0);
