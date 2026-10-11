// A small world for the bot tests: PGlite with the real migrations, one Telegram group,
// a host, and fake BE ports (yes, view, member, me) that follow the contract's shape.
import { randomUUID } from "node:crypto";
import { newCode } from "@flare/shared";
import { Hono } from "hono";
import { type Db, memoryDb, migrate } from "../../../src/db/db.ts";
import { type Bot, mountTelegram, type YesResult } from "../../../src/telegram/index.ts";
import { type FakeBotApi, startFakeBotApi } from "./bot-api.ts";

export const CHAT = -1001234567890;
export const OTHER_CHAT = -1009999999999;
export const SECRET = "test_webhook_secret_0123456789";
export const BOT = "FairlaneFlareBot";

export type World = Awaited<ReturnType<typeof makeWorld>>;

// One PGlite per test file (start-up is the slow part); each world empties it first.
let shared: Promise<Db> | null = null;
const sharedDb = () => {
  shared ??= memoryDb().then(async (db) => {
    await migrate(db);
    return db;
  });
  return shared;
};

export type WorldOpts = {
  editEveryMs?: number;
  photoWaitMs?: number;
  /** Runs after a counted yes, like BE running the engine's effects after commit. */
  afterYes?: (gatheringId: string) => Promise<void>;
};

export async function makeWorld(opts: WorldOpts = {}) {
  const db: Db = await sharedDb();
  await db.query("delete from groups");
  await db.query("delete from idempotency");
  const tg: FakeBotApi = await startFakeBotApi();
  const groupId = randomUUID();
  const hostId = randomUUID();
  await db.query("insert into groups (id) values ($1)", [groupId]);
  await db.query("insert into members (id, group_id, name_ct, write_token_hash) values ($1, $2, '\\x01', '\\x02')", [
    hostId,
    groupId,
  ]);
  const yesCalls: { gid: string; memberId: string }[] = [];
  let quorum = 3;

  const app = new Hono();
  const bot: Bot = mountTelegram(app, {
    db,
    token: "123456:fake-token-for-tests-only-xxxxxxxxxx",
    apiBaseUrl: tg.baseUrl,
    webhookSecret: SECRET,
    botUsername: BOT,
    allowedChatIds: new Set([CHAT]),
    photoWaitMs: opts.photoWaitMs ?? 50,
    editEveryMs: opts.editEveryMs ?? 3000,
    deleteAfterMs: 20,
    deleteRetryMs: [20, 20, 20],
    async yes(gid, memberId): Promise<YesResult> {
      yesCalls.push({ gid, memberId });
      const s = await db.query<{ state: string }>("select state from gatherings where id = $1", [gid]);
      if (!["kindling", "ember"].includes(s.rows[0]?.state ?? "")) return "closed";
      const r = await db.query(
        `insert into responses (id, gathering_id, member_id, status, expires_at)
         values ($1, $2, $3, 'yes', now() + interval '1 day') on conflict do nothing returning id`,
        [randomUUID(), gid, memberId],
      );
      if (!r.rows.length) return "already";
      await opts.afterYes?.(gid);
      return "counted";
    },
    async view(gid) {
      const r = await db.query<{ n: number }>(
        "select count(*)::int as n from responses where gathering_id = $1 and status = 'yes'",
        [gid],
      );
      return { need: Math.max(0, quorum - 1 - (r.rows[0]?.n ?? 0)), until: "2026-10-11T18:44:00.000Z" };
    },
    async member(auth) {
      const id = /^Bearer ([0-9a-f-]{36})\.ok$/.exec(auth ?? "")?.[1];
      if (!id) return null;
      const r = await db.query<{ group_id: string }>("select group_id from members where id = $1", [id]);
      return r.rows[0] ? { memberId: id, groupId: r.rows[0].group_id } : null;
    },
    async me(gid, memberId) {
      const r = await db.query<{ status: string }>(
        "select status from responses where gathering_id = $1 and member_id = $2",
        [gid, memberId],
      );
      return { member_id: memberId, status: r.rows[0]?.status ?? null };
    },
  });

  let updateId = 1;
  const post = (update: Record<string, unknown>, secret = SECRET) =>
    app.request("/api/v1/telegram/webhook", {
      method: "POST",
      headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": secret },
      body: JSON.stringify({ update_id: updateId++, ...update }),
    });

  return {
    db,
    tg,
    app,
    bot,
    groupId,
    hostId,
    yesCalls,
    setQuorum: (q: number) => {
      quorum = q;
    },
    auth: (memberId: string) => ({ authorization: `Bearer ${memberId}.ok` }),
    /** Sends one update through the webhook and waits for the bot to finish. */
    async update(u: Record<string, unknown>, secret = SECRET) {
      const res = await post(u, secret);
      await bot.idle();
      return res;
    },
    post,
    async linkChat() {
      await db.query("update groups set telegram_chat_id = $2, channel = 'telegram' where id = $1", [groupId, CHAT]);
    },
    async gathering(
      over: { kind?: "flare" | "plan"; plain?: Record<string, unknown> | null; state?: string } = {},
    ): Promise<string> {
      const id = randomUUID();
      const plain =
        over.plain === null
          ? null
          : {
              host: "Sam",
              invite: "Bench by the pond, sun out",
              place: "Fairlane pond bench",
              link: `https://flare.test/g/${id}#k=secretkey`,
              ember_places: { c1: "Maple bench" },
              step_names: { "step:1": "Ford Woods loop", "step:2": "Pond lap" },
              ...over.plain,
            };
      await db.query(
        `insert into gatherings (id, group_id, kind, state, short_code, host_member_id, quorum, tz, sealed,
           notice_ct, telegram_plain, plan_steps, start_at, expires_at)
         values ($1, $2, $3, $4, $5, $6, 3, 'America/Detroit', '\\x03', '\\x06', $7::jsonb, $8::jsonb, $9,
           now() + interval '5 hours')`,
        [
          id,
          groupId,
          over.kind ?? "flare",
          over.state ?? "kindling",
          newCode(),
          hostId,
          plain ? JSON.stringify(plain) : null,
          over.kind === "plan"
            ? JSON.stringify([
                { step: 1, minutes: 90, place: "step:1" },
                { step: 2, minutes: 45, place: "step:2" },
              ])
            : null,
          over.kind === "plan" ? "2026-10-11T19:00:00.000Z" : null,
        ],
      );
      return id;
    },
    async setState(gid: string, state: string, extra = "") {
      await db.query(`update gatherings set state = $2 ${extra} where id = $1`, [gid, state]);
    },
    async close() {
      bot.close();
      await bot.idle();
      await tg.close();
    },
  };
}

export const tap = (userId: number, data: string, chat = CHAT) => ({
  callback_query: {
    id: `cb${userId}${data.length}`,
    from: { id: userId },
    data,
    message: { message_id: 1, chat: { id: chat, type: "supergroup" } },
  },
});
export const groupMsg = (text: string, chat = CHAT, from = 501) => ({
  message: { message_id: 7, chat: { id: chat, type: "supergroup" }, from: { id: from }, text },
});
export const dmMsg = (userId: number, text?: string) => ({
  message: { message_id: 8, chat: { id: userId, type: "private" }, from: { id: userId }, ...(text ? { text } : {}) },
});
