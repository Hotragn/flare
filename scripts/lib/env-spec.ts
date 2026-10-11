// What each part of Flare needs from the environment. Checks look at shape only;
// a report never contains a value, a prefix or a length.
import { accountToken } from "./token-guard.ts";

export type App = "server" | "hub" | "bot" | "deploy" | "test-area";
export type Rule = {
  key: string;
  apps: App[];
  required: boolean;
  why: string;
  /** Returns a reason when the value has the wrong shape. Never echoes the value. */
  shape?: (v: string) => string | null;
};
export type Status = "set" | "missing" | "invalid" | "default";
export type Line = { key: string; app: App; status: Status; required: boolean; reason?: string };

const url = (schemes: string[]) => (v: string) => {
  try {
    const u = new URL(v);
    return schemes.includes(u.protocol.replace(":", "")) ? null : `scheme must be ${schemes.join(" or ")}`;
  } catch {
    return "not a URL";
  }
};
const num = (v: string) => (Number.isFinite(Number(v)) ? null : "not a number");

export const SPEC: Rule[] = [
  { key: "PORT", apps: ["server"], required: false, why: "HTTP port, default 8787", shape: num },
  {
    key: "PUBLIC_BASE_URL",
    apps: ["server", "bot"],
    required: true,
    why: "Links in invites",
    shape: url(["http", "https"]),
  },
  {
    key: "DATABASE_URL",
    apps: ["server"],
    required: false,
    why: "Postgres (ADR-0004); without it the server runs without storage",
    shape: url(["postgres", "postgresql"]),
  },
  {
    key: "HUB_SECRET",
    apps: ["server", "hub"],
    required: true,
    why: "Hub relay auth (ADR-0006)",
    shape: (v) => (v.length >= 32 ? null : "shorter than 32 characters"),
  },
  {
    key: "FLARE_SERVER_URL",
    apps: ["hub"],
    required: false,
    why: "Relay socket, default ws://localhost:8787",
    shape: url(["ws", "wss"]),
  },
  {
    key: "OLLAMA_URL",
    apps: ["hub"],
    required: false,
    why: "Ollama, default http://127.0.0.1:11434",
    shape: url(["http", "https"]),
  },
  { key: "OLLAMA_MODEL", apps: ["hub"], required: false, why: "Default gemma4:e4b-it-q4_K_M" },
  {
    key: "VAPID_PUBLIC_KEY",
    apps: ["server"],
    required: false,
    why: "Web Push (ADR-0014); without it Lit notices go by bot or the open page",
    shape: (v) => (/^[A-Za-z0-9_-]{87}$/.test(v) ? null : "not a P-256 public key in base64url"),
  },
  {
    key: "VAPID_PRIVATE_KEY",
    apps: ["server"],
    required: false,
    why: "Web Push signing key",
    shape: (v) => (/^[A-Za-z0-9_-]{43}$/.test(v) ? null : "not a P-256 private key in base64url"),
  },
  {
    key: "VAPID_SUBJECT",
    apps: ["server"],
    required: false,
    why: "Contact for push services",
    shape: url(["mailto", "https"]),
  },
  {
    key: "TELEGRAM_BOT_TOKEN",
    apps: ["bot"],
    required: true,
    why: "Bot API",
    shape: (v) => (/^\d+:[\w-]{30,}$/.test(v) ? null : "not a bot token shape"),
  },
  { key: "TELEGRAM_BOT_USERNAME", apps: ["bot"], required: true, why: "t.me links" },
  {
    key: "TELEGRAM_ALLOWED_CHAT_IDS",
    apps: ["bot"],
    required: false,
    why: "Comma list; bot leaves other chats (SRS-CH-1). Expected empty until the device check reveals the chat id",
    shape: (v) => (v.split(",").every((s) => /^-?\d+$/.test(s.trim())) ? null : "not a comma list of chat ids"),
  },
  {
    key: "TELEGRAM_WEBHOOK_SECRET",
    apps: ["bot"],
    required: false,
    why: "Webhook header check; generated at deploy when absent",
    shape: (v) => (/^[A-Za-z0-9_-]{16,256}$/.test(v) ? null : "must be 16 to 256 of A-Z a-z 0-9 _ -"),
  },
  {
    key: "SENTRY_DSN",
    apps: ["server"],
    required: false,
    why: "AI-path traces (ADR-0021); off when empty",
    shape: (v) =>
      accountToken(v)
        ? `this is ${accountToken(v)}, not a project DSN (https://key@host/id)`
        : /^https:\/\/[A-Za-z0-9]+@[A-Za-z0-9.-]+\/\d+$/.test(v)
          ? null
          : "not a Sentry DSN (https://key@host/id)",
  },
  {
    key: "DO_MODEL_ACCESS_KEY",
    apps: ["server"],
    required: false,
    why: "DigitalOcean Serverless Inference model access key, cloud tier (ADR-0022); off when empty",
    shape: (v) => {
      const t = accountToken(v);
      return t ? `this is ${t}, not a scoped model access key; the cloud tier stays off` : null;
    },
  },
  { key: "RENDER_KEY", apps: ["deploy"], required: true, why: "Render API, deploy only" },
  { key: "TEST_AREA_NAME", apps: ["test-area"], required: false, why: "Map pack label" },
  { key: "TEST_AREA_LAT", apps: ["test-area"], required: false, why: "Map pack centre", shape: num },
  { key: "TEST_AREA_LON", apps: ["test-area"], required: false, why: "Map pack centre", shape: num },
  { key: "TEST_AREA_RADIUS_KM", apps: ["test-area"], required: false, why: "Map pack radius", shape: num },
];

export function check(vars: Record<string, string | undefined>, apps: App[], spec: Rule[] = SPEC): Line[] {
  const out: Line[] = [];
  for (const r of spec) {
    for (const app of r.apps) {
      if (!apps.includes(app)) continue;
      const v = vars[r.key];
      if (v === undefined || v === "") {
        out.push({ key: r.key, app, required: r.required, status: r.required ? "missing" : "default" });
        continue;
      }
      const reason = r.shape?.(v) ?? null;
      out.push(
        reason
          ? { key: r.key, app, required: r.required, status: "invalid", reason }
          : { key: r.key, app, required: r.required, status: "set" },
      );
    }
  }
  return out;
}

export const failed = (lines: Line[]) =>
  lines.some((l) => l.status === "invalid" || (l.required && l.status === "missing"));

export function format(lines: Line[]): string {
  const rows = lines.map((l) => {
    const mark = l.status === "set" ? "ok  " : l.status === "default" ? "--  " : "FAIL";
    const note =
      l.status === "default" ? "not set, default used" : l.status === "invalid" ? `invalid: ${l.reason}` : l.status;
    return `${mark} ${l.app.padEnd(9)} ${l.key.padEnd(26)} ${note}`;
  });
  return rows.join("\n");
}
