// Plans end to end in Chrome on the real stack (E15-S1 to S4; the Plan screens load on demand
// since the JS-budget change, so this guards that path): the host plans "Fairlane walk at 11?"
// from Home (P1), drafts the steps (P2, template tier: no hub), sends it; Amor answers with a
// condition, "step 3 or smaller" (read back, rules only), Kai says yes; at the deadline the server
// solves the plan at step 3, the biggest all three can do, and it lights for both (P5); Amor fades
// once and it becomes step 4 (P6). Real server, real engine, PGlite,
// the e2e clock (POST /__e2e/clock, in-memory database only).
// Usage: npm run build && node apps/web/test/e2e/plan.ts
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright-core";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const OUT = path.join(ROOT, "docs/frontend/evidence");
const PORT = 8871;
const URL0 = `http://localhost:${PORT}`;
const MIN = 60_000;
const fails: string[] = [];
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) fails.push(name);
  console.info(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
};
const server = spawn(process.execPath, ["apps/server/src/main.ts"], {
  cwd: ROOT,
  env: {
    ...process.env,
    PORT: String(PORT),
    DATABASE_URL: "pglite:memory",
    FLARE_E2E_CLOCK: "1",
    PUBLIC_BASE_URL: URL0,
    LOG_LEVEL: "warn",
    SENTRY_DSN: "",
    DO_MODEL_ACCESS_KEY: "",
    GEMINI_API_KEY: "",
    GEMINI: "",
  },
  stdio: "ignore",
});
process.on("exit", () => server.kill("SIGTERM"));
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
const advance = (ms: number) =>
  fetch(`${URL0}/__e2e/clock`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ advance_ms: ms }),
  });

const browser = await chromium.launch({ channel: "chrome" });
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true };
const geo = { latitude: 42.3196, longitude: -83.2129 };
const ctx = async (extra: string[] = []) => {
  const c = await browser.newContext({ ...phone, permissions: ["geolocation", ...extra], geolocation: geo });
  await c.addInitScript(() => {
    try {
      localStorage.setItem("flare.onboarded", "1");
    } catch {}
  });
  return c;
};
const host = await (await ctx(["clipboard-read", "clipboard-write"])).newPage();
const amor = await (await ctx()).newPage();
const kai = await (await ctx()).newPage();
for (const [p, who] of [
  [host, "host"],
  [amor, "amor"],
  [kai, "kai"],
] as const)
  p.on("pageerror", (e) => fails.push(`${who}: ${e.message}`));
const local = (ms: number) => {
  const d = new Date(ms);
  const z = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
};
const seen = (p: Page, text: string) =>
  p
    .getByText(text)
    .first()
    .waitFor({ timeout: 10_000 })
    .then(
      () => true,
      () => false,
    );
const join = async (p: Page, name: string) => {
  const field = p.getByLabel("Your first name");
  if (await field.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await field.fill(name);
    await p.getByRole("button", { name: "Join" }).click();
  }
};

try {
  // P1: from Home.
  await host.goto(`${URL0}/app/`);
  await host.getByRole("button", { name: "Plan for later" }).click({ timeout: 15_000 });
  await host.getByLabel("What's the plan?").fill("Fairlane walk at 11?");
  const now = Date.now();
  await host.getByLabel("Pick a start time").fill(local(now + 3 * 60 * MIN));
  await host.getByLabel("Pick an answer time").fill(local(now + 60 * MIN));
  await host.getByRole("radio", { name: "3" }).check({ force: true });
  check("P1 loads on demand from Home", await host.getByRole("button", { name: "Draft the steps" }).isEnabled());
  await host.getByRole("button", { name: "Draft the steps" }).click();
  // P2: four steps; no name on this phone yet, so P2 asks for it (it used to fail silently).
  const send = host.getByRole("button", { name: "Send it" });
  await host
    .getByText("A quick hello")
    .or(host.getByText(/Step 4|10 min/))
    .first()
    .waitFor({ timeout: 15_000 });
  check("P2 shows four steps", (await host.locator("ol li").count()) >= 4);
  const name = host.getByLabel("Your first name");
  check("P2 asks for a first name when the phone has none", await name.isVisible());
  check("Send waits for the name", await send.isDisabled());
  await name.fill("Fuego");
  await host.screenshot({ path: path.join(OUT, "e2e-p2-ladder.png") });
  await send.click();
  await host.getByRole("heading", { name: /^(Sent\.|Ready\. Share the link\.)$/ }).waitFor({ timeout: 15_000 });
  await host.getByRole("button", { name: "Copy as text" }).click();
  const link =
    (await host.evaluate(() => navigator.clipboard.readText())).match(
      /(\/g\/[0-9a-f-]{36}\/#k=[A-Za-z0-9_-]{43})/,
    )?.[1] ?? "";
  check("plan sent with a link", !!link);

  // Amor: a condition, read back, then in.
  await amor.goto(URL0 + link);
  await amor.getByRole("button", { name: "Add a condition" }).click({ timeout: 15_000 });
  await amor.getByLabel("I'm in if…").fill("step 3 or smaller");
  await amor.getByRole("button", { name: "Check it" }).click();
  await amor.getByRole("button", { name: "Yes, I'm in" }).click({ timeout: 10_000 });
  await join(amor, "Amor");
  check("Amor in with a condition", await seen(amor, "You're in."));
  await amor.screenshot({ path: path.join(OUT, "e2e-p4-condition-in.png") });

  // Kai: a plain yes. "Short one only" is offered (it would pin the plan to step 4).
  await kai.goto(URL0 + link);
  const short = kai.getByRole("button", { name: "Short one only" });
  check(
    "Short one only is offered",
    await short.waitFor({ timeout: 15_000 }).then(
      () => true,
      () => false,
    ),
  );
  await kai.getByRole("button", { name: "I'm in" }).click();
  await join(kai, "Kai");
  check("Kai in", await seen(kai, "You're in."));

  // The deadline: the server solves it; both phones see it lit.
  await advance(61 * MIN);
  for (const [p, who] of [
    [amor, "Amor"],
    [kai, "Kai"],
  ] as const) {
    await p.reload();
    const lit = await p
      .getByRole("button", { name: "Find them" })
      .waitFor({ timeout: 15_000 })
      .then(
        () => true,
        () => false,
      );
    check(`${who} sees the plan lit after the deadline (P5)`, lit);
    if (who === "Amor") check("solved at step 3, the biggest all three can do", await seen(p, "A quick lap"));
  }
  await amor.screenshot({ path: path.join(OUT, "e2e-p5-plan-lit.png") });

  // Fade once (P6).
  const fade = amor.getByRole("button", { name: "I'm fading" });
  if (await fade.isVisible().catch(() => false)) {
    await fade.click();
    await amor.getByRole("button", { name: "Make it smaller" }).click({ timeout: 10_000 });
    const ok = await amor
      .getByRole("button", { name: "Got it" })
      .waitFor({ timeout: 10_000 })
      .then(
        () => true,
        () => false,
      );
    check("Amor fades once (P6)", ok);
    await amor.screenshot({ path: path.join(OUT, "e2e-p6-faded.png") });
  } else check("fade offered on P5 when not at the last step", false, "no I'm fading button");
} catch (e) {
  fails.push(e instanceof Error ? (e.message.split("\n")[0] ?? "error") : String(e));
  for (const [p, n] of [
    [host, "host"],
    [amor, "amor"],
    [kai, "kai"],
  ] as const)
    await p.screenshot({ path: path.join(OUT, `e2e-plan-fail-${n}.png`) }).catch(() => {});
}
await browser.close();
server.kill("SIGTERM");
console.info(fails.length ? `\nFAIL ${fails.join(" | ")}` : "\nplan e2e: all pass");
process.exit(fails.length ? 1 : 0);
