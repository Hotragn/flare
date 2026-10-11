// SQL for the bot's tables (migration 0001: telegram_links, telegram_binds, bot_messages,
// members.telegram_user_id, groups.telegram_chat_id, idempotency). Tokens are stored as
// SHA-256 hashes only (ADR-0018). Each write is one statement, so it is atomic on a pool.
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Db } from "../db/db.ts";

export const LINK_TTL_S = 15 * 60; // startgroup token (telegram.md 2)
export const BIND_TTL_S = 10 * 60; // personal bind token (telegram.md 4)
const UPDATE_TTL_S = 24 * 3600;

/** 128 random bits, base64url (22 characters): fits the 64-character deep-link payload. */
export const newToken = (): string => randomBytes(16).toString("base64url");
export const hashToken = (token: string): Buffer => createHash("sha256").update(token).digest();

export type TelegramPlain = {
  host: string;
  invite: string;
  place: string;
  link: string;
  ember_places?: Record<string, string>;
  step_names?: Record<string, string>;
};

export type PostRow = {
  id: string;
  group_id: string;
  kind: "flare" | "plan";
  state: "kindling" | "lit" | "ember" | "gone";
  tz: string;
  ended: "not_this_time" | "thanks_for_coming" | null;
  ember_choice: string | null;
  current_step: number | null;
  plan_steps: { step: number; minutes: number; place: string }[] | null;
  start_at: Date | null;
  created_at: Date;
  expires_at: Date;
  host_member_id: string;
  plain: TelegramPlain | null;
  chat_id: number | null;
  /** groups.telegram_photos: the group allows the real photo in its Telegram post. */
  photos_on: boolean;
};

export type BotMessage = { chat_id: number; message_id: number };

const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

export function telegramStore(db: Db) {
  return {
    /** True the first time an update id is seen (idempotency key `tg:{update_id}`). */
    async claimUpdate(updateId: number): Promise<boolean> {
      const r = await db.query(
        `insert into idempotency (key, response, expires_at)
         values ($1, '{}'::jsonb, now() + make_interval(secs => $2))
         on conflict (key) do nothing returning key`,
        [`tg:${updateId}`, UPDATE_TTL_S],
      );
      return r.rows.length === 1;
    },

    async createLink(groupId: string): Promise<{ token: string; expires_at: Date }> {
      const token = newToken();
      const r = await db.query<{ expires_at: Date }>(
        `insert into telegram_links (token_hash, group_id, expires_at)
         values ($1, $2, now() + make_interval(secs => $3)) returning expires_at`,
        [hashToken(token), groupId, LINK_TTL_S],
      );
      return { token, expires_at: new Date(r.rows[0]?.expires_at as Date) };
    },

    /** Single use: the row is deleted as it is read. Null when unknown or expired. */
    async consumeLink(token: string): Promise<string | null> {
      const r = await db.query<{ group_id: string }>(
        "delete from telegram_links where token_hash = $1 and expires_at > now() returning group_id",
        [hashToken(token)],
      );
      return r.rows[0]?.group_id ?? null;
    },

    /** Links a chat to a group; a chat belongs to one group, so an older link is cleared. */
    async linkChat(groupId: string, chatId: number): Promise<void> {
      await db.query(
        `with cleared as (
           update groups set telegram_chat_id = null, channel = 'link'
           where telegram_chat_id = $2 and id <> $1 returning id)
         update groups set telegram_chat_id = $2, channel = 'telegram'
         where id = $1 and (select count(*) from cleared) >= 0`,
        [groupId, chatId],
      );
    },

    async groupChat(groupId: string): Promise<number | null> {
      const r = await db.query<{ telegram_chat_id: unknown }>("select telegram_chat_id from groups where id = $1", [
        groupId,
      ]);
      return num(r.rows[0]?.telegram_chat_id);
    },

    async post(gatheringId: string): Promise<PostRow | null> {
      const r = await db.query<PostRow & { chat_id: unknown; plain: unknown }>(
        `select g.id, g.group_id, g.kind, g.state, g.tz, g.ended, g.ember_choice, g.current_step,
                g.plan_steps, g.start_at, g.created_at, g.expires_at, g.host_member_id,
                g.telegram_plain as plain, gr.telegram_chat_id as chat_id, gr.telegram_photos as photos_on
         from gatherings g join groups gr on gr.id = g.group_id where g.id = $1`,
        [gatheringId],
      );
      const row = r.rows[0];
      if (!row) return null;
      const plain = typeof row.plain === "string" ? (JSON.parse(row.plain) as TelegramPlain) : row.plain;
      return {
        ...row,
        plain: (plain as TelegramPlain | null) ?? null,
        chat_id: num(row.chat_id),
        photos_on: row.photos_on === true,
      };
    },

    /** The group's Telegram settings (null when the group does not exist). */
    async settings(groupId: string): Promise<{ show_photos: boolean } | null> {
      const r = await db.query<{ p: boolean }>("select telegram_photos as p from groups where id = $1", [groupId]);
      const row = r.rows[0];
      return row ? { show_photos: row.p === true } : null;
    },
    async setPhotos(groupId: string, on: boolean): Promise<void> {
      await db.query("update groups set telegram_photos = $2 where id = $1", [groupId, on]);
    },

    /** The member the bot uses for a Telegram user in a group; made on first tap. */
    async ensureMember(groupId: string, telegramUserId: number): Promise<string> {
      const r = await db.query<{ id: string }>(
        `with ins as (
           insert into members (id, group_id, via, telegram_user_id) values ($1, $2, 'telegram', $3)
           on conflict (group_id, telegram_user_id) do nothing returning id)
         select id from ins union all
         select id from members where group_id = $2 and telegram_user_id = $3 limit 1`,
        [randomUUID(), groupId, telegramUserId],
      );
      const id = r.rows[0]?.id;
      if (!id) throw new Error("member insert returned nothing");
      return id;
    },

    async createBind(gatheringId: string, memberId: string): Promise<string> {
      const token = newToken();
      await db.query(
        `insert into telegram_binds (token_hash, gathering_id, member_id, expires_at)
         values ($1, $2, $3, now() + make_interval(secs => $4))`,
        [hashToken(token), gatheringId, memberId, BIND_TTL_S],
      );
      return token;
    },

    /** Looks a bind token up without using it (the bot shows the link; the phone uses it). */
    async findBind(token: string): Promise<{ gathering_id: string; member_id: string } | null> {
      const r = await db.query<{ gathering_id: string; member_id: string }>(
        "select gathering_id, member_id from telegram_binds where token_hash = $1 and expires_at > now()",
        [hashToken(token)],
      );
      return r.rows[0] ?? null;
    },

    /**
     * The phone's telegram-bind (BR-ID-5): moves the Telegram member's answer onto the phone's
     * member so it counts once, swaps it in the chosen set, deletes the bot-made member, then
     * records the Telegram user on the phone's member. Returns the outcome.
     */
    async bind(
      token: string,
      gatheringId: string,
      phoneMemberId: string,
    ): Promise<"bound" | "expired" | "wrong_group"> {
      const r = await db.query<{ member_id: string; tg: unknown; same_group: boolean }>(
        `select b.member_id, m.telegram_user_id as tg,
                (select group_id from members where id = $3) = g.group_id as same_group
         from telegram_binds b join members m on m.id = b.member_id join gatherings g on g.id = b.gathering_id
         where b.token_hash = $1 and b.gathering_id = $2 and b.expires_at > now()`,
        [hashToken(token), gatheringId, phoneMemberId],
      );
      const row = r.rows[0];
      if (!row) return "expired";
      if (!row.same_group) return "wrong_group";
      const tgMember = row.member_id;
      if (tgMember === phoneMemberId) {
        await db.query("delete from telegram_binds where token_hash = $1", [hashToken(token)]);
        return "bound";
      }
      await db.query(
        `with moved as (
           insert into responses (id, gathering_id, member_id, status, ember_only, rules, spot_checks,
                                  faded, still_coming, arrived_at, created_at, expires_at)
           select gen_random_uuid(), gathering_id, $2, status, ember_only, rules, spot_checks,
                  faded, still_coming, arrived_at, created_at, expires_at
           from responses where member_id = $1
           on conflict (gathering_id, member_id) do nothing returning id),
         swapped as (
           update gatherings set chosen_set = array_replace(chosen_set, $1::uuid, $2::uuid)
           where $1::uuid = any(chosen_set) returning id)
         delete from members where id = $1 and (select count(*) from moved) + (select count(*) from swapped) >= 0`,
        [tgMember, phoneMemberId],
      );
      await db.query("update members set telegram_user_id = $2 where id = $1", [phoneMemberId, num(row.tg)]);
      return "bound";
    },

    async addMessage(gatheringId: string, chatId: number, messageId: number): Promise<void> {
      await db.query(
        `insert into bot_messages (gathering_id, chat_id, message_id, expires_at)
         select id, $2, $3, expires_at from gatherings where id = $1
         on conflict do nothing`,
        [gatheringId, chatId, messageId],
      );
    },

    async messages(gatheringId: string): Promise<BotMessage[]> {
      const r = await db.query<{ chat_id: unknown; message_id: unknown }>(
        "select chat_id, message_id from bot_messages where gathering_id = $1 order by message_id",
        [gatheringId],
      );
      return r.rows.map((m) => ({ chat_id: Number(m.chat_id), message_id: Number(m.message_id) }));
    },

    async dropMessages(gatheringId: string): Promise<void> {
      await db.query("delete from bot_messages where gathering_id = $1", [gatheringId]);
    },

    /** Telegram users in the chosen set (they get the Lit message in private). */
    async chosenTelegramUsers(gatheringId: string): Promise<number[]> {
      const r = await db.query<{ tg: unknown }>(
        `select m.telegram_user_id as tg from gatherings g join members m on m.id = any(g.chosen_set)
         where g.id = $1 and m.telegram_user_id is not null`,
        [gatheringId],
      );
      return r.rows.map((x) => Number(x.tg));
    },

    /** The newest open Telegram gathering in a group this user belongs to. */
    async openFor(telegramUserId: number): Promise<{ gathering_id: string; member_id: string } | null> {
      const r = await db.query<{ gathering_id: string; member_id: string }>(
        `select g.id as gathering_id, m.id as member_id from members m
         join gatherings g on g.group_id = m.group_id
         where m.telegram_user_id = $1 and g.state in ('kindling', 'ember') and g.telegram_plain is not null
         order by g.created_at desc limit 1`,
        [telegramUserId],
      );
      return r.rows[0] ?? null;
    },

    /** Telegram gatherings still waiting for their first post (after a restart). */
    async unposted(): Promise<string[]> {
      const r = await db.query<{ id: string }>(
        `select g.id from gatherings g join groups gr on gr.id = g.group_id
         where g.telegram_plain is not null and gr.telegram_chat_id is not null and g.state = 'kindling'
           and not exists (select 1 from bot_messages b where b.gathering_id = g.id)`,
      );
      return r.rows.map((x) => x.id);
    },

    /** Phone-route idempotency: key `{memberId}:{Idempotency-Key}`, 24 h. */
    async idem(key: string): Promise<{ status: number; body: unknown } | null> {
      const r = await db.query<{ response: unknown }>(
        "select response from idempotency where key = $1 and expires_at > now()",
        [key],
      );
      const v = r.rows[0]?.response;
      if (!v) return null;
      return (typeof v === "string" ? JSON.parse(v) : v) as { status: number; body: unknown };
    },
    async saveIdem(key: string, status: number, body: unknown): Promise<void> {
      await db.query(
        `insert into idempotency (key, response, expires_at) values ($1, $2::jsonb, now() + interval '24 hours')
         on conflict (key) do nothing`,
        [key, JSON.stringify({ status, body })],
      );
    },
  };
}
export type TelegramStore = ReturnType<typeof telegramStore>;
