// T-TG-1: the bot against a fake Bot API (contracts/telegram.md). No real Telegram calls.
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { log } from "../../src/log.ts";
import { telegramStore } from "../../src/telegram/store.ts";
import { BOT, CHAT, dmMsg, groupMsg, makeWorld, OTHER_CHAT, tap, type World } from "./fakes/world.ts";

let w: World;
beforeEach(async () => {
  w = await makeWorld();
}, 60_000);
afterEach(async () => {
  vi.restoreAllMocks();
  await w.close();
}, 60_000);

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
type Button = { text: string; callback_data?: string; url?: string };
const keyboard = (params: Record<string, unknown> | undefined): Button[][] =>
  (params?.reply_markup as { inline_keyboard?: Button[][] } | undefined)?.inline_keyboard ?? [];
/** The caption of an editMessageMedia call (the branded card's edits, ADR-0023). */
const cap = (p?: Record<string, unknown>) => String((p?.media as { caption?: string } | undefined)?.caption ?? "");
const lastText = (method = "sendMessage") => {
  const c = w.tg.of(method).at(-1)?.params;
  return String(c?.text ?? c?.caption ?? "");
};

describe("webhook (telegram.md 1)", () => {
  it("SRS-CH-1: wrong or missing secret gets 401 and no Telegram call", async () => {
    expect((await w.update(groupMsg("/help"), "wrong")).status).toBe(401);
    expect((await w.update(groupMsg("/help"), "")).status).toBe(401);
    expect(w.tg.calls).toHaveLength(0);
  });
  it("answers 200 before the Telegram work runs", async () => {
    const res = await w.post(groupMsg("/help"));
    expect(res.status).toBe(200);
    expect(w.tg.calls).toHaveLength(0);
    await w.bot.idle();
    expect(w.tg.of("sendMessage")).toHaveLength(1);
  });
  it("processes each update id once (idempotency tg:{update_id})", async () => {
    const body = JSON.stringify({ update_id: 777, ...groupMsg("/help") });
    const headers = {
      "content-type": "application/json",
      "x-telegram-bot-api-secret-token": "test_webhook_secret_0123456789",
    };
    await w.app.request("/api/v1/telegram/webhook", { method: "POST", headers, body });
    await w.app.request("/api/v1/telegram/webhook", { method: "POST", headers, body });
    await w.bot.idle();
    expect(w.tg.of("sendMessage")).toHaveLength(1);
  });
  it("a body without update_id is accepted and ignored", async () => {
    const res = await w.app.request("/api/v1/telegram/webhook", {
      method: "POST",
      headers: { "x-telegram-bot-api-secret-token": "test_webhook_secret_0123456789" },
      body: "not json",
    });
    expect(res.status).toBe(200);
    await w.bot.idle();
    expect(w.tg.calls).toHaveLength(0);
  });
});

describe("allow-list (SRS-CH-1, BR-CH-1)", () => {
  it("SRS-CH-1: leaves a chat that is not allow-listed, tells who added it, logs no content", async () => {
    const spy = vi.spyOn(log, "info");
    w.tg.startedUsers.add(501);
    await w.update({
      my_chat_member: {
        chat: { id: OTHER_CHAT, type: "supergroup", title: "Secret club" },
        from: { id: 501 },
        new_chat_member: { status: "member" },
      },
    });
    expect(w.tg.of("leaveChat")[0]?.params).toEqual({ chat_id: OTHER_CHAT });
    expect(lastText()).toBe("Flare is test-group only for now. I left that group.");
    const logged = JSON.stringify(spy.mock.calls);
    expect(logged).toContain("tg.refused");
    expect(logged).not.toContain("Secret club");
    expect(logged).not.toContain(String(OTHER_CHAT));
  });
  it("SRS-CH-1: a message or tap from an unlisted chat makes the bot leave it", async () => {
    await w.update(groupMsg("/start abcdefghijklmnopqrstuv", OTHER_CHAT));
    await w.update(tap(9, "y:11111111-1111-4111-8111-111111111111", OTHER_CHAT));
    expect(w.tg.of("leaveChat")).toHaveLength(2);
  });
  it("does not leave an allow-listed chat", async () => {
    await w.update({
      my_chat_member: {
        chat: { id: CHAT, type: "supergroup" },
        from: { id: 1 },
        new_chat_member: { status: "member" },
      },
    });
    expect(w.tg.of("leaveChat")).toHaveLength(0);
  });
});

describe("linking a chat (telegram.md 2)", () => {
  it("telegram-link returns a one-time startgroup link; /start {token} links the chat once", async () => {
    const res = await w.app.request(`/api/v1/groups/${w.groupId}/telegram-link`, {
      method: "POST",
      headers: { ...w.auth(w.hostId), "idempotency-key": "k1" },
    });
    expect(res.status).toBe(201);
    const { url, expires_at } = (await res.json()) as { url: string; expires_at: string };
    const token = new URL(url).searchParams.get("startgroup") as string;
    expect(url.startsWith(`https://t.me/${BOT}?startgroup=`)).toBe(true);
    expect(token).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(new Date(expires_at).getTime() - Date.now()).toBeGreaterThan(14 * 60_000);
    // Only the hash is stored (ADR-0018).
    const rows = await w.db.query<{ h: Buffer }>("select token_hash as h from telegram_links");
    expect(Buffer.from(rows.rows[0]?.h as Buffer).equals(createHash("sha256").update(token).digest())).toBe(true);

    await w.update(groupMsg(`/start@${BOT} ${token}`));
    const g = await w.db.query<{ channel: string; c: string }>(
      "select channel, telegram_chat_id::text as c from groups where id = $1",
      [w.groupId],
    );
    expect(g.rows[0]).toEqual({ channel: "telegram", c: String(CHAT) });
    expect(lastText()).toBe("Hi, this is Flare.\nI post Flares in your group and keep yeses private.");
    // Single use.
    await w.update(groupMsg(`/start ${token}`));
    expect(w.tg.of("sendMessage")).toHaveLength(1);
  });
  it("same Idempotency-Key returns the same link", async () => {
    const req = () =>
      w.app.request(`/api/v1/groups/${w.groupId}/telegram-link`, {
        method: "POST",
        headers: { ...w.auth(w.hostId), "idempotency-key": "same" },
      });
    const a = await (await req()).json();
    const b = await (await req()).json();
    expect(a).toEqual(b);
  });
  it("telegram-link refuses a caller from another group or no auth (401)", async () => {
    const res = await w.app.request("/api/v1/groups/00000000-0000-4000-8000-000000000000/telegram-link", {
      method: "POST",
      headers: { ...w.auth(w.hostId), "idempotency-key": "k" },
    });
    expect(res.status).toBe(401);
    const res2 = await w.app.request(`/api/v1/groups/${w.groupId}/telegram-link`, { method: "POST" });
    expect(res2.status).toBe(401);
  });
  it("an expired token links nothing", async () => {
    const { token } = await telegramStore(w.db).createLink(w.groupId);
    await w.db.query("update telegram_links set expires_at = now() - interval '1 second'");
    await w.update(groupMsg(`/start ${token}`));
    expect(await telegramStore(w.db).groupChat(w.groupId)).toBeNull();
  });
});

describe("Show photos in this Telegram group (ADR-0023)", () => {
  const url = () => `/api/v1/groups/${w.groupId}/telegram-settings`;
  it("is off by default; a member turns it on and off", async () => {
    const get = await w.app.request(url(), { headers: w.auth(w.hostId) });
    expect(await get.json()).toEqual({ show_photos: false });
    const put = (body: unknown) =>
      w.app.request(url(), {
        method: "PUT",
        headers: { ...w.auth(w.hostId), "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    expect(await (await put({ show_photos: true })).json()).toEqual({ show_photos: true });
    expect(await telegramStore(w.db).settings(w.groupId)).toEqual({ show_photos: true });
    await put({ show_photos: false });
    expect(await telegramStore(w.db).settings(w.groupId)).toEqual({ show_photos: false });
    expect((await put({ show_photos: "yes" })).status).toBe(400);
    expect((await put({ show_photos: true, extra: 1 })).status).toBe(400);
  });
  it("refuses non-members (401)", async () => {
    expect((await w.app.request(url())).status).toBe(401);
  });
});

describe("posting (telegram.md 3, SRS-CH-2)", () => {
  beforeEach(() => w.linkChat());

  it("SRS-CH-2: photo post with caption, count, time and three buttons; callback data under 64 bytes", async () => {
    await telegramStore(w.db).setPhotos(w.groupId, true); // the group opted in (ADR-0023)
    const gid = await w.gathering();
    w.bot.created(gid);
    const jpeg = Buffer.alloc(4000, 7);
    jpeg.set([0xff, 0xd8, 0xff], 0);
    const res = await w.app.request(`/api/v1/gatherings/${gid}/telegram-photo`, {
      method: "PUT",
      headers: { ...w.auth(w.hostId), "content-type": "image/jpeg", "idempotency-key": "p" },
      body: new Uint8Array(jpeg),
    });
    expect(res.status).toBe(204);
    await w.bot.idle();
    const call = w.tg.of("sendPhoto")[0];
    expect(call?.photoBytes).toBe(4000);
    expect(call?.photoType).toBe("image/jpeg");
    expect(call?.params.caption).toBe(
      "Bench by the pond, sun out\nSam · Fairlane pond bench\nNeed 2 more. Nobody sees who.\nOpen until 2:44 PM.",
    );
    const kb = keyboard(call?.params);
    expect(kb.map((r) => r[0]?.text)).toEqual(["I'm in", "Add a condition", "Open in Flare"]);
    expect(Buffer.byteLength(kb[0]?.[0]?.callback_data ?? "")).toBe(38);
    expect(kb[2]?.[0]?.url).toBe(`https://flare.test/g/${gid}?via=tg#k=secretkey`);
    // The photo buffer is not stored anywhere; no text post follows after the wait.
    await wait(80);
    await w.bot.idle();
    expect(w.tg.of("sendMessage")).toHaveLength(0);
    expect((await w.db.query("select * from photos")).rows).toHaveLength(0);
  });
  it("ADR-0023 default: the branded card goes out at once, same caption and buttons, no wait", async () => {
    const gid = await w.gathering();
    w.bot.created(gid);
    await w.bot.idle();
    const call = w.tg.of("sendPhoto")[0];
    expect(call?.photoType).toBe("image/png");
    expect(call?.photoBytes).toBeGreaterThan(10_000);
    expect(String(call?.params.caption)).toContain("Need 2 more. Nobody sees who.");
    expect(keyboard(call?.params).map((r) => r[0]?.text)).toEqual(["I'm in", "Add a condition", "Open in Flare"]);
    expect(w.tg.of("sendMessage")).toHaveLength(0);
    expect((await telegramStore(w.db).messages(gid)).length).toBe(1);
  });
  it("ADR-0023: photos are off by default; the host's photo is refused and never uploaded", async () => {
    expect(await telegramStore(w.db).settings(w.groupId)).toEqual({ show_photos: false });
    const gid = await w.gathering();
    const jpeg = Buffer.alloc(4000, 7);
    jpeg.set([0xff, 0xd8, 0xff], 0);
    const res = await w.app.request(`/api/v1/gatherings/${gid}/telegram-photo`, {
      method: "PUT",
      headers: { ...w.auth(w.hostId), "content-type": "image/jpeg" },
      body: new Uint8Array(jpeg),
    });
    expect(res.status).toBe(409);
    expect(((await res.json()) as { message: string }).message).toBe("Photos are off for this group");
    await w.bot.idle();
    expect(w.tg.calls.some((c) => c.photoBytes === 4000)).toBe(false);
  });
  it("photos on but no photo arrives: the card goes out after the wait", async () => {
    await telegramStore(w.db).setPhotos(w.groupId, true);
    const gid = await w.gathering();
    w.bot.created(gid);
    await w.bot.idle();
    expect(w.tg.of("sendPhoto")).toHaveLength(0);
    await wait(80);
    await w.bot.idle();
    expect(w.tg.of("sendPhoto")[0]?.photoType).toBe("image/png");
  });
  it("photo after the text post went out: 409, and only the host may send it (403)", async () => {
    const gid = await w.gathering();
    w.bot.created(gid);
    await wait(80);
    await w.bot.idle();
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2]);
    const put = (who: string) =>
      w.app.request(`/api/v1/gatherings/${gid}/telegram-photo`, {
        method: "PUT",
        headers: { ...w.auth(who), "content-type": "image/jpeg" },
        body: new Uint8Array(jpeg),
      });
    expect((await put(w.hostId)).status).toBe(409);
    const other = await telegramStore(w.db).ensureMember(w.groupId, 42);
    expect((await put(other)).status).toBe(403);
  });
  it("rejects non-JPEG (415) and oversize (413) photos", async () => {
    const gid = await w.gathering();
    const put = (body: Buffer, type = "image/jpeg") =>
      w.app.request(`/api/v1/gatherings/${gid}/telegram-photo`, {
        method: "PUT",
        headers: { ...w.auth(w.hostId), "content-type": type },
        body: new Uint8Array(body),
      });
    expect((await put(Buffer.from("png"), "image/png")).status).toBe(415);
    expect((await put(Buffer.from("not a jpeg"))).status).toBe(415);
    const big = Buffer.alloc(1_500_001, 1);
    big.set([0xff, 0xd8, 0xff], 0);
    expect((await put(big)).status).toBe(413);
  });
  it("Plan posts list the steps with minutes", async () => {
    const gid = await w.gathering({ kind: "plan" });
    w.bot.created(gid);
    await wait(80);
    await w.bot.idle();
    expect(lastText("sendPhoto")).toContain("1. Ford Woods loop, 90 min\n2. Pond lap, 45 min");
  });
  it("resume() posts gatherings that never got their post (restart)", async () => {
    await w.gathering();
    expect(await w.bot.resume()).toBe(1);
    expect(w.tg.of("sendPhoto")).toHaveLength(1);
    expect(await w.bot.resume()).toBe(0);
  });
});

describe("taps (telegram.md 4, SRS-CH-3)", () => {
  let gid: string;
  beforeEach(async () => {
    await w.linkChat();
    gid = await w.gathering();
    await w.bot.resume();
    w.tg.reset();
  });

  it("SRS-CH-3: y: from a new user makes a Telegram member, records a yes, answers privately", async () => {
    w.tg.startedUsers.add(601);
    await w.update(tap(601, `y:${gid}`));
    const m = await w.db.query<{ via: string; name_ct: unknown }>(
      "select via, name_ct from members where telegram_user_id = 601",
    );
    expect(m.rows).toEqual([{ via: "telegram", name_ct: null }]);
    expect(w.yesCalls).toHaveLength(1);
    expect(w.tg.of("answerCallbackQuery")[0]?.params).toMatchObject({
      text: "You're in. Only you see this.",
      cache_time: 0,
    });
    expect(lastText()).toBe("You're in for Sam's Flare.\nI'll message you when it's lit. Nobody sees who said yes.");
  });
  it("y: from a user who never started the bot answers bot.cb.yesNoChat", async () => {
    await w.update(tap(602, `y:${gid}`));
    expect(w.tg.of("answerCallbackQuery")[0]?.params.text).toBe("You're in. Start a chat with me for the lit message.");
  });
  it("y: again answers bot.cb.already and records nothing new", async () => {
    await w.update(tap(603, `y:${gid}`));
    await w.update(tap(603, `y:${gid}`));
    expect(w.tg.of("answerCallbackQuery")[1]?.params.text).toBe("You're already in.");
    const n = await w.db.query("select * from responses");
    expect(n.rows).toHaveLength(1);
  });
  it("y: on a Lit or Gone gathering, or one from another chat's post, answers closed", async () => {
    await w.setState(gid, "lit");
    await w.update(tap(604, `y:${gid}`));
    expect(w.tg.of("answerCallbackQuery")[0]?.params.text).toBe("This Flare is closed.");
    await w.update(tap(604, "y:not-a-uuid"));
    expect(w.tg.of("answerCallbackQuery")[1]?.params.text).toBeUndefined();
    expect(w.yesCalls).toHaveLength(0);
  });
  it("c: opens the private chat through a bind token (10 min); /start b_{token} sends the condition link", async () => {
    await w.update(tap(605, `c:${gid}`));
    const url = String(w.tg.of("answerCallbackQuery")[0]?.params.url);
    expect(url).toMatch(new RegExp(`^https://t.me/${BOT}\\?start=b_[A-Za-z0-9_-]{22}$`));
    const payload = new URL(url).searchParams.get("start") as string;
    expect(payload.length).toBeLessThanOrEqual(64);
    w.tg.startedUsers.add(605);
    await w.update(dmMsg(605, `/start ${payload}`));
    const send = w.tg.of("sendMessage").at(-1)?.params;
    expect(send?.text).toBe("I don't read messages. Add conditions on the Flare page.");
    const btn = keyboard(send)[0]?.[0];
    expect(btn?.text).toBe("Add a condition");
    expect(btn?.url).toBe(`https://flare.test/g/${gid}?via=tg&bind=${payload.slice(2)}#k=secretkey`);
  });
  it("ADR-0013: free text in private is dropped unread: not stored, not logged, link sent back", async () => {
    const spy = vi.spyOn(log, "info");
    const warn = vi.spyOn(log, "warn");
    await w.update(tap(606, `y:${gid}`));
    w.tg.startedUsers.add(606);
    await w.update(dmMsg(606, "only if Alex comes, back by 6"));
    expect(lastText()).toBe("I don't read messages. Add conditions on the Flare page.");
    const everything = JSON.stringify([
      spy.mock.calls,
      warn.mock.calls,
      (await w.db.query("select * from idempotency")).rows,
      (await w.db.query("select * from responses")).rows,
    ]);
    expect(everything).not.toContain("Alex");
  });
  it("free text with nothing open answers bot.dm.nothingOpen", async () => {
    w.tg.startedUsers.add(607);
    await w.update(dmMsg(607, "hello?"));
    expect(lastText()).toBe("No Flare is open. They show up in your group.");
    await w.update(dmMsg(607));
    expect(lastText()).toBe("No Flare is open. They show up in your group.");
  });
  it("/start and /help in private", async () => {
    w.tg.startedUsers.add(608);
    await w.update(dmMsg(608, "/start"));
    expect(lastText()).toBe(
      "Hi, this is Flare.\nI post Flares in your group and keep yeses private.\nNothing to do now. I'll message you when one's lit.",
    );
    await w.update(dmMsg(608, "/help"));
    expect(lastText()).toBe("Tap I'm in on a Flare. Only the count is shown.");
  });
  it("a command for another bot in the group is ignored", async () => {
    await w.update(groupMsg("/help@OtherBot"));
    expect(w.tg.calls).toHaveLength(0);
  });
});

describe("telegram-bind (BR-ID-5)", () => {
  it("moves the Telegram yes onto the phone's member so it counts once", async () => {
    await w.linkChat();
    const gid = await w.gathering();
    await w.update(tap(700, `y:${gid}`));
    await w.update(tap(700, `c:${gid}`));
    const token = String(
      new URL(String(w.tg.of("answerCallbackQuery").at(-1)?.params.url)).searchParams.get("start"),
    ).slice(2);
    const phone = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    await w.db.query(
      "insert into members (id, group_id, name_ct, write_token_hash) values ($1, $2, '\\x01', '\\x02')",
      [phone, w.groupId],
    );
    const bind = () =>
      w.app.request(`/api/v1/gatherings/${gid}/telegram-bind`, {
        method: "POST",
        headers: { ...w.auth(phone), "content-type": "application/json", "idempotency-key": "b1" },
        body: JSON.stringify({ token }),
      });
    const res = await bind();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ member_id: phone, status: "yes" });
    const yeses = await w.db.query<{ member_id: string }>("select member_id from responses where gathering_id = $1", [
      gid,
    ]);
    expect(yeses.rows).toEqual([{ member_id: phone }]);
    const tgRow = await w.db.query<{ id: string }>("select id from members where telegram_user_id = 700");
    expect(tgRow.rows).toEqual([{ id: phone }]);
    // A repeat with the same key returns the same answer.
    expect((await bind()).status).toBe(200);
    // The token is gone with the old member: a new key gets 410.
    const again = await w.app.request(`/api/v1/gatherings/${gid}/telegram-bind`, {
      method: "POST",
      headers: { ...w.auth(phone), "content-type": "application/json", "idempotency-key": "b2" },
      body: JSON.stringify({ token }),
    });
    expect(again.status).toBe(410);
  });
  it("malformed body is 422; no auth is 401", async () => {
    const gid = "11111111-1111-4111-8111-111111111111";
    const r1 = await w.app.request(`/api/v1/gatherings/${gid}/telegram-bind`, {
      method: "POST",
      headers: { ...w.auth(w.hostId), "idempotency-key": "x" },
      body: JSON.stringify({ token: "short" }),
    });
    expect(r1.status).toBe(422);
    const r2 = await w.app.request(`/api/v1/gatherings/${gid}/telegram-bind`, { method: "POST", body: "{}" });
    expect(r2.status).toBe(401);
  });
});

describe("updates to the post (telegram.md 5)", () => {
  let gid: string;
  beforeEach(async () => {
    await w.linkChat();
    gid = await w.gathering();
    await w.bot.resume();
    w.tg.reset();
  });

  it("coalesces count edits to one per 3 s per message", async () => {
    await w.close();
    w = await makeWorld({ editEveryMs: 500 });
    await w.linkChat();
    gid = await w.gathering();
    await w.bot.resume();
    for (let i = 0; i < 10; i++) w.bot.effect(gid, "edit_count");
    await wait(30);
    expect(w.tg.of("editMessageMedia")).toHaveLength(0);
    await wait(600);
    await w.bot.idle();
    expect(w.tg.of("editMessageMedia")).toHaveLength(1);
  });
  it("edits the count with the same keyboard; 'message is not modified' is ignored", async () => {
    await w.close();
    w = await makeWorld({ editEveryMs: 0 });
    await w.linkChat();
    gid = await w.gathering();
    await w.bot.resume();
    await w.update(tap(801, `y:${gid}`));
    w.bot.effect(gid, "edit_count");
    await wait(20);
    await w.bot.idle();
    const e = w.tg.of("editMessageMedia").at(-1)?.params;
    expect(cap(e)).toContain("Need 1 more. Nobody sees who.");
    expect(keyboard(e)).toHaveLength(3);
    w.tg.fail("editMessageMedia", 400, "Bad Request: message is not modified");
    const warn = vi.spyOn(log, "warn");
    w.bot.effect(gid, "edit_count");
    await wait(20);
    await w.bot.idle();
    expect(JSON.stringify(warn.mock.calls)).not.toContain("tg.error");
  });
  it("SRS-LIT-1: Lit edits the post, drops the answer buttons, notifies the chat, DMs the chosen set", async () => {
    await w.update(tap(802, `y:${gid}`));
    const m = await w.db.query<{ id: string }>("select id from members where telegram_user_id = 802");
    await w.setState(gid, "lit", `, chosen_set = array['${w.hostId}', '${m.rows[0]?.id}']::uuid[]`);
    w.tg.startedUsers.add(802);
    w.tg.reset();
    w.bot.effect(gid, "lit");
    await w.bot.idle();
    const edit = w.tg.of("editMessageMedia")[0]?.params;
    expect(cap(edit)).toBe("It's lit. Sam is at Fairlane pond bench.");
    const rows = keyboard(edit);
    expect(rows.map((r) => r[0]?.text)).toEqual(["Open in Flare"]);
    const sends = w.tg.of("sendMessage");
    expect(sends.map((s) => s.params.chat_id)).toEqual([CHAT, 802]);
    expect(sends[1]?.params.text).toBe("It's lit. Sam is at Fairlane pond bench.");
    const find = keyboard(sends[1]?.params)[0]?.[0];
    expect(find?.text).toBe("Find them");
  });
  it("BR-E-5: Ember shows the bench and Need 1 more, then notifies", async () => {
    await w.setState(gid, "ember", ", ember_choice = 'c1'");
    w.bot.effect(gid, "ember");
    await w.bot.idle();
    expect(cap(w.tg.of("editMessageMedia")[0]?.params)).toBe(
      "Bench by the pond, sun out\nSam · Maple bench\nNeed 1 more.\nOpen until 2:44 PM.",
    );
    expect(lastText()).toBe("Smaller plan: 15 min at Maple bench.");
  });
  it("Plan smaller: edits to Smaller plan: {step}", async () => {
    const pid = await w.gathering({ kind: "plan" });
    await w.bot.resume();
    await w.db.query("update gatherings set current_step = 2 where id = $1", [pid]);
    w.bot.effect(pid, "smaller");
    await w.bot.idle();
    expect(cap(w.tg.of("editMessageMedia").at(-1)?.params)).toContain("Smaller plan: Pond lap.");
  });
  it("Plan lit: It's on: {step} at {time}", async () => {
    const pid = await w.gathering({ kind: "plan" });
    await w.bot.resume();
    await w.db.query("update gatherings set state = 'lit', current_step = 1 where id = $1", [pid]);
    w.bot.effect(pid, "lit");
    await w.bot.idle();
    expect(lastText()).toBe("It's on: Ford Woods loop at 3:00 PM.");
  });
});

describe("cleanup at Gone (telegram.md 6, BR-D-3, SRS-CH-4)", () => {
  let gid: string;
  beforeEach(async () => {
    await w.linkChat();
    gid = await w.gathering();
    await w.bot.resume();
    w.tg.startedUsers.add(901);
    await w.update(tap(901, `y:${gid}`));
    w.tg.reset();
  });

  it("SRS-CH-4: edits to the final line, then deletes every message in one call per chat", async () => {
    await w.setState(gid, "gone", ", ended = 'not_this_time'");
    w.bot.effect(gid, "final");
    await w.bot.idle();
    expect(cap(w.tg.of("editMessageMedia")[0]?.params)).toBe("Not this time.");
    expect(await telegramStore(w.db).messages(gid)).toHaveLength(0);
    await wait(60);
    await w.bot.idle();
    const del = w.tg.of("deleteMessages");
    expect(del.map((d) => d.params.chat_id).sort()).toEqual([CHAT, 901].sort());
    for (const d of del) expect((d.params.message_ids as number[]).length).toBeGreaterThan(0);
  });
  it("Thanks for coming after Lit", async () => {
    await w.setState(gid, "gone", ", ended = 'thanks_for_coming'");
    w.bot.effect(gid, "final");
    await w.bot.idle();
    expect(cap(w.tg.of("editMessageMedia")[0]?.params)).toBe("Thanks for coming.");
  });
  it("deletes even after the sweeper removed the gathering row", async () => {
    await w.setState(gid, "gone", ", ended = 'not_this_time'");
    w.bot.effect(gid, "final");
    await w.bot.idle();
    await w.db.query("delete from gatherings where id = $1", [gid]);
    await wait(60);
    await w.bot.idle();
    expect(w.tg.of("deleteMessages").length).toBe(2);
  });
  it("a failed delete is retried 3 times, then logged with a count and no ids", async () => {
    const warn = vi.spyOn(log, "warn");
    w.tg.fail("deleteMessages", 500, "Internal", 20);
    await w.setState(gid, "gone", ", ended = 'not_this_time'");
    w.bot.effect(gid, "final");
    await w.bot.idle();
    for (let i = 0; i < 10; i++) {
      await wait(40);
      await w.bot.idle();
    }
    // 2 chats x (1 try + 3 retries).
    expect(w.tg.of("deleteMessages")).toHaveLength(8);
    const failed = warn.mock.calls.find((c) => JSON.stringify(c).includes("tg.delete_failed"));
    expect(failed?.[0]).toEqual({ event: "tg.delete_failed", count: 2 });
  });
});

describe("privacy of the bot's logs (SRS-PRIV-4)", () => {
  it("never logs message text, names, chat ids or user ids across a full flow", async () => {
    const calls: unknown[] = [];
    for (const lvl of ["info", "warn", "error", "debug"] as const)
      vi.spyOn(log, lvl).mockImplementation(((...a: unknown[]) => calls.push(a)) as never);
    await w.linkChat();
    const gid = await w.gathering();
    await w.bot.resume();
    w.tg.startedUsers.add(1001);
    await w.update(tap(1001, `y:${gid}`));
    await w.update(dmMsg(1001, "my secret words"));
    await w.setState(gid, "gone", ", ended = 'not_this_time'");
    w.bot.effect(gid, "final");
    await w.bot.idle();
    const s = JSON.stringify(calls);
    for (const bad of ["secret words", "Sam", "pond", "1001", String(CHAT), gid]) expect(s).not.toContain(bad);
  });
});
