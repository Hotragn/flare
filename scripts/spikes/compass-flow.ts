// Spike E3: the iOS compass permission flow, tested in Chrome with a shim that behaves like
// WebKit: DeviceOrientationEvent.requestPermission() exists, rejects with NotAllowedError
// unless the page has transient user activation, and resolves "granted" or "denied".
// Synthetic deviceorientation events carry webkitCompassHeading, as iOS sends them.
// What this can't test (only a real iPhone can): the real prompt, real sensors, and how long
// Safari keeps activation across awaits. Safari's responsive design mode doesn't help: it
// is desktop Safari with a small window, with no requestPermission and no orientation events.
// Usage: node scripts/spikes/compass-flow.ts

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DIR = path.join(ROOT, "apps/web/static/check");
const server = http.createServer((req, res) => {
  const f = path.join(DIR, path.basename(new URL(req.url ?? "/", "http://x").pathname) || "compass.html");
  if (!fs.existsSync(f)) return res.writeHead(404).end();
  const type = f.endsWith(".js") ? "text/javascript" : f.endsWith(".css") ? "text/css" : "text/html";
  res.writeHead(200, { "content-type": type }).end(fs.readFileSync(f));
});
await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

const shim = (answer: string) => `
  (() => {
    const answer = ${JSON.stringify(answer)};
    window.__permCalls = [];
    DeviceOrientationEvent.requestPermission = function () {
      const active = navigator.userActivation.isActive;
      window.__permCalls.push(active);
      if (!active) return Promise.reject(new DOMException("Requires a user gesture", "NotAllowedError"));
      return Promise.resolve(answer);
    };
    window.__turn = (deg) => {
      const e = new Event("deviceorientation");
      Object.assign(e, { alpha: null, beta: 0, gamma: 0, absolute: false, webkitCompassHeading: deg, webkitCompassAccuracy: 10 });
      window.dispatchEvent(e);
    };
  })();`;

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
const check = (name: string, pass: boolean, detail: string) => {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}: ${detail}`);
};

const browser = await chromium.launch({ channel: "chrome", headless: true });
// Fairlane test point; the phone later walks 30 m south of it.
const A = { latitude: 42.3169092, longitude: -83.2229394 };

for (const answer of ["granted", "denied"]) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    permissions: ["geolocation"],
    geolocation: { ...A, accuracy: 5 },
  });
  await ctx.addInitScript(shim(answer));
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${base}/compass.html`);
  await page.click("#start");
  await page.waitForFunction(() => window.__compass.R.location !== "not asked");
  const R1 = await page.evaluate(() => ({ ...window.__compass.R, calls: window.__permCalls }));
  check(
    `${answer}: requestPermission called inside the tap`,
    R1.calls.length === 1 && R1.calls[0] === true,
    `calls ${JSON.stringify(R1.calls)}`,
  );
  check(`${answer}: orientation result recorded`, R1.orientation === answer, R1.orientation);
  check(`${answer}: location asked after orientation`, R1.location === "granted", R1.location);
  // Mark A, walk to the target's opposite side: we stand 30 m south of the target means target is north.
  await page.click("#mark");
  await ctx.setGeolocation({ latitude: A.latitude - 30 / 111_320, longitude: A.longitude, accuracy: 5 });
  await page.waitForFunction(() => /Target, 3[0-1] meters/.test(document.getElementById("spoken")?.textContent ?? ""));
  for (const [deg, want] of [
    [0, "straight ahead"],
    [90, "to your left"],
    [270, "to your right"],
    [180, "behind you"],
  ] as const) {
    await page.evaluate((d) => window.__turn?.(d), deg);
    const text = (await page.textContent("#spoken")) ?? "";
    if (answer === "granted")
      check(`granted: heading ${deg}° says "${want}"`, text.includes(want) && /Target, 3[0-1] meters/.test(text), text);
    else
      check(
        `denied: distance only at ${deg}°`,
        text.includes("Hold your phone flat") && /3[0-1] meters/.test(text),
        text,
      );
  }
  if (answer === "granted") {
    const R2 = await page.evaluate(() => window.__compass.R);
    check("granted: facing tone fired when pointing at it", R2.facingTicks >= 1, `facingTicks ${R2.facingTicks}`);
    check(
      "granted: heading source is webkitCompassHeading",
      R2.headingSource === "webkitCompassHeading",
      R2.headingSource,
    );
    const out = (await page.textContent("#out")) ?? "";
    check("results carry no coordinates", !/42\.31|83\.22/.test(out), "no lat/lon in the copied report");
  }
  check(`${answer}: no page errors`, errors.length === 0, errors.join(" | ") || "none");
  await ctx.close();
}

// Negative control: calling requestPermission without a tap must fail, as on iOS. Called by
// the page itself at load (Playwright's evaluate() counts as a user gesture, so it can't be used).
{
  const ctx = await browser.newContext();
  await ctx.addInitScript(shim("granted"));
  await ctx.addInitScript(
    `addEventListener("load", () => DeviceOrientationEvent.requestPermission().then((x) => (window.__noTap = x), (e) => (window.__noTap = e.name)));`,
  );
  const page = await ctx.newPage();
  await page.goto(`${base}/compass.html`);
  await page.waitForFunction(() => (window as unknown as { __noTap?: string }).__noTap !== undefined);
  const r = await page.evaluate(() => (window as unknown as { __noTap: string }).__noTap);
  check("control: a call outside a tap is refused", r === "NotAllowedError", r);
  await ctx.close();
}
// Location denied.
{
  const ctx = await browser.newContext({ permissions: [] });
  await ctx.addInitScript(shim("granted"));
  const page = await ctx.newPage();
  await page.goto(`${base}/compass.html`);
  await page.click("#start");
  await page.waitForFunction(() => /error/.test(window.__compass.R.location), null, { timeout: 25_000 });
  const text = (await page.textContent("#perm")) ?? "";
  check("location denied: tells the person what to do", text.includes("Location Services"), text);
  await ctx.close();
}
await browser.close();
server.close();
const failed = checks.filter((c) => !c.pass).length;
console.log(`compass flow: ${checks.length - failed}/${checks.length} checks pass`);
process.exit(failed ? 1 : 0);

declare global {
  interface Window {
    __compass: {
      R: Record<string, unknown> & {
        location: string;
        orientation: string;
        facingTicks: number;
        headingSource: string;
      };
    };
    __permCalls: boolean[];
    __turn?: (deg: number) => void;
  }
  interface DeviceOrientationEventStatic {
    requestPermission(): Promise<string>;
  }
}
