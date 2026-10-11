// INT3: telegram:webhook and telegram:status print a dry run without --yes, hide the token
// and secret, and refuse to call Telegram with a bad setup. The success path is checked
// against the fake Bot API only; no test calls api.telegram.org.
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { callBot, describeCall, formatStatus, webhookPlan } from "../../../../scripts/telegram-lib.ts";
import { type FakeBotApi, startFakeBotApi } from "./fakes/bot-api.ts";

const run = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, "../../../..");
const TOKEN = "123456789:AAfakeTokenForTestsOnly_abcdefghijklmn";
const SECRET = "webhookSecretForTests_0123456789";
let dir: string;
let tg: FakeBotApi;

const envFile = (lines: Record<string, string>) => {
  const f = path.join(dir, `env-${Math.random().toString(36).slice(2)}`);
  fs.writeFileSync(
    f,
    Object.entries(lines)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n"),
  );
  return f;
};
const GOOD = {
  TELEGRAM_BOT_TOKEN: TOKEN,
  TELEGRAM_WEBHOOK_SECRET: SECRET,
  PUBLIC_BASE_URL: "https://flare-outside.onrender.com",
  TELEGRAM_ALLOWED_CHAT_IDS: "-1001234567890",
};
async function cli(script: string, env: string, args: string[] = []) {
  try {
    const r = await run("node", [path.join(ROOT, "scripts", script), ...args], {
      env: { PATH: process.env.PATH, FLARE_ENV_FILE: env },
    });
    return { code: 0, out: r.stdout + r.stderr };
  } catch (e) {
    const x = e as { code: number; stdout: string; stderr: string };
    return { code: x.code, out: x.stdout + x.stderr };
  }
}

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "flare-tg-"));
  tg = await startFakeBotApi();
});
afterAll(async () => {
  fs.rmSync(dir, { recursive: true, force: true });
  await tg.close();
});

describe("telegram:webhook and telegram:status (INT3)", () => {
  it("SRS-CH-1: the dry run prints setWebhook per the contract with the token and secret hidden", async () => {
    const r = await cli("telegram-webhook.ts", envFile(GOOD));
    expect(r.code).toBe(0);
    expect(r.out).toContain("POST https://api.telegram.org/bot<hidden>/setWebhook");
    expect(r.out).toContain('"url": "https://flare-outside.onrender.com/api/v1/telegram/webhook"');
    expect(r.out).toContain('"secret_token": "<hidden>"');
    expect(r.out).toContain('"drop_pending_updates": true');
    expect(r.out).toContain("Dry run. Nothing was sent.");
    expect(r.out).not.toContain(TOKEN);
    expect(r.out).not.toContain(TOKEN.split(":")[1]);
    expect(r.out).not.toContain(SECRET);
  });
  it("refuses --yes with an http base URL, no secret or an empty allow-list, before any call", async () => {
    const bad = envFile({ TELEGRAM_BOT_TOKEN: TOKEN, PUBLIC_BASE_URL: "http://localhost:8787" });
    const r = await cli("telegram-webhook.ts", bad, ["--yes"]);
    expect(r.code).toBe(1);
    expect(r.out).toContain("Refusing to call setWebhook");
    expect(r.out).toContain("PUBLIC_BASE_URL must be https");
    expect(r.out).toContain("TELEGRAM_WEBHOOK_SECRET missing");
    expect(r.out).toContain("TELEGRAM_ALLOWED_CHAT_IDS is empty");
    expect(r.out).not.toContain(TOKEN);
  });
  it("status dry run prints the two read calls and stops", async () => {
    const r = await cli("telegram-status.ts", envFile(GOOD));
    expect(r.code).toBe(0);
    expect(r.out).toContain("/getMe");
    expect(r.out).toContain("/getWebhookInfo");
    expect(r.out).toContain("Dry run");
    expect(r.out).not.toContain(TOKEN);
  });
  it("the plan matches contracts/telegram.md 1 exactly", () => {
    expect(webhookPlan(GOOD)).toEqual({
      method: "setWebhook",
      params: {
        url: "https://flare-outside.onrender.com/api/v1/telegram/webhook",
        secret_token: SECRET,
        allowed_updates: ["message", "callback_query", "my_chat_member"],
        drop_pending_updates: true,
      },
      problems: [],
    });
    expect(describeCall("setWebhook", webhookPlan(GOOD).params)).not.toContain(SECRET);
  });
  it("callBot sends the plan to a Bot API and hides the token in errors (fake Bot API)", async () => {
    const plan = webhookPlan(GOOD);
    await callBot(TOKEN, plan.method, plan.params, tg.baseUrl);
    expect(tg.of("setWebhook")[0]?.params).toEqual(plan.params);
    tg.fail("getMe", 401, "Unauthorized");
    const err = await callBot(TOKEN, "getMe", {}, tg.baseUrl).catch((e: Error) => e.message);
    expect(err).toBe("getMe: 401 Unauthorized");
    const net = await callBot(TOKEN, "getMe", {}, "http://127.0.0.1:1").catch((e: Error) => e.message);
    expect(net).toBe("getMe: network error");
  });
  it("formatStatus flags privacy mode off", () => {
    const s = formatStatus(
      { username: "FairlaneFlareBot", can_read_all_group_messages: true, can_join_groups: true },
      { url: "", pending_update_count: 3 },
    );
    expect(s).toContain("privacy mode: OFF (should be on)");
    expect(s).toContain("webhook: none set");
    expect(s).toContain("pending updates: 3");
  });
});
