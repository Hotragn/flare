// Shared code for `npm run telegram:webhook` and `npm run telegram:status` (INT3).
// Both print a dry run unless `--yes` is given. Values from .env are never printed:
// the token and the webhook secret show as "<hidden>".
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const HIDDEN = "<hidden>";
export const WEBHOOK_PATH = "/api/v1/telegram/webhook";
export const ALLOWED_UPDATES = ["message", "callback_query", "my_chat_member"];

export type Vars = Record<string, string | undefined>;

/** process.env plus the env file (FLARE_ENV_FILE or .env), without changing process.env. */
export function loadVars(): Vars {
  const file = process.env.FLARE_ENV_FILE ?? path.join(ROOT, ".env");
  const vars: Vars = { ...process.env };
  if (fs.existsSync(file)) {
    const util = process as unknown as {
      getBuiltinModule?: (m: string) => { parseEnv?: (s: string) => Record<string, string> };
    };
    const parse = util.getBuiltinModule?.("node:util")?.parseEnv;
    if (!parse) throw new Error("Node 24.21+ needed for util.parseEnv");
    Object.assign(vars, parse(fs.readFileSync(file, "utf8")));
  }
  return vars;
}

export type Plan = { method: string; params: Record<string, unknown>; problems: string[] };

/** The setWebhook call from contracts/telegram.md section 1. */
export function webhookPlan(vars: Vars): Plan {
  const problems: string[] = [];
  if (!/^\d+:[\w-]{30,}$/.test(vars.TELEGRAM_BOT_TOKEN ?? ""))
    problems.push("TELEGRAM_BOT_TOKEN missing or wrong shape");
  const secret = vars.TELEGRAM_WEBHOOK_SECRET ?? "";
  if (!/^[A-Za-z0-9_-]{16,256}$/.test(secret))
    problems.push(
      "TELEGRAM_WEBHOOK_SECRET missing or not 16 to 256 of A-Z a-z 0-9 _ - (set the same value on the server)",
    );
  let url = "";
  try {
    const base = new URL(vars.PUBLIC_BASE_URL ?? "");
    if (base.protocol !== "https:") problems.push("PUBLIC_BASE_URL must be https (Telegram only calls https)");
    url = new URL(WEBHOOK_PATH, base).toString();
  } catch {
    problems.push("PUBLIC_BASE_URL missing or not a URL");
  }
  if (!(vars.TELEGRAM_ALLOWED_CHAT_IDS ?? "").trim())
    problems.push("TELEGRAM_ALLOWED_CHAT_IDS is empty: the bot would leave every group");
  return {
    method: "setWebhook",
    params: { url, secret_token: secret, allowed_updates: ALLOWED_UPDATES, drop_pending_updates: true },
    problems,
  };
}

/** A printable copy of a call with every secret replaced. */
export function describeCall(method: string, params: Record<string, unknown>): string {
  const shown = { ...params };
  if ("secret_token" in shown) shown.secret_token = HIDDEN;
  return `POST https://api.telegram.org/bot${HIDDEN}/${method}\n${JSON.stringify(shown, null, 2)}`;
}

/** Calls the Bot API. Errors never include the URL (it holds the token). */
export async function callBot(
  token: string,
  method: string,
  params: Record<string, unknown>,
  base = "https://api.telegram.org",
): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(`${base}/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Error(`${method}: network error`);
  }
  const json = (await res.json().catch(() => null)) as { ok?: boolean; result?: unknown; description?: string } | null;
  if (!json?.ok) throw new Error(`${method}: ${res.status} ${json?.description ?? ""}`.trim());
  return json.result;
}

/** What `telegram:status` prints from getMe and getWebhookInfo. No secrets in either. */
export function formatStatus(me: unknown, info: unknown): string {
  const m = me as { username?: string; can_join_groups?: boolean; can_read_all_group_messages?: boolean };
  const i = info as {
    url?: string;
    pending_update_count?: number;
    last_error_date?: number;
    last_error_message?: string;
    allowed_updates?: string[];
  };
  return [
    `bot: @${m.username ?? "?"}`,
    `privacy mode: ${m.can_read_all_group_messages ? "OFF (should be on)" : "on"}`,
    `joins groups: ${m.can_join_groups ? "yes" : "no"}`,
    `webhook: ${i.url ? i.url : "none set"}`,
    `pending updates: ${i.pending_update_count ?? 0}`,
    `allowed updates: ${(i.allowed_updates ?? []).join(", ") || "default"}`,
    `last error: ${i.last_error_message ? `${i.last_error_message} at ${new Date((i.last_error_date ?? 0) * 1000).toISOString()}` : "none"}`,
  ].join("\n");
}

export const hasYes = (argv: string[]) => argv.includes("--yes");
