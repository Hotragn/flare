// One-step Render deploy (BE10, SRS-MNT-3, docs/architecture/01-system-architecture.md 6):
// Postgres, the web service and the 5-minute sweep cron, all in Ohio, env from .env.
// Waits for the founder: without --yes it prints the plan and calls nothing. Values are
// never printed; each env var shows only "set" or "missing".
// Usage: npm run deploy:render            (dry run, offline)
//        npm run deploy:render -- --yes   (creates or updates on Render)
import { execFileSync } from "node:child_process";
import { hasYes, loadVars, type Vars } from "./telegram-lib.ts";

export const REGION = "ohio";
export const NODE_VERSION = "24.21.0";
export const NAMES = { web: "flare-outside", db: "flare-db", cron: "flare-sweep" };
/** Sent to the web service and the cron job from .env. DATABASE_URL comes from Render. */
export const WEB_KEYS = [
  "PUBLIC_BASE_URL",
  "HUB_SECRET",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_BOT_USERNAME",
  "TELEGRAM_ALLOWED_CHAT_IDS",
  "TELEGRAM_WEBHOOK_SECRET",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
];
const REQUIRED = ["RENDER_KEY", "PUBLIC_BASE_URL", "HUB_SECRET"];

export type Step = { what: string; method: "GET" | "POST" | "PUT"; path: string };
export type DeployPlan = {
  repo: string;
  env: { key: string; status: "set" | "missing" }[];
  steps: Step[];
  problems: string[];
};

export function repoUrl(): string {
  try {
    const remote = execFileSync("git", ["remote", "get-url", "origin"], { encoding: "utf8" }).trim();
    const m = /github\.com[:/](.+?)(?:\.git)?$/.exec(remote);
    return m ? `https://github.com/${m[1]}` : remote;
  } catch {
    return "";
  }
}

export function deployPlan(vars: Vars, repo: string): DeployPlan {
  const problems = REQUIRED.filter((k) => !vars[k]).map((k) => `${k} is missing`);
  if (!repo.startsWith("https://github.com/")) problems.push("git remote origin is not a GitHub repo");
  if (vars.PUBLIC_BASE_URL && !vars.PUBLIC_BASE_URL.startsWith("https://"))
    problems.push("PUBLIC_BASE_URL must be https");
  return {
    repo,
    env: WEB_KEYS.map((key) => ({ key, status: vars[key] ? "set" : "missing" })),
    steps: [
      { what: "find the workspace (owner)", method: "GET", path: "/v1/owners" },
      { what: `find or create Postgres ${NAMES.db} (${REGION})`, method: "POST", path: "/v1/postgres" },
      {
        what: "read its internal connection string as DATABASE_URL",
        method: "GET",
        path: "/v1/postgres/{id}/connection-info",
      },
      {
        what: `find or create web service ${NAMES.web} (starter, 1 instance, health /api/v1/health)`,
        method: "POST",
        path: "/v1/services",
      },
      {
        what: `set ${WEB_KEYS.length + 2} env vars on ${NAMES.web}`,
        method: "PUT",
        path: "/v1/services/{id}/env-vars",
      },
      {
        what: `find or create cron job ${NAMES.cron} (*/5 * * * *, npm run sweep)`,
        method: "POST",
        path: "/v1/services",
      },
      { what: `set DATABASE_URL on ${NAMES.cron}`, method: "PUT", path: "/v1/services/{id}/env-vars" },
      { what: `deploy ${NAMES.web}`, method: "POST", path: "/v1/services/{id}/deploys" },
    ],
    problems,
  };
}

export function formatPlan(p: DeployPlan): string {
  return [
    `repo: ${p.repo || "?"} (branch main), region ${REGION}, Node ${NODE_VERSION}`,
    "build: npm ci && npm run build    start: npm start",
    "env (values never shown):",
    ...p.env.map((e) => `  ${e.key}: ${e.status}`),
    "  DATABASE_URL: from Render Postgres",
    `  NODE_VERSION: ${NODE_VERSION}`,
    "steps:",
    ...p.steps.map((s, i) => `  ${i + 1}. ${s.method} ${s.path}  ${s.what}`),
    ...p.problems.map((x) => `problem: ${x}`),
  ].join("\n");
}

type Api = <T>(method: string, path: string, body?: unknown) => Promise<T>;

function renderApi(key: string, base: string): Api {
  return async (method, path, body) => {
    let res: Response;
    try {
      res = await fetch(`${base}${path}`, {
        method,
        headers: { authorization: `Bearer ${key}`, accept: "application/json", "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new Error(`${method} ${path}: network error`);
    }
    // The error text never echoes the request body (it holds env values).
    if (!res.ok) throw new Error(`${method} ${path}: ${res.status}`);
    return (await res.json().catch(() => ({}))) as never;
  };
}

type Listed<K extends string, T> = Record<K, T>[];

/** Runs the plan. Find-or-create by name, so a second run updates instead of duplicating. */
export async function deploy(vars: Vars, repo: string, base = "https://api.render.com"): Promise<string[]> {
  const api = renderApi(vars.RENDER_KEY as string, base);
  const done: string[] = [];
  const owners = await api<Listed<"owner", { id: string }>>("GET", "/v1/owners?limit=1");
  const ownerId = owners[0]?.owner.id;
  if (!ownerId) throw new Error("no Render workspace for this key");

  const dbs = await api<Listed<"postgres", { id: string }>>("GET", `/v1/postgres?name=${NAMES.db}`);
  let dbId = dbs[0]?.postgres.id;
  if (!dbId) {
    const made = await api<{ id: string }>("POST", "/v1/postgres", {
      name: NAMES.db,
      ownerId,
      plan: "basic_256mb",
      region: REGION,
      version: "17",
    });
    dbId = made.id;
    done.push(`created ${NAMES.db}`);
  } else done.push(`found ${NAMES.db}`);
  const conn = await api<{ internalConnectionString?: string }>("GET", `/v1/postgres/${dbId}/connection-info`);
  if (!conn.internalConnectionString) throw new Error("Postgres has no connection string yet; run again in a minute");

  const env = [
    ...WEB_KEYS.filter((k) => vars[k]).map((key) => ({ key, value: vars[key] as string })),
    { key: "DATABASE_URL", value: conn.internalConnectionString },
    { key: "NODE_VERSION", value: NODE_VERSION },
  ];
  const service = async (name: string, details: Record<string, unknown>, type: "web_service" | "cron_job") => {
    const found = await api<Listed<"service", { id: string }>>("GET", `/v1/services?name=${name}&limit=1`);
    let id = found[0]?.service.id;
    if (!id) {
      const made = await api<{ service?: { id: string }; id?: string }>("POST", "/v1/services", {
        type,
        name,
        ownerId,
        repo,
        branch: "main",
        autoDeploy: "no",
        serviceDetails: details,
      });
      id = made.service?.id ?? made.id;
      done.push(`created ${name}`);
    } else done.push(`found ${name}`);
    if (!id) throw new Error(`no id for ${name}`);
    return id;
  };

  const webId = await service(
    NAMES.web,
    {
      runtime: "node",
      region: REGION,
      plan: "starter",
      numInstances: 1,
      healthCheckPath: "/api/v1/health",
      envSpecificDetails: { buildCommand: "npm ci && npm run build", startCommand: "npm start" },
    },
    "web_service",
  );
  await api("PUT", `/v1/services/${webId}/env-vars`, env);
  done.push(`set ${env.length} env vars on ${NAMES.web}`);

  const cronId = await service(
    NAMES.cron,
    {
      runtime: "node",
      region: REGION,
      plan: "starter",
      schedule: "*/5 * * * *",
      envSpecificDetails: { buildCommand: "npm ci", startCommand: "npm run sweep" },
    },
    "cron_job",
  );
  await api("PUT", `/v1/services/${cronId}/env-vars`, [
    { key: "DATABASE_URL", value: conn.internalConnectionString },
    { key: "NODE_VERSION", value: NODE_VERSION },
  ]);
  done.push(`set 2 env vars on ${NAMES.cron}`);
  await api("POST", `/v1/services/${webId}/deploys`, { clearCache: "do_not_clear" });
  done.push(`deploy started for ${NAMES.web}`);
  return done;
}

if (import.meta.main) {
  const vars = loadVars();
  const plan = deployPlan(vars, repoUrl());
  console.log(formatPlan(plan));
  if (!hasYes(process.argv.slice(2))) {
    console.log("\nDry run. Nothing was sent. Add -- --yes after the founder approves the deploy.");
    process.exit(plan.problems.length ? 1 : 0);
  }
  if (plan.problems.length) {
    console.error("\nRefusing to deploy until the problems above are fixed.");
    process.exit(1);
  }
  for (const line of await deploy(vars, plan.repo, vars.RENDER_API_BASE ?? "https://api.render.com"))
    console.log(`ok   ${line}`);
  console.log("\nNext: npm run telegram:webhook (after the device checklist), then npm run telegram:status -- --yes");
}
