// The Telegram bot (contracts/telegram.md, ADR-0013, SRS-CH-1 to -4). Two halves:
// - updates in: /start linking, taps, private chats, membership changes;
// - posts out: the group post, coalesced count edits, Lit, Ember, Smaller, final and cleanup.
// Logs carry fixed event names and counts only: never text, names, chat ids or user ids.
import { log } from "../log.ts";
import { type BotApi, BotApiError, type Keyboard, type SentMessage } from "./api.ts";
import { t } from "./copy.ts";
import { emberLine, linkKeyboard, litLine, type PostView, renderPost, withQuery } from "./render.ts";
import type { PostRow, TelegramStore } from "./store.ts";

export type YesResult = "counted" | "already" | "closed";

/** What the bot needs from the rest of the server (BE implements these at integration). */
export type BotPorts = {
  /** Records a yes with no rules for this member and runs the engine and its effects. */
  yes(gatheringId: string, memberId: string): Promise<YesResult>;
  /** The engine's view: need now and when the post's "Open until" ends. Null when gone. */
  view(gatheringId: string): Promise<PostView | null>;
};

export type BotConfig = {
  botUsername: string;
  allowedChatIds: ReadonlySet<number>;
  /** Wait for the host's photo before posting text only (telegram.md 3). */
  photoWaitMs?: number;
  /** Count edits per post at most once per this many ms (telegram.md 5). */
  editEveryMs?: number;
  /** Time the final line stays up before deleteMessages (inside BR-D-1's 5 minutes). */
  deleteAfterMs?: number;
  /** Waits between delete retries; 3 retries over about 2 minutes (telegram.md 6). */
  deleteRetryMs?: number[];
};

type Chat = { id: number; type: string };
type User = { id: number };
type Message = { message_id: number; chat: Chat; from?: User; text?: string };
type CallbackQuery = { id: string; from: User; data?: string; message?: Message };
type ChatMemberUpdated = { chat: Chat; from: User; new_chat_member: { status: string } };
export type Update = {
  update_id: number;
  message?: Message;
  callback_query?: CallbackQuery;
  my_chat_member?: ChatMemberUpdated;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[A-Za-z0-9_-]{16,43}$/;

export function createBot(api: BotApi, store: TelegramStore, ports: BotPorts, config: BotConfig) {
  const photoWaitMs = config.photoWaitMs ?? 15_000;
  const editEveryMs = config.editEveryMs ?? 3000;
  const deleteAfterMs = config.deleteAfterMs ?? 20_000;
  const deleteRetryMs = config.deleteRetryMs ?? [10_000, 40_000, 70_000];

  const timers = new Set<NodeJS.Timeout>();
  const later = (ms: number, fn: () => void) => {
    const h = setTimeout(() => {
      timers.delete(h);
      fn();
    }, ms);
    timers.add(h);
    return h;
  };

  // One promise chain per gathering keeps its post edits in order; `pending` lets tests wait.
  const chains = new Map<string, Promise<void>>();
  const pending = new Set<Promise<void>>();
  const track = (p: Promise<void>) => {
    pending.add(p);
    p.finally(() => pending.delete(p));
    return p;
  };
  const serial = (key: string, fn: () => Promise<void>): Promise<void> => {
    const next = (chains.get(key) ?? Promise.resolve()).then(fn).catch((e) => failed(e));
    chains.set(key, next);
    next.finally(() => chains.get(key) === next && chains.delete(key));
    return track(next);
  };
  const failed = (e: unknown) => {
    const code = e instanceof BotApiError ? e.code : undefined;
    log.warn({ event: "tg.error", code }, "telegram step failed");
  };

  const photoKind = new Map<string, "photo" | "text">();
  const photoTimers = new Map<string, NodeJS.Timeout>();
  const lastEdit = new Map<string, number>();
  const editTimers = new Map<string, NodeJS.Timeout>();
  const smaller = new Set<string>();

  async function withRateRetry<T>(fn: () => Promise<T>): Promise<T> {
    for (let i = 0; ; i++) {
      try {
        return await fn();
      } catch (e) {
        if (!(e instanceof BotApiError) || e.code !== 429 || i >= 2) throw e;
        await new Promise((r) => setTimeout(r, Math.min(10, e.retryAfter ?? 1) * 1000));
      }
    }
  }

  const send = (chatId: number, text: string, keyboard?: Keyboard | null) =>
    withRateRetry(() =>
      api.call<SentMessage>("sendMessage", {
        chat_id: chatId,
        text,
        ...(keyboard ? { reply_markup: keyboard } : {}),
        link_preview_options: { is_disabled: true },
      }),
    );

  /** Sends a private message; false when the user never started the bot (403). */
  async function dm(userId: number, text: string, keyboard?: Keyboard | null): Promise<SentMessage | null> {
    try {
      return await send(userId, text, keyboard);
    } catch (e) {
      if (e instanceof BotApiError && e.cannotMessageUser) return null;
      throw e;
    }
  }

  const allowed = (chatId: number) => config.allowedChatIds.has(chatId);
  const isGroup = (c: Chat) => c.type === "group" || c.type === "supergroup";

  async function refuse(chat: Chat, addedBy?: User) {
    log.info({ event: "tg.refused", reason: "not_allow_listed" }, "refused chat: not allow-listed");
    await api.call("leaveChat", { chat_id: chat.id }).catch(failed);
    if (addedBy) await dm(addedBy.id, t("bot.refuse.dm")).catch(failed);
  }

  // ---------- updates in ----------

  async function handle(u: Update): Promise<void> {
    if (!(await store.claimUpdate(u.update_id))) return; // seen before: Telegram retried
    if (u.my_chat_member) return onMembership(u.my_chat_member);
    if (u.callback_query) return onTap(u.callback_query);
    if (u.message) return onMessage(u.message);
  }

  async function onMembership(m: ChatMemberUpdated) {
    if (!isGroup(m.chat)) return;
    const joined = ["member", "administrator", "restricted"].includes(m.new_chat_member.status);
    if (joined && !allowed(m.chat.id)) await refuse(m.chat, m.from);
  }

  /** "/start@Bot payload" or "/start payload" to [command, payload]. Other text: null. */
  function command(text: string | undefined): [string, string] | null {
    const m = /^\/(\w+)(?:@(\w+))?(?:\s+(\S+))?\s*$/.exec(text ?? "");
    if (!m) return null;
    if (m[2] && m[2].toLowerCase() !== config.botUsername.toLowerCase()) return null;
    return [m[1]?.toLowerCase() ?? "", m[3] ?? ""];
  }

  async function onMessage(msg: Message) {
    if (isGroup(msg.chat)) {
      if (!allowed(msg.chat.id)) return refuse(msg.chat, msg.from);
      const cmd = command(msg.text);
      if (!cmd) return; // privacy mode: the bot only sees commands; anything else is ignored
      if (cmd[0] === "help") {
        await send(msg.chat.id, t("bot.help"));
        return;
      }
      if (cmd[0] === "start" && TOKEN.test(cmd[1])) {
        const groupId = await store.consumeLink(cmd[1]);
        if (!groupId) return;
        await store.linkChat(groupId, msg.chat.id);
        log.info({ event: "tg.linked" }, "chat linked");
        await send(msg.chat.id, `${t("bot.start.hello")}\n${t("bot.start.what")}`);
      }
      return;
    }
    if (msg.chat.type !== "private" || !msg.from) return;
    const cmd = command(msg.text);
    if (cmd?.[0] === "help") {
      await send(msg.chat.id, t("bot.help"));
      return;
    }
    if (cmd?.[0] === "start" && cmd[1].startsWith("b_")) {
      const token = cmd[1].slice(2);
      const bind = TOKEN.test(token) ? await store.findBind(token) : null;
      const row = bind ? await store.post(bind.gathering_id) : null;
      if (!bind || !row?.plain) {
        await send(msg.chat.id, t("bot.dm.nothingOpen"));
        return;
      }
      await sendConditionLink(msg.chat.id, row, token);
      return;
    }
    if (cmd?.[0] === "start") {
      await send(msg.chat.id, `${t("bot.start.hello")}\n${t("bot.start.what")}\n${t("bot.start.next")}`);
      return;
    }
    // Any other private message: dropped unread. Not parsed, stored or logged (ADR-0013).
    const open = await store.openFor(msg.from.id);
    const row = open ? await store.post(open.gathering_id) : null;
    if (!open || !row?.plain) {
      await send(msg.chat.id, t("bot.dm.nothingOpen"));
      return;
    }
    const token = await store.createBind(open.gathering_id, open.member_id);
    await sendConditionLink(msg.chat.id, row, token);
  }

  async function sendConditionLink(chatId: number, row: PostRow, token: string) {
    const url = withQuery((row.plain as { link: string }).link, { via: "tg", bind: token });
    const sent = await send(chatId, t("bot.dm.link"), linkKeyboard(t("invite.condition"), url));
    await store.addMessage(row.id, chatId, sent.message_id);
  }

  async function answer(id: string, extra: Record<string, unknown>) {
    await api.call("answerCallbackQuery", { callback_query_id: id, cache_time: 0, ...extra });
  }

  async function onTap(q: CallbackQuery) {
    const m = /^([yc]):(.+)$/.exec(q.data ?? "");
    const chat = q.message?.chat;
    if (!m || !chat || !UUID.test(m[2] ?? "")) return answer(q.id, {});
    if (!allowed(chat.id)) {
      await answer(q.id, {});
      return refuse(chat);
    }
    const gid = m[2] as string;
    const row = await store.post(gid);
    const open = row && row.chat_id === chat.id && (row.state === "kindling" || row.state === "ember");
    if (!row || !open) return answer(q.id, { text: t("bot.cb.closed") });
    const memberId = await store.ensureMember(row.group_id, q.from.id);
    if (m[1] === "c") {
      const token = await store.createBind(gid, memberId);
      return answer(q.id, { url: `https://t.me/${config.botUsername}?start=b_${token}` });
    }
    const r = await ports.yes(gid, memberId);
    if (r === "already") return answer(q.id, { text: t("bot.cb.already") });
    if (r === "closed") return answer(q.id, { text: t("bot.cb.closed") });
    const plain = row.plain;
    const sent = plain ? await dm(q.from.id, `${t("bot.dm.yes", { host: plain.host })}\n${t("bot.dm.yes2")}`) : null;
    if (sent) await store.addMessage(gid, q.from.id, sent.message_id);
    log.info({ event: "tg.yes" }, "telegram yes");
    return answer(q.id, { text: sent ? t("bot.cb.yes") : t("bot.cb.yesNoChat") });
  }

  // ---------- posts out ----------

  async function postNow(gid: string, photo: Buffer | null): Promise<boolean> {
    const row = await store.post(gid);
    if (!row?.plain || row.chat_id === null || row.state !== "kindling") return false;
    if ((await store.messages(gid)).length > 0) return false; // posted already
    const { text, keyboard } = renderPost(row, await ports.view(gid));
    const sent = photo
      ? await withRateRetry(() => api.sendPhoto(row.chat_id as number, photo, text, keyboard ?? undefined))
      : await send(row.chat_id, text, keyboard);
    photoKind.set(gid, photo ? "photo" : "text");
    await store.addMessage(gid, row.chat_id, sent.message_id);
    lastEdit.set(gid, Date.now());
    log.info({ event: "tg.posted", with_photo: Boolean(photo) }, "telegram post");
    return true;
  }

  async function edit(gid: string, chatId: number, messageId: number, text: string, keyboard: Keyboard | null) {
    const markup = keyboard ?? { inline_keyboard: [] };
    const base = { chat_id: chatId, message_id: messageId, reply_markup: markup };
    const caption = () => api.call("editMessageCaption", { ...base, caption: text });
    const plain = () => api.call("editMessageText", { ...base, text, link_preview_options: { is_disabled: true } });
    const kind = photoKind.get(gid);
    try {
      await withRateRetry(kind === "text" ? plain : caption);
    } catch (e) {
      if (e instanceof BotApiError && e.notModified) return;
      // After a restart the kind is unknown: a text post refuses caption edits with a 400.
      if (kind === undefined && e instanceof BotApiError && e.code === 400) {
        photoKind.set(gid, "text");
        await withRateRetry(plain).catch((e2) => {
          if (!(e2 instanceof BotApiError && e2.notModified)) throw e2;
        });
        return;
      }
      throw e;
    }
    if (kind === undefined) photoKind.set(gid, "photo");
  }

  /** Re-renders the group post from the current row. */
  async function refresh(gid: string): Promise<PostRow | null> {
    const row = await store.post(gid);
    if (!row?.plain || row.chat_id === null) return null;
    const post = (await store.messages(gid)).find((m) => m.chat_id === row.chat_id);
    if (!post) return row;
    const view = row.state === "gone" ? null : await ports.view(gid);
    const { text, keyboard } = renderPost(row, view, smaller.has(gid));
    await edit(gid, post.chat_id, post.message_id, text, keyboard);
    lastEdit.set(gid, Date.now());
    return row;
  }

  function scheduleCount(gid: string) {
    if (editTimers.has(gid)) return; // one edit already queued: it will read the newest count
    const wait = Math.max(0, (lastEdit.get(gid) ?? 0) + editEveryMs - Date.now());
    editTimers.set(
      gid,
      later(wait, () => {
        editTimers.delete(gid);
        serial(gid, async () => {
          await refresh(gid);
        });
      }),
    );
  }
  const cancelCount = (gid: string) => {
    const h = editTimers.get(gid);
    if (h) clearTimeout(h);
    timers.delete(h as NodeJS.Timeout);
    editTimers.delete(gid);
  };

  async function onLit(gid: string) {
    const row = await refresh(gid);
    if (!row?.plain || row.chat_id === null) return;
    const line = litLine(row);
    const sent = await send(row.chat_id, line);
    await store.addMessage(gid, row.chat_id, sent.message_id);
    const find = linkKeyboard(t("lit.find"), withQuery(row.plain.link, { via: "tg" }));
    for (const user of await store.chosenTelegramUsers(gid)) {
      const m = await dm(user, line, find).catch((e) => {
        failed(e);
        return null;
      });
      if (m) await store.addMessage(gid, user, m.message_id);
    }
  }

  async function onEmber(gid: string) {
    const row = await refresh(gid);
    if (!row?.plain || row.chat_id === null) return;
    const sent = await send(row.chat_id, emberLine(row));
    await store.addMessage(gid, row.chat_id, sent.message_id);
  }

  async function onFinal(gid: string) {
    await refresh(gid);
    // Hold the ids in memory: the sweeper may delete the rows (and the gathering) first.
    const ids = await store.messages(gid);
    await store.dropMessages(gid);
    later(deleteAfterMs, () => void track(cleanup(gid, ids, 0)));
  }

  async function cleanup(gid: string, ids: { chat_id: number; message_id: number }[], attempt: number) {
    const byChat = new Map<number, number[]>();
    for (const m of ids) byChat.set(m.chat_id, [...(byChat.get(m.chat_id) ?? []), m.message_id]);
    const left: typeof ids = [];
    for (const [chat, messageIds] of byChat) {
      for (let i = 0; i < messageIds.length; i += 100) {
        const batch = messageIds.slice(i, i + 100);
        try {
          await api.call("deleteMessages", { chat_id: chat, message_ids: batch });
        } catch {
          for (const message_id of batch) left.push({ chat_id: chat, message_id });
        }
      }
    }
    photoKind.delete(gid);
    lastEdit.delete(gid);
    smaller.delete(gid);
    if (!left.length) {
      log.info({ event: "tg.deleted", count: ids.length }, "telegram messages deleted");
      return;
    }
    const wait = deleteRetryMs[attempt];
    if (wait === undefined) {
      log.warn({ event: "tg.delete_failed", count: left.length }, "telegram delete failed");
      return;
    }
    later(wait, () => void track(cleanup(gid, left, attempt + 1)));
  }

  return {
    /** Webhook entry: work runs after the HTTP response (telegram.md 1). */
    enqueue(u: Update): void {
      const chat = u.message?.chat.id ?? u.callback_query?.message?.chat.id ?? u.my_chat_member?.chat.id ?? 0;
      void serial(`chat:${chat}`, () => handle(u));
    },
    handle,

    /** Call after createGathering commits for a Telegram group: posts text if no photo comes. */
    created(gid: string): void {
      photoTimers.set(
        gid,
        later(photoWaitMs, () => {
          photoTimers.delete(gid);
          void serial(gid, async () => {
            await postNow(gid, null);
          });
        }),
      );
    },

    /** The host's photo (telegram-photo). False when the post already went out. */
    photo(gid: string, jpeg: Buffer): Promise<boolean> {
      const h = photoTimers.get(gid);
      if (h) {
        clearTimeout(h);
        timers.delete(h);
        photoTimers.delete(gid);
      }
      let posted = false;
      return serial(gid, async () => {
        posted = await postNow(gid, jpeg);
      }).then(() => posted);
    },

    /** Engine effect `{type: "telegram", action}`, run after commit by BE. */
    effect(gid: string, action: "edit_count" | "lit" | "ember" | "smaller" | "final"): void {
      if (action === "edit_count") {
        scheduleCount(gid);
        return;
      }
      cancelCount(gid);
      if (action === "smaller") smaller.add(gid);
      if (action === "lit" || action === "ember") smaller.delete(gid);
      const run = { lit: onLit, ember: onEmber, final: onFinal, smaller: refresh }[action];
      void serial(gid, async () => {
        await run(gid);
      });
    },

    /** After a restart: post any Telegram gathering that never got its post. */
    async resume(): Promise<number> {
      const ids = await store.unposted();
      for (const gid of ids)
        await serial(gid, async () => {
          await postNow(gid, null);
        });
      return ids.length;
    },

    /** Resolves when no Telegram work is queued (tests and shutdown). */
    async idle(): Promise<void> {
      while (pending.size) await Promise.allSettled([...pending]);
    },
    close(): void {
      for (const h of timers) clearTimeout(h);
      timers.clear();
    },
  };
}
export type Bot = ReturnType<typeof createBot>;
