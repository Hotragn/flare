// Remember this end to end (ADR-0031) on the real stack: server, PGlite, the real hub with
// Gemma 4, and a real ElevenLabs Scribe call (the server reads ELEVENLABS_API_KEY from .env).
// Two phones. The host turns it on; the friend agrees on their own phone; it lights; the host
// taps Record (its microphone plays a two-voice clip made with macOS `say`, no real person);
// the friend's phone shows the recording sign live and the friend stops it for everyone; the
// words come back with speaker labels, Gemma writes one line, the note is sealed with the Flare
// key, and both phones show it. Reports Scribe time and stop-to-note time.
// Usage: npm run build && node apps/web/test/e2e/remember.ts
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright-core";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const OUT = path.join(ROOT, "docs/frontend/evidence");
const PORT = 8879;
const URL0 = `http://localhost:${PORT}`;
const fails: string[] = [];
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) fails.push(name);
  console.info(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
};
const env = { ...process.env, LOG_LEVEL: "warn", SENTRY_DSN: "" };
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
const clip = fs.readFileSync(path.join(ROOT, "apps/web/test/fixtures/remember-two-voices.wav"));
const photo = path.join(ROOT, "scripts/fixtures/media-eagle-lake.jpg");
const browser = await chromium.launch({ channel: "chrome" });
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true };
const hostCtx = await browser.newContext({
  ...phone,
  permissions: ["geolocation", "clipboard-read", "clipboard-write"],
  geolocation: { latitude: 42.3196, longitude: -83.2129 },
});
await hostCtx.addInitScript(() => {
  localStorage.setItem("flare.onboarded", "1");
  localStorage.setItem("flare.name", "Fuego");
  // The host's microphone plays the two-voice clip.
  navigator.mediaDevices.getUserMedia = async (c?: MediaStreamConstraints) => {
    if (!c?.audio || c.video) throw new DOMException("no camera here", "NotAllowedError");
    const ac = new AudioContext();
    const el = new Audio("/__e2e/clip.wav");
    const dest = ac.createMediaStreamDestination();
    ac.createMediaElementSource(el).connect(dest);
    await el.play();
    return dest.stream;
  };
});
const host = await hostCtx.newPage();
await host.route("**/__e2e/clip.wav", (r) => r.fulfill({ body: clip, contentType: "audio/wav" }));
const friend = await (await browser.newContext({ ...phone })).newPage();
for (const [p, who] of [
  [host, "host"],
  [friend, "friend"],
] as const)
  p.on("pageerror", (e) => fails.push(`${who}: ${e.message}`));
let scribeMs = 0;
host.on("requestfinished", async (r) => {
  if (r.url().endsWith("/remember/transcribe")) scribeMs = Math.round(r.timing().responseEnd - r.timing().requestStart);
});
const sheet = (p: Page) => p.locator("dialog[open]");

try {
  await host.goto(`${URL0}/app/`);
  await host.getByRole("button", { name: "Light a Flare" }).click({ timeout: 15_000 });
  await host.getByRole("button", { name: "Pick a photo" }).waitFor({ timeout: 15_000 });
  await host.locator('input[type="file"]').first().setInputFiles(photo);
  const use = host.getByRole("button", { name: /^(Use this|Use my words)$/ });
  await host
    .getByRole("button", { name: "Use this" })
    .waitFor({ timeout: 20_000 })
    .catch(async () => {
      await host.getByRole("textbox").first().fill("Pond walk, come sit");
    });
  await use.first().click();
  const where = host.getByLabel("Where are you?");
  if (await where.isVisible().catch(() => false)) await where.fill("Ford Woods Park, by the pond");
  await host.getByRole("button", { name: "Send it" }).click();
  await host.getByRole("heading", { name: "Sent." }).waitFor({ timeout: 15_000 });
  await host.getByRole("button", { name: "Copy as text" }).click();
  const link =
    (await host.evaluate(() => navigator.clipboard.readText())).match(
      /(\/g\/[0-9a-f-]{36}\/#k=[A-Za-z0-9_-]{43})/,
    )?.[1] ?? "";
  await host.getByRole("button", { name: "Pocket it" }).click();

  // The host turns it on for this Flare (off by default).
  await host.getByRole("button", { name: "Remember this" }).click({ timeout: 15_000 });
  await sheet(host).getByRole("button", { name: "Turn it on" }).click();
  await host.keyboard.press("Escape");

  // The friend says yes, then agrees on their own phone, separately.
  await friend.goto(URL0 + link);
  await friend.getByRole("button", { name: "I'm in" }).click({ timeout: 15_000 });
  const n = friend.getByLabel("Your first name");
  if (await n.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await n.fill("Amor");
    await friend.getByRole("button", { name: "Join" }).click();
  }
  await friend.getByText("It's lit.").first().waitFor({ timeout: 15_000 });
  await friend.getByRole("button", { name: "Remember this" }).click({ timeout: 15_000 });
  check(
    "the friend is asked on their own phone",
    await sheet(friend).getByRole("button", { name: "I agree" }).isVisible(),
  );
  await sheet(friend).getByRole("button", { name: "I agree" }).click();
  await friend.keyboard.press("Escape");

  // Everyone agreed and it's lit: the host records.
  await host.waitForTimeout(1500);
  await host.getByRole("button", { name: "Remember this" }).click();
  check(
    "the line before Record",
    await sheet(host).getByText("Only your group. Stop if others are close.").isVisible({ timeout: 5_000 }),
  );
  await sheet(host).getByRole("button", { name: "Record" }).click();
  const signOnFriend = await friend
    .getByText(/Recording · \d+ s left/)
    .waitFor({ timeout: 5_000 })
    .then(
      () => true,
      () => false,
    );
  check("the recording sign shows live on the other phone", signOnFriend);
  await friend.screenshot({ path: path.join(OUT, "e2e-remember-sign.png") });
  await friend.waitForTimeout(10_500); // the clip is about 10 s
  const t0 = Date.now();
  await friend.getByRole("button", { name: "Stop for everyone" }).click();
  check(
    "anyone can stop it for everyone",
    await host
      .getByText(/Recording ·/)
      .waitFor({ state: "detached", timeout: 5_000 })
      .then(
        () => true,
        () => false,
      ),
  );

  // The note: speaker labels, Gemma's line, sealed, on both phones.
  let shown = false;
  for (let i = 0; i < 40 && !shown; i++) {
    await friend.waitForTimeout(500);
    await friend
      .getByRole("button", { name: "Remember this" })
      .click()
      .catch(() => {});
    shown = await sheet(friend)
      .getByText("What you said")
      .isVisible()
      .catch(() => false);
    if (!shown) await friend.keyboard.press("Escape").catch(() => {});
  }
  const endMs = Date.now() - t0;
  const text = shown ? ((await sheet(friend).textContent()) ?? "") : "";
  check(
    "the note reaches the other phone, with speaker labels and no names",
    shown && /Speaker 1/.test(text) && /geese/i.test(text) && !/Fuego|Amor/.test(text),
    text.slice(0, 160),
  );
  check(
    "Gemma on our laptop wrote one line",
    shown && !(await sheet(friend).getByText("No summary: our laptop is off.").isVisible()),
  );
  await friend.screenshot({ path: path.join(OUT, "e2e-remember-note.png") });
  console.info(`Scribe ${scribeMs} ms; stop to note on the other phone ${endMs} ms`);
} catch (e) {
  fails.push(e instanceof Error ? (e.message.split("\n")[0] ?? "error") : String(e));
  await host.screenshot({ path: path.join(OUT, "e2e-remember-fail-host.png") }).catch(() => {});
  await friend.screenshot({ path: path.join(OUT, "e2e-remember-fail-friend.png") }).catch(() => {});
}
await browser.close();
console.info(fails.length ? `\nFAIL ${fails.join(" | ")}` : "\nremember e2e: all pass");
process.exit(fails.length ? 1 : 0);
