// Telegram from the phone, end to end (ADR-0013, ADR-0023, contracts/telegram.md 2 and 3):
// the host sends a Flare (which makes the group), opens Post in Telegram, reads what Telegram
// sees, taps Add the bot (a one-time t.me startgroup link), the bot sees /start in the group,
// and the next Flare posts there as the branded card. Then the host turns photos on and the
// next Flare's post is the real photo. Real server, real hub, PGlite, Chrome; the Bot API is
// the fake from the server tests. The real .env is not read, so no live token is near it.
// Usage: npm run build && node apps/web/test/e2e/telegram.ts
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright-core";
import { startFakeBotApi } from "../../../server/test/integrations/fakes/bot-api.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const OUT = path.join(ROOT, "docs/frontend/evidence");
const PORT = 8872;
const URL0 = `http://localhost:${PORT}`;
const CHAT = -100777;
const BOT = "FlareTestBot";
const SECRET = randomBytes(18).toString("base64url");
const fails: string[] = [];
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) fails.push(name);
  console.info(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
};

const tg = await startFakeBotApi();
const env = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  FLARE_ENV_FILE: path.join(ROOT, "node_modules/.cache/no-such.env"), // never the real .env
  LOG_LEVEL: "warn",
  HUB_SECRET: randomBytes(24).toString("base64url"),
};
const server = spawn(process.execPath, ["apps/server/src/main.ts"], {
  cwd: ROOT,
  env: {
    ...env,
    PORT: String(PORT),
    DATABASE_URL: "pglite:memory",
    PUBLIC_BASE_URL: URL0,
    TELEGRAM_BOT_TOKEN: `123456:${"e2e".repeat(12)}`,
    TELEGRAM_BOT_USERNAME: BOT,
    TELEGRAM_ALLOWED_CHAT_IDS: String(CHAT),
    TELEGRAM_WEBHOOK_SECRET: SECRET,
    TELEGRAM_API_BASE_URL: tg.baseUrl,
  },
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

const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
});
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: true,
  permissions: ["camera", "geolocation", "clipboard-read", "clipboard-write"],
  geolocation: { latitude: 42.3196, longitude: -83.2129 },
});
await ctx.addInitScript(() => {
  try {
    localStorage.setItem("flare.onboarded", "1"); // onboarding is tested on its own
  } catch {}
});
const host = await ctx.newPage();
host.on("pageerror", (e) => fails.push(`host: ${e.message}`));
host.on("console", (m) => {
  if (m.type() === "error" && /Content Security Policy/i.test(m.text())) fails.push(`host: ${m.text()}`);
});

async function sendFlare(page: Page): Promise<string> {
  await page.goto(`${URL0}/app/`);
  await page.getByRole("button", { name: "Light a Flare" }).click({ timeout: 15_000 }); // H0 Home first
  await page.getByRole("button", { name: "Take the photo" }).click({ timeout: 15_000 });
  await page.getByRole("button", { name: /Use this|Use my words/ }).waitFor({ timeout: 15_000 });
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
  await page.getByRole("button", { name: "Send it" }).click();
  await page.getByRole("heading", { name: "Sent." }).waitFor({ timeout: 15_000 });
  const words = (await page.evaluate(() => document.body.innerText)).slice(0, 2000);
  await page.getByRole("button", { name: "Pocket it" }).click();
  return words;
}
const waitFor = async (pred: () => boolean, ms: number) => {
  for (let t = 0; t < ms && !pred(); t += 100) await new Promise((r) => setTimeout(r, 100));
  return pred();
};

try {
  // 1. A first Flare makes the group (a link group: nothing goes to Telegram).
  await sendFlare(host);
  check("link group: no Telegram call for the first Flare", tg.calls.length === 0, `${tg.calls.length} calls`);

  // 2. Post in Telegram: the disclosure, not connected, the photo setting off by default.
  await host.goto(`${URL0}/app/`);
  await host.getByRole("button", { name: "Menu" }).click({ timeout: 10_000 });
  await host.getByRole("link", { name: /Post in Telegram/ }).click();
  await host.getByText("Not connected yet.").waitFor({ timeout: 10_000 });
  check(
    "the screen says what Telegram sees (ADR-0013)",
    await host.getByText(/Telegram sees what Flare posts there/).isVisible(),
  );
  check("photos are off by default (ADR-0023)", await host.getByRole("radio", { name: "Off" }).isChecked());
  check(
    "off says the post shows a card",
    await host.getByText("Off: the post shows a Flare card, not your photo.").isVisible(),
  );

  // 3. Add the bot: a one-time t.me link; Telegram's side is simulated by the webhook.
  const tgPage = host.url();
  let tme = "";
  await host.route("https://t.me/**", (route) => {
    tme = route.request().url();
    return route.abort();
  });
  await host.getByRole("button", { name: "Add the bot" }).click();
  await waitFor(() => tme !== "", 5000);
  const token = new URL(tme || "https://t.me/x").searchParams.get("startgroup") ?? "";
  check(
    "Add the bot opens a t.me startgroup link",
    tme.startsWith(`https://t.me/${BOT}?startgroup=`) && token.length > 0,
  );
  const hook = await fetch(`${URL0}/api/v1/telegram/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": SECRET },
    body: JSON.stringify({
      update_id: 1,
      message: {
        message_id: 1,
        chat: { id: CHAT, type: "supergroup" },
        from: { id: 7 },
        text: `/start@${BOT} ${token}`,
      },
    }),
  });
  check("webhook accepted", hook.status === 200);
  await waitFor(() => tg.of("sendMessage").some((c) => c.params.chat_id === CHAT), 5000);
  await host.goto(tgPage);
  const connected = await host
    .getByText("Connected. New Flares post in your Telegram group.")
    .waitFor({ timeout: 10_000 })
    .then(
      () => true,
      () => false,
    );
  check("after /start the group shows as connected", connected);
  await host.screenshot({ path: path.join(OUT, "e2e-o7-telegram.png"), fullPage: true });

  // 4. The next Flare posts in the group as the branded card, right away.
  tg.reset();
  await sendFlare(host);
  await waitFor(() => tg.of("sendPhoto").length > 0, 10_000);
  const card = tg.of("sendPhoto")[0];
  check("the Flare posts as the branded card (PNG)", card?.photoType === "image/png", `${card?.photoBytes ?? 0} bytes`);
  const caption = String(card?.params.caption ?? "");
  check(
    "the caption has the count and the host's line",
    /Need \d more\. Nobody sees who\./.test(caption) && caption.includes("Fuego"),
  );
  const kb =
    (card?.params.reply_markup as { inline_keyboard?: { text: string }[][] } | undefined)?.inline_keyboard ?? [];
  check(
    "with I'm in, Add a condition, Open in Flare",
    kb.map((r) => r[0]?.text).join("|") === "I'm in|Add a condition|Open in Flare",
  );
  check("no real photo went to Telegram", !tg.calls.some((c) => c.photoType === "image/jpeg"));

  // 5. Photos on: the next Flare's post is the host's photo (768 px JPEG), not the card.
  await host.goto(`${URL0}/app/telegram/`);
  await host.getByText("Connected. New Flares post in your Telegram group.").waitFor({ timeout: 10_000 });
  await host.getByRole("radio", { name: "On" }).check();
  await host.getByText("Saved.").waitFor({ timeout: 5000 });
  check(
    "on shows the founder's disclosure",
    await host.getByText("Telegram keeps a copy until the post is deleted; everyone in the group sees it.").isVisible(),
  );
  tg.reset();
  await sendFlare(host);
  await waitFor(() => tg.of("sendPhoto").length > 0, 20_000);
  const real = tg.of("sendPhoto")[0];
  check(
    "photos on: the post is the host's photo (JPEG)",
    real?.photoType === "image/jpeg",
    `${real?.photoBytes ?? 0} bytes`,
  );
  check("and it is no bigger than the 768 px upload", (real?.photoBytes ?? 0) > 0 && (real?.photoBytes ?? 0) < 400_000);
} catch (e) {
  fails.push(e instanceof Error ? (e.message.split("\n")[0] ?? "error") : String(e));
  await host.screenshot({ path: path.join(OUT, "e2e-telegram-fail.png") }).catch(() => {});
}
await browser.close();
stop();
await tg.close();
console.info(fails.length ? `\nFAIL ${fails.join(" | ")}` : "\ntelegram e2e: all pass");
process.exit(fails.length ? 1 : 0);
