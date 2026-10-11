// Voice Flare end to end on the real stack (ADR-0028): the host taps "Say it instead" on the
// camera screen and says "I'm at the pond in Ford Woods Park. Come sit on the bench with me, the
// light is really nice." (macOS `say`, test/fixtures/voice-pond.wav, played in as the phone's
// microphone). Real MediaRecorder, the phone's WAV conversion, the server, the hub and Gemma 4 on
// this Mac write the invite; Send shows it over the outdoor scenery, with no photo. Needs Ollama.
// Usage: npm run build && node apps/web/test/e2e/voice-flare.ts
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const OUT = path.join(ROOT, "docs/frontend/evidence");
const PORT = 8873;
const URL0 = `http://localhost:${PORT}`;
const fails: string[] = [];
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) fails.push(name);
  console.info(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
};
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
const wav = fs.readFileSync(path.join(ROOT, "apps/web/test/fixtures/voice-pond.wav"));

const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: true,
  permissions: ["geolocation"],
  geolocation: { latitude: 42.3196, longitude: -83.2129 },
});
await ctx.addInitScript(() => {
  try {
    localStorage.setItem("flare.onboarded", "1");
    localStorage.setItem("flare.name", "Fuego");
  } catch {}
  // The phone's microphone hears the fixture: an <audio> element played into a MediaStream.
  navigator.mediaDevices.getUserMedia = async (c?: MediaStreamConstraints) => {
    if (!c?.audio || c.video) throw new DOMException("no camera in this test", "NotAllowedError");
    const ac = new AudioContext();
    const el = new Audio("/__e2e/voice.wav");
    el.crossOrigin = "anonymous";
    const src = ac.createMediaElementSource(el);
    const dest = ac.createMediaStreamDestination();
    src.connect(dest);
    await el.play();
    return dest.stream;
  };
});
const page = await ctx.newPage();
page.on("pageerror", (e) => fails.push(e.message));
await page.route("**/__e2e/voice.wav", (r) => r.fulfill({ body: wav, contentType: "audio/wav" }));
let sentType = "";
let sentBytes = 0;
page.on("request", (r) => {
  if (r.url().endsWith("/api/v1/drafts/voice")) {
    sentType = r.headers()["content-type"] ?? "";
    sentBytes = r.postDataBuffer()?.length ?? 0;
  }
});

try {
  await page.goto(`${URL0}/app/`);
  await page.getByRole("button", { name: "Light a Flare" }).click({ timeout: 15_000 });
  const say = page.getByRole("button", { name: "Say it instead" });
  await say.waitFor({ timeout: 15_000 });
  check("camera screen offers Say it instead", true);
  await say.click();
  await page.getByText(/Listening… \d+ s left/).waitFor({ timeout: 5_000 });
  await page.waitForTimeout(5200); // the sentence is about 4.6 s
  await page.getByRole("button", { name: "Stop" }).click();
  const t0 = Date.now();
  await page
    .getByRole("heading", { name: "Send it" })
    .or(page.getByText("Send it").first())
    .first()
    .waitFor({ timeout: 20_000 });
  const words = (await page.locator(".t-invite.words").first().textContent())?.trim() ?? "";
  check(
    "audio went once as 16 kHz WAV",
    sentType === "audio/wav" && sentBytes > 44 && sentBytes < 400_000,
    `${sentType} ${sentBytes} B`,
  );
  check(
    "Gemma 4 on the hub wrote the invite from the voice",
    /pond|bench|ford|woods|park/i.test(words),
    `"${words}" in ${Date.now() - t0} ms`,
  );
  check("no photo: Send shows the outdoor scenery", (await page.locator(".backdrop.art").count()) > 0);
  await page.screenshot({ path: path.join(OUT, "e2e-voice-flare-send.png") });
} catch (e) {
  fails.push(e instanceof Error ? (e.message.split("\n")[0] ?? "error") : String(e));
  await page.screenshot({ path: path.join(OUT, "e2e-voice-flare-fail.png") }).catch(() => {});
}
await browser.close();
console.info(fails.length ? `\nFAIL ${fails.join(" | ")}` : "\nvoice flare e2e: all pass");
process.exit(fails.length ? 1 : 0);
