// BE10: the Render deploy script. The dry run is offline and shows no values; the --yes
// path runs only against a fake Render API here (no call to api.render.com in tests).
import { execFile } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deploy, deployPlan, formatPlan, NAMES } from "../../../../scripts/deploy-render.ts";

const ROOT = path.resolve(import.meta.dirname, "../../../..");
const VARS = {
  RENDER_KEY: "fake-render-key-for-tests",
  PUBLIC_BASE_URL: "https://flare-outside.onrender.com",
  HUB_SECRET: "hubSecretValueForTests_0123456789abcdef",
  TELEGRAM_BOT_TOKEN: "123456789:AAfakeTokenForTestsOnly_abcdefghijklmn",
  VAPID_PRIVATE_KEY: "vapidPrivateValueForTests_0123456789abcd",
};
const REPO = "https://github.com/Hotragn/flare";

type Req = { method: string; url: string; auth: string; body: unknown };
const reqs: Req[] = [];
const existing = new Set<string>();
let server: http.Server;
let base = "";

beforeAll(async () => {
  server = http.createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : undefined;
    const url = req.url ?? "";
    reqs.push({ method: req.method ?? "", url, auth: String(req.headers.authorization), body });
    const json = (v: unknown) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(v));
    };
    if (url.startsWith("/v1/owners")) return json([{ owner: { id: "own-1" } }]);
    if (req.method === "GET" && url.startsWith("/v1/postgres?"))
      return json(existing.has(NAMES.db) ? [{ postgres: { id: "db-1" } }] : []);
    if (url === "/v1/postgres") return json({ id: "db-1" });
    if (url.endsWith("/connection-info")) return json({ internalConnectionString: "postgresql://internal/flare" });
    if (req.method === "GET" && url.startsWith("/v1/services?")) {
      const name = new URL(url, "http://x").searchParams.get("name") ?? "";
      return json(existing.has(name) ? [{ service: { id: `svc-${name}` } }] : []);
    }
    if (req.method === "GET" && url === `/v1/services/svc-${NAMES.web}`)
      return json({ serviceDetails: { url: "https://flare-outside-x1.onrender.com" } });
    if (url === "/v1/services") return json({ service: { id: `svc-${(body as { name: string }).name}` } });
    return json({});
  });
  server.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise((r) => server.close(r)));

describe("deploy:render (BE10, SRS-MNT-3)", () => {
  it("SRS-MNT-3: the dry run prints the plan with env as set or missing, never a value", async () => {
    const out = formatPlan(deployPlan(VARS, REPO));
    expect(out).toContain("PUBLIC_BASE_URL: set");
    expect(out).toContain("TELEGRAM_WEBHOOK_SECRET: missing");
    expect(out).toContain("*/5 * * * *");
    for (const v of Object.values(VARS)) expect(out).not.toContain(v);
  });
  it("the CLI without --yes calls nothing and exits 1 when required settings are missing", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "flare-deploy-"));
    const env = path.join(dir, "env");
    fs.writeFileSync(env, "PUBLIC_BASE_URL=https://flare-outside.onrender.com\n");
    const r = await promisify(execFile)("node", [path.join(ROOT, "scripts/deploy-render.ts")], {
      env: { PATH: process.env.PATH, FLARE_ENV_FILE: env, RENDER_API_BASE: base },
    }).catch((e: { code: number; stdout: string }) => e);
    const before = reqs.length;
    expect((r as { code?: number }).code).toBe(1);
    expect((r as { stdout: string }).stdout).toContain("problem: RENDER_KEY is missing");
    expect((r as { stdout: string }).stdout).toContain("Dry run. Nothing was sent.");
    expect(reqs.length).toBe(before);
    fs.rmSync(dir, { recursive: true, force: true });
  });
  it("--yes creates Postgres, web service and cron in Ohio, sets env, deploys (fake Render API)", async () => {
    reqs.length = 0;
    const done = await deploy(VARS, REPO, base);
    expect(done).toEqual([
      "created flare-db",
      "created flare-outside",
      "set 6 env vars on flare-outside",
      "created flare-sweep",
      "set 2 env vars on flare-sweep",
      "deploy started for flare-outside",
    ]);
    expect(reqs.every((r) => r.auth === `Bearer ${VARS.RENDER_KEY}`)).toBe(true);
    const web = reqs.find((r) => r.url === "/v1/services" && (r.body as { name: string }).name === NAMES.web);
    expect(web?.body).toMatchObject({
      type: "web_service",
      repo: REPO,
      serviceDetails: { region: "ohio", numInstances: 1, healthCheckPath: "/api/v1/health" },
    });
    const env = reqs.find((r) => r.url === `/v1/services/svc-${NAMES.web}/env-vars`)?.body as { key: string }[];
    expect(env.map((e) => e.key).sort()).toEqual(
      [
        "DATABASE_URL",
        "HUB_SECRET",
        "NODE_VERSION",
        "PUBLIC_BASE_URL",
        "TELEGRAM_BOT_TOKEN",
        "VAPID_PRIVATE_KEY",
      ].sort(),
    );
  });
  it("never sends an account-wide token to Render, and says which key was left out", async () => {
    reqs.length = 0;
    const pat = ["dop", "v1", "z".repeat(64)].join("_");
    const vars = { ...VARS, DO_MODEL_ACCESS_KEY: pat, SENTRY_DSN: "https://abc123@o1.ingest.sentry.io/2" };
    expect(formatPlan(deployPlan(vars, REPO))).toContain("DO_MODEL_ACCESS_KEY: not sent: account token");
    await deploy(vars, REPO, base);
    const sent = JSON.stringify(reqs.map((r) => r.body));
    expect(sent).not.toContain(pat);
    expect(sent).toContain("SENTRY_DSN");
  });
  it("a local http PUBLIC_BASE_URL is replaced by the service's onrender.com URL", async () => {
    reqs.length = 0;
    const done = await deploy({ ...VARS, PUBLIC_BASE_URL: "http://localhost:8787" }, REPO, base);
    expect(done).toContain("PUBLIC_BASE_URL from Render: https://flare-outside-x1.onrender.com");
    const env = reqs.find((r) => r.url === `/v1/services/svc-${NAMES.web}/env-vars`)?.body as {
      key: string;
      value: string;
    }[];
    expect(env.find((e) => e.key === "PUBLIC_BASE_URL")?.value).toBe("https://flare-outside-x1.onrender.com");
    expect(formatPlan(deployPlan({ PUBLIC_BASE_URL: "http://localhost:8787" }, REPO))).toContain(
      "PUBLIC_BASE_URL: from Render",
    );
  });
  it("a second run finds everything by name and creates nothing", async () => {
    for (const n of Object.values(NAMES)) existing.add(n);
    reqs.length = 0;
    const done = await deploy(VARS, REPO, base);
    expect(done.filter((d) => d.startsWith("created"))).toEqual([]);
    expect(reqs.filter((r) => r.method === "POST" && !r.url.endsWith("/deploys"))).toHaveLength(0);
  });
});
