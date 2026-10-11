// The Try-it demo, played end to end in Chrome on the built app (backlog #4): send, a friend
// answers, skip 30 min to the Ember, a second yes lights it at a bench, Find them as Amor,
// I'm here, a Spark, the after-outing summary, Phone away. No API call may carry anything.
// Usage: npm run build && node apps/web/test/e2e/demo.ts
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { serve } from "../site/serve.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const OUT = path.join(ROOT, "docs/design/redesign/after");
const fails: string[] = [];
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) fails.push(name);
  console.info(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
};
const live = process.env.DEMO_URL;
const site = live ? { url: live, close: async () => {} } : await serve(8887, () => null);
const browser = await chromium.launch({ channel: "chrome" });
const page = await (
  await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
  })
).newPage();
const api: string[] = [];
page.on("request", (r) => {
  if (new URL(r.url()).pathname.startsWith("/api/")) api.push(r.url());
});
page.on("pageerror", (e) => fails.push(e.message));
const shot = async (n: string) => {
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(OUT, `demo-${n}.jpg`), type: "jpeg", quality: 78 });
};
try {
  await page.goto(`${site.url}/app/demo/`);
  check(
    "marked as a demo",
    await page
      .getByText("Demo · nothing is sent")
      .waitFor({ timeout: 10_000 })
      .then(
        () => true,
        () => false,
      ),
  );
  await shot("1-send");
  await page.getByRole("button", { name: "Send it" }).click();
  await page.getByText("Amor said yes.").waitFor({ timeout: 10_000 });
  await shot("2-kindling");
  await page.getByRole("button", { name: "Skip 30 min" }).click();
  await page.getByText("Benny said yes.").waitFor({ timeout: 10_000 });
  const lit = await page
    .getByText(/Smaller plan: 15 min at the (bench by the willow|picnic table on the hill)/)
    .first()
    .waitFor({ timeout: 10_000 })
    .then(
      () => true,
      () => false,
    );
  check("30 min later it shrinks to an Ember at a bench, and lights (real engine)", lit);
  await shot("3-ember-lit");
  await page.getByRole("button", { name: "Find them" }).click();
  await page
    .getByText(/Fuego is straight ahead|Fuego, 120 meters/)
    .first()
    .waitFor({ timeout: 10_000 });
  await page.waitForTimeout(2500);
  await shot("4-compass");
  await page.getByRole("button", { name: "I'm here" }).click();
  await page.getByLabel("Your Spark").fill("The light on the water at 5");
  await shot("5-spark");
  await page.getByRole("button", { name: "Save it" }).click();
  const summary = await page
    .getByText(/You were outside \d+ min together/)
    .first()
    .waitFor({ timeout: 10_000 })
    .then(
      () => true,
      () => false,
    );
  check("ends with the outside summary", summary);
  await shot("6-outside");
  await page.getByRole("button", { name: "Put it away" }).click();
  check("then Phone away", await page.getByText("Phone away.").first().isVisible());
  await shot("7-away");
  check("no API calls at all", api.length === 0, api.join(", "));
} catch (e) {
  fails.push(e instanceof Error ? (e.message.split("\n")[0] ?? "error") : String(e));
  await page.screenshot({ path: path.join(OUT, "demo-fail.jpg") }).catch(() => {});
}
await browser.close();
await site.close();
console.info(fails.length ? `\nFAIL ${fails.join(" | ")}` : "\ndemo e2e: all pass");
process.exit(fails.length ? 1 : 0);
