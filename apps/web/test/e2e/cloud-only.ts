// Self-host level 2 (/run/): no laptop, no GPU, only a free Google AI Studio key. A fresh server
// gets an env file with GEMINI_API_KEY and nothing else (no DigitalOcean key, no hub). Then:
// /config lists only google; the host lights a Flare from a real photo, sees the place-word
// fallback, taps Ask cloud Gemma (the explicit photo opt-in), gets Gemma 4's words, sends; a friend
// says yes and it lights; and a Plan draft comes back from the cloud. Calls Google once per draft.
// With --no-keys it checks self-host level 1 instead: no AI keys at all, the host types the words
// (place-word chips), it still sends and lights, and a Plan draft comes from the template.
// Usage: npm run build && node apps/web/test/e2e/cloud-only.ts [--no-keys]   (level 2 needs GEMINI_API_KEY in .env)
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const OUT = path.join(ROOT, "docs/frontend/evidence");
const PORT = 8877;
const URL0 = `http://localhost:${PORT}`;
const fails: string[] = [];
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) fails.push(name);
  console.info(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
};
// Only the Gemini key, copied from .env into a temporary file that is deleted at exit.
const vars = Object.fromEntries(
  fs
    .readFileSync(path.join(ROOT, ".env"), "utf8")
    .split("\n")
    .map((l) => /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(l))
    .filter((m): m is RegExpExecArray => !!m)
    .map((m) => [m[1], (m[2] ?? "").replace(/^["']|["']$/g, "")]),
);
const NO_KEYS = process.argv.includes("--no-keys");
const key = NO_KEYS ? "" : vars.GEMINI_API_KEY || vars.GEMINI || "";
if (!key && !NO_KEYS) {
  console.error("GEMINI_API_KEY is not in .env");
  process.exit(1);
}
const envFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "flare-l2-")), ".env");
fs.writeFileSync(envFile, `${key ? `GEMINI_API_KEY=${key}\n` : ""}HUB_SECRET=${"x".repeat(40)}\n`, { mode: 0o600 });
const clean: NodeJS.ProcessEnv = { PATH: process.env.PATH, HOME: process.env.HOME };
const server = spawn(process.execPath, ["apps/server/src/main.ts"], {
  cwd: ROOT,
  env: {
    ...clean,
    FLARE_ENV_FILE: envFile,
    PORT: String(PORT),
    DATABASE_URL: "pglite:memory",
    PUBLIC_BASE_URL: URL0,
    LOG_LEVEL: "warn",
  },
  stdio: "ignore",
});
const stop = () => {
  server.kill("SIGTERM");
  fs.rmSync(path.dirname(envFile), { recursive: true, force: true });
};
process.on("exit", stop);
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
const photo = path.join(ROOT, "scripts/fixtures/media-eagle-lake.jpg");
try {
  const cfg = (await (await fetch(`${URL0}/api/v1/config`)).json()) as {
    cloud_ai: { providers: string[]; photo_opt_in: boolean };
  };
  const health = (await (await fetch(`${URL0}/api/v1/health`)).json()) as { hub: string };
  if (NO_KEYS)
    check(
      "no AI provider and no hub",
      cfg.cloud_ai.providers.length === 0 && health.hub === "absent",
      `${cfg.cloud_ai.providers} hub ${health.hub}`,
    );
  else
    check(
      "only Google AI Studio is configured, and there is no hub",
      cfg.cloud_ai.providers.join() === "google" && cfg.cloud_ai.photo_opt_in && health.hub === "absent",
      `${cfg.cloud_ai.providers} hub ${health.hub}`,
    );

  const hostCtx = await browser.newContext({
    ...phone,
    permissions: ["geolocation", "clipboard-read", "clipboard-write"],
    geolocation: { latitude: 42.3196, longitude: -83.2129 },
  });
  await hostCtx.addInitScript(() => {
    localStorage.setItem("flare.onboarded", "1");
    localStorage.setItem("flare.name", "Fuego");
  });
  const host = await hostCtx.newPage();
  host.on("pageerror", (e) => fails.push(`host: ${e.message}`));
  await host.goto(`${URL0}/app/`);
  await host.getByRole("button", { name: "Light a Flare" }).click({ timeout: 15_000 });
  await host.getByRole("button", { name: "Pick a photo" }).waitFor({ timeout: 15_000 });
  await host.locator('input[type="file"]').first().setInputFiles(photo);
  if (NO_KEYS) {
    // Level 1: the place-word fallback is the normal path; tap a chip, add words, use them.
    await host.getByText("Tap a place word, or write your own six.").waitFor({ timeout: 20_000 });
    check(
      "with no keys, the choice reads as a choice (no Ask cloud Gemma)",
      (await host.getByRole("button", { name: "Ask cloud Gemma" }).count()) === 0,
    );
    await host.screenshot({ path: path.join(OUT, "e2e-l1-choice.png") });
    const chip = host.locator(".chips button").first();
    if (await chip.isVisible().catch(() => false)) await chip.click();
    const box = host.getByRole("textbox").first();
    await box.fill(`${(await box.inputValue()).trim()} walk, come say hi`.trim());
    await host.getByRole("button", { name: "Use my words" }).click();
  } else {
    const ask = host.getByRole("button", { name: "Ask cloud Gemma" });
    await ask.waitFor({ timeout: 20_000 });
    check(
      "with no laptop, the choice reads as a choice",
      await host.getByText("Tap a place word, write your own, or ask cloud Gemma.").isVisible(),
    );
    await host.screenshot({ path: path.join(OUT, "e2e-l2-choice.png") });
    const t0 = Date.now();
    await ask.click();
    const use = host.getByRole("button", { name: "Use this" });
    await use.waitFor({ timeout: 45_000 });
    await host.waitForTimeout(1500); // the words type themselves in
    const tier = (await host.locator(".tier").first().textContent())?.trim() ?? "";
    const words = (
      await host
        .locator(".tier")
        .first()
        .evaluate((el) => el.previousElementSibling?.textContent ?? "")
    ).trim();
    await host.screenshot({ path: path.join(OUT, "e2e-l2-drafted.png") });
    check(
      "Gemma 4 in the cloud wrote the invite from the photo",
      /cloud/i.test(tier) && words.split(/\s+/).length >= 3,
      `"${words}" (${tier}) in ${Date.now() - t0} ms`,
    );
    await use.click();
  }
  const where = host.getByLabel("Where are you?");
  if (await where.isVisible().catch(() => false)) await where.fill("Ford Woods Park, by the pond");
  await host.getByRole("button", { name: "Send it" }).click();
  await host.getByRole("heading", { name: "Sent." }).waitFor({ timeout: 15_000 });
  await host.getByRole("button", { name: "Copy as text" }).click();
  const link =
    (await host.evaluate(() => navigator.clipboard.readText())).match(
      /(\/g\/[0-9a-f-]{36}\/#k=[A-Za-z0-9_-]{43})/,
    )?.[1] ?? "";
  check("sent with a link", !!link);
  const friend = await (await browser.newContext({ ...phone })).newPage();
  await friend.goto(URL0 + link);
  await friend.getByRole("button", { name: "I'm in" }).click({ timeout: 15_000 });
  const n = friend.getByLabel("Your first name");
  if (await n.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await n.fill("Amor");
    await friend.getByRole("button", { name: "Join" }).click();
  }
  check(
    "it lights",
    await friend
      .getByText("It's lit.")
      .first()
      .waitFor({ timeout: 15_000 })
      .then(
        () => true,
        () => false,
      ),
  );

  const t1 = Date.now();
  const ladder = (await (
    await fetch(`${URL0}/api/v1/drafts/ladder`, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": `l2-${Date.now()}-0001` },
      body: JSON.stringify({ ask: "Fairlane walk at 11?", total_minutes: 60 }),
    })
  ).json()) as { tier: string; steps: { label: string }[] };
  check(
    NO_KEYS ? "a Plan draft comes from the template" : "a Plan draft comes from the cloud",
    ladder.tier === (NO_KEYS ? "rules" : "cloud") && ladder.steps.length === 4,
    `${ladder.tier} in ${Date.now() - t1} ms: ${ladder.steps.map((s) => s.label).join(" / ")}`,
  );
} catch (e) {
  fails.push(e instanceof Error ? (e.message.split("\n")[0] ?? "error") : String(e));
}
await browser.close();
console.info(fails.length ? `\nFAIL ${fails.join(" | ")}` : "\ncloud-only e2e: all pass");
process.exit(fails.length ? 1 : 0);
