// Sparks and "met here" end to end in Chrome on the real stack (BR-K-1 to K-6, SRS-SPK-2):
// the host sends a Flare, a friend says yes, it lights, the friend taps I'm here and leaves a
// Spark, the host ends it (the host's phone adds the place to the sealed Hot spots blob), then
// the host sends a second Flare from the same spot and the friend's invite reads
// "Your group met here once." with the Spark. Real server, real hub, real engine, PGlite.
// Usage: npm run build && node apps/web/test/e2e/sparks.ts
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright-core";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const OUT = path.join(ROOT, "docs/frontend/evidence");
const PORT = 8867;
const URL0 = `http://localhost:${PORT}`;
const SPARK = "The light on the water at 5";
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
await fetch(`${URL0}/api/v1/drafts`, {
  method: "POST",
  headers: { "content-type": "image/jpeg" },
  body: fs.readFileSync(path.join(ROOT, "scripts/fixtures/pond-illustration.jpg")),
}).catch(() => null); // warm-up draft, as the runbook does

const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
});
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true };
const hostCtx = await browser.newContext({
  ...phone,
  permissions: ["camera", "geolocation", "clipboard-read", "clipboard-write"],
  geolocation: { latitude: 42.3196, longitude: -83.2129 },
});
const friendCtx = await browser.newContext({
  ...phone,
  permissions: ["geolocation", "microphone"],
  geolocation: { latitude: 42.3232, longitude: -83.2129 },
});
await hostCtx.addInitScript(() => {
  try {
    localStorage.setItem("flare.onboarded", "1"); // onboarding is tested on its own
  } catch {}
});
// Headless Chrome hangs on audio-only getUserMedia even with the fake-device flags, so the
// friend's phone gets a synthetic tone as its microphone; MediaRecorder records it for real.
await friendCtx.addInitScript(() => {
  const real = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
  if (!real) return;
  navigator.mediaDevices.getUserMedia = async (c?: MediaStreamConstraints) => {
    if (c?.audio && !c.video) {
      const ac = new AudioContext();
      const osc = ac.createOscillator();
      const dest = ac.createMediaStreamDestination();
      osc.connect(dest);
      osc.start();
      return dest.stream;
    }
    return real(c);
  };
});
const host = await hostCtx.newPage();
const friend = await friendCtx.newPage();
for (const [p, who] of [
  [host, "host"],
  [friend, "friend"],
] as const) {
  p.on("pageerror", (e) => fails.push(`${who}: ${e.message}`));
  p.on("console", (m) => {
    if (m.type() === "error" && /Content Security Policy/i.test(m.text())) fails.push(`${who}: ${m.text()}`);
  });
}

async function sendFlare(page: Page): Promise<string> {
  await page.goto(`${URL0}/app/`);
  await page.getByRole("button", { name: "Light a Flare" }).click({ timeout: 15_000 }); // H0 Home first
  await page.getByRole("button", { name: "Take the photo" }).click({ timeout: 15_000 });
  await page.getByRole("button", { name: /Use this|Use my words/ }).waitFor({ timeout: 15_000 });
  const sheetWhere = page.getByLabel("Where are you?");
  if (await sheetWhere.isVisible().catch(() => false)) {
    await sheetWhere.fill("Ford Woods Park, by the pond");
    await page.getByRole("button", { name: "Not now" }).click();
  }
  const use = page.getByRole("button", { name: "Use this" });
  // While the print develops "Use mine" shows disabled; the hub's words arrive in about 3 s.
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
  await page.getByRole("button", { name: "Copy as text" }).click();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  const link = clip.match(/(\/g\/[0-9a-f-]{36}\/#k=[A-Za-z0-9_-]{43})/)?.[1] ?? "";
  await page.getByRole("button", { name: "Pocket it" }).click();
  return link;
}

try {
  // Flare 1: lights, friend arrives and leaves a Spark, host ends it.
  const link1 = await sendFlare(host);
  check("flare 1 sent with a link", !!link1);
  let sentType = "";
  await friend.route("**/api/v1/config", async (r) => {
    const res = await r.fetch();
    await r.fulfill({ response: res, json: { ...(await res.json()), voice: { spark: true } } });
  });
  await friend.route("**/api/v1/voice/spark", async (r) => {
    sentType = r.request().headers()["content-type"] ?? "";
    await r.fulfill({ json: { text: "The light on the water" } });
  });
  await friend.goto(URL0 + link1);
  await friend.getByRole("button", { name: "I'm in" }).click({ timeout: 10_000 });
  await friend.getByLabel("Your first name").fill("Amor");
  await friend.getByRole("button", { name: "Join" }).click();
  await friend.getByText("It's lit.").first().waitFor({ timeout: 15_000 });
  check("flare 1 lit", true);
  await friend.getByRole("button", { name: "I'm here" }).click();
  await friend.getByText("You made it.").first().waitFor({ timeout: 10_000 });
  await friend.getByRole("button", { name: "Pocket it" }).click();
  // Voice Spark (ADR-0027) with Chrome's fake microphone. This test server has no ElevenLabs
  // key, so /config and Scribe are stood in for here; the phone's side is what is checked: it
  // records only after the tap, sends audio once, and puts the words in the field to edit.
  const sayIt = friend.getByRole("button", { name: "Say it" });
  if (
    await sayIt.waitFor({ timeout: 10_000 }).then(
      () => true,
      () => false,
    )
  ) {
    await sayIt.click();
    await friend
      .getByText(/Listening… \d+ s left/)
      .waitFor({ timeout: 5_000 })
      .catch(async () => {
        await friend.screenshot({ path: path.join(OUT, "e2e-say-fail.png") });
        throw new Error(
          `Say it: no Listening; the field says "${await friend
            .locator(".msg")
            .first()
            .innerText()
            .catch(() => "")}"`,
        );
      });
    await friend.waitForTimeout(1200);
    await friend.getByRole("button", { name: "Stop" }).click();
    const said = await friend
      .getByLabel("Your Spark")
      .evaluate((el) => (el as HTMLTextAreaElement).value)
      .catch(() => "");
    await friend
      .waitForFunction(
        () => (document.querySelector("textarea") as HTMLTextAreaElement | null)?.value.includes("light"),
        null,
        { timeout: 10_000 },
      )
      .catch(() => {});
    const value = await friend.getByLabel("Your Spark").inputValue();
    check(
      "Say it: audio sent once, the words land in the field to edit",
      sentType.startsWith("audio/") && value === "The light on the water",
      `${sentType} "${value || said}"`,
    );
  } else check("Say it offered when the server has Voice Spark", false);
  await friend.unroute("**/api/v1/voice/spark");
  await friend.unroute("**/api/v1/config");
  await friend.getByLabel("Your Spark").fill(SPARK);
  await friend.getByRole("button", { name: "Save it" }).click();
  const saved = await friend
    .getByText("Saved.")
    .first()
    .waitFor({ timeout: 10_000 })
    .then(
      () => true,
      () => false,
    );
  check("the friend's Spark is saved after I'm here (BR-K-1)", saved);
  await host.getByRole("button", { name: "We're done" }).click({ timeout: 15_000 });
  await host.getByRole("button", { name: "End it" }).click();
  await host
    .getByText(/Thanks for coming\.|You were outside \d+ min together/)
    .first()
    .waitFor({ timeout: 10_000 });
  await host.waitForTimeout(1500); // the Hot spots blob update runs after Gone (BR-K-6)

  // Flare 2 from the same spot: the invite shows the history line and the Spark.
  const link2 = await sendFlare(host);
  check("flare 2 sent from the same group", !!link2 && link2 !== link1);
  await friend.goto(URL0 + link2);
  const met = await friend
    .getByText("Your group met here once.")
    .first()
    .waitFor({ timeout: 15_000 })
    .then(
      () => true,
      () => false,
    );
  check("the second invite says the group met here (SRS-SPK-2, BR-K-5)", met);
  const quote = await friend
    .getByText(SPARK)
    .first()
    .isVisible()
    .catch(() => false);
  check("and quotes the newest Spark, opened on the phone", quote);
  await friend.screenshot({ path: path.join(OUT, "e2e-i1-met-here.png") });
  await host.goto(`${URL0}/app/`);
  await host.getByRole("button", { name: "Menu" }).click({ timeout: 10_000 });
  await host.getByRole("link", { name: /Hot spots/ }).click();
  const listed = await host
    .getByText(/West Road|Ford Woods|pond/i)
    .first()
    .waitFor({ timeout: 10_000 })
    .then(
      () => true,
      () => false,
    );
  check("Hot spots lists the place (SRS-HOT-1)", listed);
  await host.screenshot({ path: path.join(OUT, "e2e-o1-hotspots.png") });
  // Crew space (backlog #5): the crew's counters after one outing, the place as a postcard.
  await host.goto(`${URL0}/app/crew/`);
  const crewOk = await host
    .getByText(/\d+ outings? · .* outside · \d+ Embers saved/)
    .first()
    .waitFor({ timeout: 10_000 })
    .then(
      () => true,
      () => false,
    );
  check("Crew shows the crew's story from counters", crewOk);
  check("Crew lists the place as a postcard", (await host.locator(".postcard").count()) > 0);
  // Crew Atlas (ADR-0029): drawn on the phone from the map pack, with no request for it.
  const atlas = await host
    .getByRole("img", { name: /Map of (the place|\d+ places) your crew met/ })
    .waitFor({ timeout: 10_000 })
    .then(
      () => true,
      () => false,
    );
  const fact =
    (await host
      .locator(".atlas .facts li")
      .first()
      .textContent()
      .catch(() => "")) ?? "";
  check("Crew Atlas maps the place with its facts", atlas && /Met (once|\d+ times)/.test(fact), fact.trim());
  await host
    .locator(".atlas")
    .screenshot({ path: path.join(OUT, "e2e-crew-atlas.png") })
    .catch(() => {});
  await host.screenshot({ path: path.join(ROOT, "docs/design/redesign/after/crew.jpg"), type: "jpeg", quality: 78 });
} catch (e) {
  fails.push(e instanceof Error ? (e.message.split("\n")[0] ?? "error") : String(e));
  await friend.screenshot({ path: path.join(OUT, "e2e-sparks-fail-friend.png") }).catch(() => {});
  await host.screenshot({ path: path.join(OUT, "e2e-sparks-fail-host.png") }).catch(() => {});
}
await browser.close();
stop();
console.info(fails.length ? `\nFAIL ${fails.join(" | ")}` : "\nsparks e2e: all pass");
process.exit(fails.length ? 1 : 0);
