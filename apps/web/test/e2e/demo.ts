// The Try-it demo, played end to end in Chrome on the built app (backlog #4, fresh-eyes fixes):
// send as the host; become Amor for one beat and say I'm in; back to you, a count and no name;
// skip 30 min to the Ember, a second yes lights it at one bench; Find them; You made it; a
// Spark; the after-outing summary with the plan's minutes; Phone away; the end screen.
// No API call may carry anything, and no friend's name may appear next to a yes.
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
  await page.getByRole("button", { name: "Friend's view" }).click();
  await page.getByText(/^Now you're Amor, a friend of/).waitFor({ timeout: 10_000 });
  check(
    "friend side: Add a condition is offered",
    await page.getByRole("button", { name: "Add a condition" }).isVisible(),
  );
  await shot("2a-friend");
  // A condition goes through the real parser and its read-back (fresh-eyes round 4).
  await page.getByRole("button", { name: "Add a condition" }).click();
  await page.getByRole("textbox").first().fill("back by 5");
  await page.getByRole("button", { name: "Check it" }).click();
  const yesIn = page.getByRole("button", { name: "Yes, I'm in" });
  check(
    "a condition is read back with Yes and Fix it",
    (await yesIn.waitFor({ timeout: 10_000 }).then(
      () => true,
      () => false,
    )) && (await page.getByRole("button", { name: "Fix it" }).isVisible()),
  );
  await yesIn.click();
  check(
    "You're in shows the condition, once",
    await page
      .getByText(/^You're in if: back by 5/i)
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false),
  );
  await page.getByRole("button", { name: "Back to you" }).click();
  await page.getByText(/One more yes: 2 in/).waitFor({ timeout: 10_000 });
  check("a yes never shows a name", !(await page.getByText(/(Amor|Benny|Kai) said yes/).count()));
  await shot("2-kindling");
  await page.getByRole("button", { name: "Skip 30 min" }).click();
  check(
    "the host's line follows the demo clock",
    await page
      .getByText(/Sent 30 min ago|30 min/)
      .first()
      .waitFor({ timeout: 5_000 })
      .then(
        () => true,
        () => false,
      ),
  );
  const lit = await page
    .getByText(/Smaller plan: 15 min at the (bench by the willow|picnic table on the hill)/)
    .first()
    .waitFor({ timeout: 10_000 })
    .then(
      () => true,
      () => false,
    );
  await page.getByRole("button", { name: "Find them" }).waitFor({ timeout: 10_000 });
  check("30 min later it shrinks to an Ember at a bench, and lights (real engine)", lit);
  await shot("3-ember-lit");
  await page.getByRole("button", { name: "Find them" }).click();
  await page
    .getByText(/the bench by the willow is straight ahead|the bench by the willow, 120 meters/i)
    .first()
    .waitFor({ timeout: 10_000 });
  await page.waitForTimeout(2500);
  await shot("4-compass");
  await page.getByRole("button", { name: "I'm here" }).click();
  await page.getByText("You made it.").waitFor({ timeout: 10_000 });
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel("Your Spark").fill("The light on the water at 5");
  await shot("5-spark");
  await page.getByRole("button", { name: "Save it" }).click();
  const summary = await page
    .getByText("You were outside 15 min together")
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
  await page.getByRole("button", { name: "Close" }).click();
  check("the last screens keep a way out", (await page.getByRole("button", { name: "Leave the demo" }).count()) > 0);
  check("ends on Light a Flare", await page.getByRole("button", { name: "Light a Flare" }).isVisible());
  await shot("8-done");
  check("no API calls at all", api.length === 0, api.join(", "));
} catch (e) {
  fails.push(e instanceof Error ? (e.message.split("\n")[0] ?? "error") : String(e));
  await page.screenshot({ path: path.join(OUT, "demo-fail.jpg") }).catch(() => {});
}
await browser.close();
await site.close();
console.info(fails.length ? `\nFAIL ${fails.join(" | ")}` : "\ndemo e2e: all pass");
process.exit(fails.length ? 1 : 0);
