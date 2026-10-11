// Smoke test for a running Flare server, local or deployed. Read-only except one photo draft
// (kept in memory, never stored). Usage: npm run smoke -- https://flare-outside.onrender.com
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = (process.argv[2] ?? "http://localhost:8787").replace(/\/$/, "");
let failed = 0;
const say = (ok: boolean | "warn", name: string, detail = "") => {
  if (ok === false) failed++;
  console.log(`${ok === "warn" ? "warn" : ok ? "ok  " : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
};
const get = (p: string, init?: RequestInit) => fetch(`${base}${p}`, { redirect: "manual", ...init });

const health = (await (await get("/api/v1/health")).json()) as {
  ok: boolean;
  hub: string;
  db: string;
  version: string;
};
say(health.ok, "health", `version ${health.version}`);
say(health.db === "ok", "database", health.db);
say(
  health.hub === "connected" ? true : "warn",
  "hub",
  health.hub === "connected" ? "connected" : "absent: drafts use the template until npm run hub:field connects",
);

const cfg = (await (await get("/api/v1/config")).json()) as {
  vapid_public_key: string | null;
  telegram_bot_username: string | null;
  cloud_ai: { provider: string | null };
};
say(!!cfg.vapid_public_key, "web push configured");
say(cfg.telegram_bot_username ? true : "warn", "telegram bot username");
say(true, "cloud tier", cfg.cloud_ai?.provider ?? "off");

for (const p of ["/", "/app/", "/g/11111111-1111-4111-8111-111111111111/", "/check/"]) {
  const r = await get(p);
  const csp = r.headers.get("content-security-policy") ?? "";
  const scriptSrc = csp.split(";").find((d) => d.trim().startsWith("script-src")) ?? "";
  say(
    r.status === 200 && !!csp && !scriptSrc.includes("unsafe-inline"),
    `page ${p}`,
    `${r.status}, CSP ${csp ? "set" : "missing"}`,
  );
}
const app = await get("/app/");
say(
  base.startsWith("http://localhost") || (app.headers.get("strict-transport-security") ?? "").includes("max-age"),
  "HSTS",
  app.headers.get("strict-transport-security") ?? "none",
);
say((await get("/%2e%2e/%2e%2e/.env")).status === 404, "path traversal refused");

const preview = await (
  await get("/g/11111111-1111-4111-8111-111111111111", { headers: { "user-agent": "facebookexternalhit/1.1" } })
).text();
say(
  /og:title" content="A Flare from a friend"/.test(preview) && preview.includes(new URL(base).host),
  "link preview: safe title, absolute URLs on this host",
);

const audit = (await (await get("/api/v1/audit")).json()) as { pass: boolean };
say(audit.pass, "deletion audit");

const jpeg = fs.readFileSync(path.join(ROOT, "scripts/fixtures/pond-illustration.jpg"));
const t = performance.now();
const d = (await (
  await get("/api/v1/drafts", { method: "POST", headers: { "content-type": "image/jpeg" }, body: jpeg })
).json()) as { tier: string; invite: string };
say(
  d.tier === "hub" ? true : "warn",
  "photo draft",
  `${d.tier} in ${Math.round(performance.now() - t)} ms${d.tier === "hub" ? `: "${d.invite}"` : ""}`,
);

console.log(failed ? `\n${failed} failed` : "\nsmoke: all required checks pass");
process.exit(failed ? 1 : 0);
