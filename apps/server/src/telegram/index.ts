// mountTelegram(app, deps): the webhook and the three phone routes INT owns
// (openapi.yaml tag `telegram`). BE calls it in createApp when TELEGRAM_BOT_TOKEN is set.
import { createHash, timingSafeEqual } from "node:crypto";
import type { Context, Hono } from "hono";
import type { Db } from "../db/db.ts";
import { log } from "../log.ts";
import { type BotApi, createBotApi } from "./api.ts";
import { type Bot, type BotConfig, type BotPorts, createBot, type Update } from "./bot.ts";
import { telegramStore } from "./store.ts";

export type { Bot, BotPorts, YesResult } from "./bot.ts";

export type TelegramDeps = BotPorts & {
  db: Db;
  /** Who is calling a phone route: `Authorization: Bearer {memberId}.{writeToken}`, checked by BE. */
  member(authorization: string | undefined): Promise<{ memberId: string; groupId: string } | null>;
  /** The `Me` body telegram-bind answers with (openapi.yaml). */
  me(gatheringId: string, memberId: string): Promise<unknown>;
  token: string;
  webhookSecret: string;
  /** Bot API root; tests pass the fake's address. Default https://api.telegram.org. */
  apiBaseUrl?: string;
  api?: BotApi;
} & BotConfig;

const MAX_PHOTO = 1_500_000;
const PHOTO_WINDOW_MS = 10 * 60_000;

/** Constant-time compare of the webhook secret header (telegram.md 1). */
export function secretOk(header: string | undefined, secret: string): boolean {
  if (!header || !secret) return false;
  const a = createHash("sha256").update(header).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}

/** Parses TELEGRAM_ALLOWED_CHAT_IDS ("-100123, -100456") into a set. */
export const parseChatIds = (v: string | undefined): Set<number> =>
  new Set(
    (v ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => /^-?\d+$/.test(s))
      .map(Number),
  );

/** Bot settings from env, or null when the bot is not configured (BE then skips mountTelegram). */
export function telegramEnv(
  env: NodeJS.ProcessEnv = process.env,
): Pick<TelegramDeps, "token" | "webhookSecret" | "botUsername" | "allowedChatIds"> | null {
  const token = env.TELEGRAM_BOT_TOKEN ?? "";
  const webhookSecret = env.TELEGRAM_WEBHOOK_SECRET ?? "";
  const botUsername = env.TELEGRAM_BOT_USERNAME ?? "";
  if (!/^\d+:[\w-]{30,}$/.test(token) || !/^[A-Za-z0-9_-]{16,256}$/.test(webhookSecret) || !botUsername) return null;
  return { token, webhookSecret, botUsername, allowedChatIds: parseChatIds(env.TELEGRAM_ALLOWED_CHAT_IDS) };
}

const err = (c: Context, status: 400 | 401 | 403 | 404 | 409 | 410 | 413 | 415 | 422, code: string, message: string) =>
  c.json({ code, message }, status);

export function mountTelegram(app: Hono, deps: TelegramDeps): Bot {
  const store = telegramStore(deps.db);
  const api = deps.api ?? createBotApi({ token: deps.token, baseUrl: deps.apiBaseUrl });
  const bot = createBot(api, store, deps, deps);

  app.post("/api/v1/telegram/webhook", async (c) => {
    if (!secretOk(c.req.header("x-telegram-bot-api-secret-token"), deps.webhookSecret)) {
      log.warn({ event: "tg.refused", reason: "secret" }, "webhook refused");
      return err(c, 401, "unauthorized", "Bad secret");
    }
    const u = (await c.req.json().catch(() => null)) as Update | null;
    if (u && Number.isInteger(u.update_id)) bot.enqueue(u);
    return c.body(null, 200);
  });

  /** Runs a phone write once per Idempotency-Key (openapi.yaml rules). */
  async function once(c: Context, memberId: string, run: () => Promise<{ status: number; body: unknown }>) {
    const k = c.req.header("idempotency-key");
    if (!k || k.length > 128) return err(c, 400, "bad_request", "Idempotency-Key required");
    const key = `${memberId}:${k}`;
    const hit = await store.idem(key);
    const out = hit ?? (await run());
    if (!hit && out.status < 500) await store.saveIdem(key, out.status, out.body);
    if (out.status === 204) return c.body(null, 204);
    return c.json(out.body as object, out.status as 200);
  }

  app.post("/api/v1/groups/:groupId/telegram-link", async (c) => {
    const who = await deps.member(c.req.header("authorization"));
    if (!who || who.groupId !== c.req.param("groupId")) return err(c, 401, "unauthorized", "Not a member");
    return once(c, who.memberId, async () => {
      const { token, expires_at } = await store.createLink(who.groupId);
      return {
        status: 201,
        body: { url: `https://t.me/${deps.botUsername}?startgroup=${token}`, expires_at: expires_at.toISOString() },
      };
    });
  });

  app.post("/api/v1/gatherings/:gatheringId/telegram-bind", async (c) => {
    const who = await deps.member(c.req.header("authorization"));
    if (!who) return err(c, 401, "unauthorized", "Not a member");
    const body = (await c.req.json().catch(() => null)) as { token?: unknown } | null;
    const token = body?.token;
    if (!body || Object.keys(body).length !== 1 || typeof token !== "string" || !/^[A-Za-z0-9_-]{22}$/.test(token))
      return err(c, 422, "bind_expired", "Token missing or malformed");
    const gid = c.req.param("gatheringId");
    return once(c, who.memberId, async () => {
      const r = await store.bind(token, gid, who.memberId);
      if (r === "expired") return { status: 410, body: { code: "bind_expired", message: "Link expired" } };
      if (r === "wrong_group") return { status: 422, body: { code: "unknown_member", message: "Other group" } };
      log.info({ event: "tg.bound" }, "telegram member bound");
      return { status: 200, body: await deps.me(gid, who.memberId) };
    });
  });

  app.put("/api/v1/gatherings/:gatheringId/telegram-photo", async (c) => {
    const who = await deps.member(c.req.header("authorization"));
    if (!who) return err(c, 403, "forbidden", "Not a member");
    if (c.req.header("content-type") !== "image/jpeg") return err(c, 415, "not_jpeg", "Send image/jpeg");
    const gid = c.req.param("gatheringId");
    const buf = Buffer.from(await c.req.arrayBuffer());
    try {
      if (buf.length === 0 || buf.length > MAX_PHOTO) return err(c, 413, "too_large", "1.5 MB at most");
      if (buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) return err(c, 415, "not_jpeg", "Not a JPEG");
      const row = await store.post(gid);
      if (!row || row.host_member_id !== who.memberId) return err(c, 403, "not_host", "Host only");
      if (!row.plain || row.chat_id === null) return err(c, 409, "wrong_state", "Not a Telegram group");
      if (Date.now() - new Date(row.created_at).getTime() > PHOTO_WINDOW_MS)
        return err(c, 409, "wrong_state", "Photo window closed");
      const posted = await bot.photo(gid, buf);
      if (!posted) return err(c, 409, "wrong_state", "Already posted");
      return c.body(null, 204);
    } finally {
      buf.fill(0); // never stored (ADR-0013)
    }
  });

  return bot;
}

/** When the bot is not configured: the same routes answer 503 not_configured (openapi.yaml). */
export function mountTelegramOff(app: Hono): void {
  const off = (c: Context) => c.json({ code: "not_configured", message: "Telegram is not set up" }, 503);
  app.post("/api/v1/telegram/webhook", off);
  app.post("/api/v1/groups/:groupId/telegram-link", off);
  app.post("/api/v1/gatherings/:gatheringId/telegram-bind", off);
  app.put("/api/v1/gatherings/:gatheringId/telegram-photo", off);
}
