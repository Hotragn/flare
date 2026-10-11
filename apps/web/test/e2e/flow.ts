// End to end in Chrome at 390 × 844: the host sends a Flare from /app/ with a fake camera, a
// friend opens the link, says I'm in, and it lights. Real screens and real PWA modules; the API
// is the in-memory fake (serve.ts). Five runs; reports host open to Send and link open to
// "You're in." (FE2 target ≤ 15 s, FE3 target ≤ 10 s, both on desktop).
// Usage: npm run build && node apps/web/test/e2e/flow.ts [runs]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { startServer } from "./serve.ts";

const RUNS = Number(process.argv[2] ?? 5);
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../docs/frontend/evidence");
fs.mkdirSync(OUT, { recursive: true });

const srv = await startServer(8862);
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
});
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true };
const results: { host: number; friend: number; lit: boolean }[] = [];
const fails: string[] = [];

for (let run = 1; run <= RUNS; run++) {
  const hostCtx = await browser.newContext({
    ...phone,
    permissions: ["camera", "geolocation", "clipboard-read", "clipboard-write"],
    geolocation: { latitude: 42.3196, longitude: -83.2129 },
  });
  const host = await hostCtx.newPage();
  host.on("pageerror", (e) => fails.push(`host run ${run}: ${e.message}`));
  const t0 = Date.now();
  await host.goto(`${srv.url}/app/`);
  await host.getByRole("button", { name: "Take the photo" }).click({ timeout: 15_000 });
  // With no map pack wired (MAP's module), the location gives no name: type it in the sheet.
  await host
    .getByRole("button", { name: /Use these|Use mine/ })
    .waitFor({ timeout: 15_000 })
    .catch(async (e) => {
      await host.screenshot({ path: path.join(OUT, "e2e-fail.png") });
      throw e;
    });
  const sheetWhere = host.getByLabel("Where are you?");
  if (await sheetWhere.isVisible().catch(() => false)) {
    await sheetWhere.fill("Ford Woods Park, by the pond");
    await host.getByRole("button", { name: "Not now" }).click();
  }
  await host.getByRole("button", { name: "Use these" }).click({ timeout: 15_000 });
  const where = host.getByLabel("Where are you?");
  if (await where.isVisible().catch(() => false)) await where.fill("Ford Woods Park, by the pond");
  const name = host.getByLabel("Your first name");
  if (await name.isVisible().catch(() => false)) await name.fill("Fuego");
  await host.getByRole("button", { name: "Send it" }).click();
  await host.getByRole("heading", { name: "Sent." }).waitFor({ timeout: 15_000 });
  const hostMs = Date.now() - t0;
  if (run === 1) await host.screenshot({ path: path.join(OUT, "e2e-h4-sent.png") });
  await host.getByRole("button", { name: "Copy as text" }).click();
  const clip = await host.evaluate(() => navigator.clipboard.readText());
  const link = clip.match(/(\/g\/[0-9a-f-]{36}\/#k=[A-Za-z0-9_-]{43})/)?.[1];
  if (!link) {
    fails.push(`run ${run}: no link in the copied text`);
    break;
  }
  await host.getByRole("button", { name: "Pocket it" }).click();

  const friendCtx = await browser.newContext({
    ...phone,
    permissions: ["geolocation"],
    geolocation: { latitude: 42.3232, longitude: -83.2129 }, // 400 m north of the host's spot
  });
  // iOS-like orientation permission (spike E3 shim): only grants inside a tap.
  await friendCtx.addInitScript(() => {
    const w = window as unknown as { __permCalls: boolean[]; __turn: (deg: number) => void };
    w.__permCalls = [];
    (DeviceOrientationEvent as unknown as { requestPermission: () => Promise<string> }).requestPermission = () => {
      const active = navigator.userActivation.isActive;
      w.__permCalls.push(active);
      return active ? Promise.resolve("granted") : Promise.reject(new DOMException("gesture", "NotAllowedError"));
    };
    w.__turn = (deg) => {
      const e = new Event("deviceorientation");
      Object.assign(e, { alpha: null, beta: 0, gamma: 0, absolute: false, webkitCompassHeading: deg });
      window.dispatchEvent(e);
    };
  });
  const friend = await friendCtx.newPage();
  friend.on("pageerror", (e) => fails.push(`friend run ${run}: ${e.message}`));
  const t1 = Date.now();
  await friend.goto(srv.url + link);
  await friend.getByRole("button", { name: "I'm in" }).click({ timeout: 10_000 });
  await friend.getByLabel("Your first name").fill("Amor");
  await friend.getByRole("button", { name: "Join" }).click();
  await friend
    .getByText(/You're in\.|It's lit\./)
    .first()
    .waitFor({ timeout: 10_000 });
  const friendMs = Date.now() - t1;
  if (run === 1) await friend.screenshot({ path: path.join(OUT, "e2e-i4-in.png") });
  const lit = await friend
    .getByRole("heading", { name: "It's lit." })
    .waitFor({ timeout: 10_000 })
    .then(() => true)
    .catch(() => false);
  const hostLit = await host
    .getByRole("heading", { name: "It's lit." })
    .waitFor({ timeout: 35_000 })
    .then(() => true)
    .catch(() => false);
  if (run === 1) {
    await friend.screenshot({ path: path.join(OUT, "e2e-i6-lit.png") });
    await host.screenshot({ path: path.join(OUT, "e2e-h6-lit.png") });
  }
  // FE4: Find them on the real screen. The prompt must come from the tap.
  // The friend is 400 m north of the spot: facing south reads "straight ahead", facing east "to your right".
  let compass = false;
  if (lit) {
    await friend.getByRole("button", { name: "Find them" }).click();
    await friend.waitForTimeout(300);
    await friend.evaluate(() => (window as unknown as { __turn: (d: number) => void }).__turn(180));
    const ahead = await friend
      .getByText(/Fuego is straight ahead|Fuego, 4\d0 meters, straight ahead/)
      .first()
      .waitFor({ timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    await friend.evaluate(() => (window as unknown as { __turn: (d: number) => void }).__turn(90));
    const right = await friend
      .getByText(/Fuego, 4\d0 meters, to your right/)
      .first()
      .waitFor({ timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    const calls = await friend.evaluate(() => (window as unknown as { __permCalls: boolean[] }).__permCalls);
    compass = ahead && right && calls.length === 1 && calls[0] === true;
    if (!compass)
      fails.push(`run ${run}: compass ahead=${ahead} right=${right} permission calls=${JSON.stringify(calls)}`);
    if (run === 1) await friend.screenshot({ path: path.join(OUT, "e2e-i7-compass.png") });
  }
  results.push({ host: hostMs, friend: friendMs, lit: lit && hostLit && compass });
  await hostCtx.close();
  await friendCtx.close();
}

await browser.close();
srv.close();
const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
const hostMed = med(results.map((r) => r.host));
const friendMed = med(results.map((r) => r.friend));
const report = [
  `runs ${results.length}/${RUNS}`,
  `host open to Sent (ms): ${results.map((r) => r.host).join(", ")}; median ${hostMed} (target 15000)`,
  `link open to You're in (ms): ${results.map((r) => r.friend).join(", ")}; median ${friendMed} (target 10000)`,
  `lit on both phones: ${results.filter((r) => r.lit).length}/${results.length}`,
  `page errors: ${fails.length}${fails.length ? `\n  ${fails.join("\n  ")}` : ""}`,
].join("\n");
console.info(report);
fs.writeFileSync(path.join(OUT, "e2e-flow.txt"), `${new Date().toISOString()}\n${report}\n`);
process.exit(results.length === RUNS && hostMed <= 15000 && friendMed <= 10000 && fails.length === 0 ? 0 : 1);
