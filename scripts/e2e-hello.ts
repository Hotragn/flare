// End-to-end hello world, with the real parts: Chrome opens the phone page, picks a
// photo, the server relays it to the hub over the WebSocket, the hub asks Ollama,
// and the six words come back to the page. Needs Ollama running with the model,
// Google Chrome installed, and a built web app (npm run build).
// Usage: npm run e2e:hello
import { type ChildProcess, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.E2E_PORT ?? 8799);
const BASE = `http://localhost:${PORT}`;
const PHOTO = path.join(ROOT, "scripts/fixtures/pond-illustration.jpg");
const kids: ChildProcess[] = [];

function run(name: string, args: string[], extra: Record<string, string>) {
  const p = spawn(process.execPath, args, {
    cwd: ROOT,
    env: { ...process.env, ...extra },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const tag = (b: Buffer) =>
    b
      .toString()
      .trimEnd()
      .split("\n")
      .map((l) => `  [${name}] ${l}`)
      .join("\n");
  p.stdout?.on("data", (b: Buffer) => process.env.E2E_VERBOSE && console.log(tag(b)));
  p.stderr?.on("data", (b: Buffer) => console.error(tag(b)));
  kids.push(p);
  return p;
}
async function until<T>(what: string, ms: number, probe: () => Promise<T | null>): Promise<T> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = await probe().catch(() => null);
    if (v) return v;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`timed out waiting for ${what}`);
}
function stopAll() {
  for (const k of kids) k.kill("SIGTERM");
}
process.on("exit", stopAll);

async function main() {
  if (!fs.existsSync(path.join(ROOT, "apps/web/build/hello/index.html")))
    throw new Error("web build missing: run npm run build");
  const t0 = performance.now();
  run("server", ["apps/server/src/main.ts"], { PORT: String(PORT), DATABASE_URL: "", LOG_LEVEL: "warn" });
  await until("server health", 15_000, async () => ((await fetch(`${BASE}/api/v1/health`)).ok ? true : null));
  run("hub", ["apps/hub/src/main.ts"], { FLARE_SERVER_URL: `ws://localhost:${PORT}` });
  await until("hub connected", 90_000, async () => {
    const h = (await (await fetch(`${BASE}/api/v1/health`)).json()) as { hub: string };
    return h.hub === "connected" ? true : null;
  });
  console.log(`server and hub up in ${Math.round(performance.now() - t0)} ms`);

  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
    const problems: string[] = [];
    page.on("console", (m) => m.type() === "error" && problems.push(m.text()));
    page.on("pageerror", (e) => problems.push(e.message));
    await page.goto(`${BASE}/hello/`);
    await page.evaluate(() =>
      document.addEventListener("securitypolicyviolation", (e) =>
        console.error(
          `CSP blocked ${e.violatedDirective} ${e.blockedURI} ${e.sourceFile}:${e.lineNumber} ${(e.sample ?? "").slice(0, 60)}`,
        ),
      ),
    );
    const t1 = performance.now();
    await page.getByTestId("photo").setInputFiles(PHOTO);
    await page.getByTestId("invite").waitFor({ timeout: 45_000 });
    const roundTrip = Math.round(performance.now() - t1);
    const invite = await page.getByTestId("invite").innerText();
    const alt = await page.getByTestId("alt").innerText();
    const meta = await page.getByTestId("meta").innerText();
    console.log(`invite: ${invite}\nalt:    ${alt}\nmeta:   ${meta}\nround trip in the browser: ${roundTrip} ms`);
    const words = invite.trim().split(/\s+/).length;
    const ok = meta.startsWith("tier hub") && words >= 1 && words <= 6;
    if (!ok) throw new Error(`expected a hub draft of 1 to 6 words, got "${meta}" / ${words} words`);
    if (problems.length) throw new Error(`page errors: ${problems.join(" | ")}`);
    console.log("no console errors, no CSP violations");
    console.log("PASS phone page -> server -> hub relay -> Ollama -> back");
  } finally {
    await browser.close();
  }
}

main().then(
  () => {
    stopAll();
    process.exit(0);
  },
  (e: unknown) => {
    console.error(`FAIL ${e instanceof Error ? e.message : String(e)}`);
    stopAll();
    process.exit(1);
  },
);
