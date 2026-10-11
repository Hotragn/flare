// Done for the integrations brief: one Flare sent, answered and finished through Telegram,
// an iMessage link and plain text, on the real schema, against the fake Bot API.
// A tiny fake engine stands in for BE + CE: it lights at quorum with no rules (ICD-1 fake).
import { encodePlain, parseReply, plainTime } from "@flare/shared";
import { afterAll, describe, expect, it } from "vitest";
import { mountPreview } from "../../src/preview/index.ts";
import { telegramStore } from "../../src/telegram/store.ts";
import { BOT, CHAT, groupMsg, makeWorld, tap, type World } from "./fakes/world.ts";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
let w: World;
afterAll(async () => w?.close(), 60_000);

describe("full flow: Telegram + iMessage link + plain text", () => {
  it("creates, answers through all three channels, lights, ends and deletes", async () => {
    let gid = "";
    // Fake engine: quorum 3 = host + 2 yeses (Telegram taps or text yeses).
    const engineStep = async () => {
      const r = await w.db.query<{ n: number; t: number }>(
        `select (select count(*)::int from responses where gathering_id = $1 and status = 'yes') as n,
                (select text_yes from gatherings where id = $1) as t`,
        [gid],
      );
      const yes = (r.rows[0]?.n ?? 0) + (r.rows[0]?.t ?? 0);
      if (yes >= 2) {
        await w.db.query(
          `update gatherings set state = 'lit', lit_at = now(),
             chosen_set = array_append((select array_agg(member_id) from responses where gathering_id = $1), host_member_id)
           where id = $1`,
          [gid],
        );
        w.bot.effect(gid, "lit");
      } else w.bot.effect(gid, "edit_count");
    };
    w = await makeWorld({ editEveryMs: 0, afterYes: engineStep });
    const store = telegramStore(w.db);

    // The iMessage link page (Hono builds its router on the first request, so mount first).
    const need = async () => {
      const r = await w.db.query<{ n: number; t: number }>(
        `select (select count(*)::int from responses where gathering_id = $1) as n,
                (select text_yes from gatherings where id = $1) as t`,
        [gid],
      );
      return 2 - (r.rows[0]?.n ?? 0) - (r.rows[0]?.t ?? 0);
    };
    mountPreview(w.app, {
      publicBaseUrl: "https://flare.test",
      need: async (id) => (id === gid ? need() : null),
    });

    // 1. Host adds the bot: telegram-link, then /start {token} in the allow-listed chat.
    const link = await w.app.request(`/api/v1/groups/${w.groupId}/telegram-link`, {
      method: "POST",
      headers: { ...w.auth(w.hostId), "idempotency-key": "flow-link" },
    });
    const token = new URL(((await link.json()) as { url: string }).url).searchParams.get("startgroup");
    await w.update(groupMsg(`/start@${BOT} ${token}`));
    expect(await store.groupChat(w.groupId)).toBe(CHAT);

    // 2. Host creates a Flare (BE inserts the row): the branded card goes out at once (ADR-0023).
    gid = await w.gathering();
    w.bot.created(gid);
    await w.bot.idle();
    expect(w.tg.of("sendPhoto")[0]?.photoType).toBe("image/png");
    expect(String(w.tg.of("sendPhoto")[0]?.params.caption)).toContain("Need 2 more.");

    // 4. A Telegram friend taps I'm in: the post edits to Need 1 more.
    w.tg.startedUsers.add(4242);
    await w.update(tap(4242, `y:${gid}`));
    await wait(10);
    await w.bot.idle();
    const edit = w.tg.of("editMessageMedia").at(-1);
    expect(String((edit?.params.media as { caption?: string } | undefined)?.caption)).toContain("Need 1 more.");
    expect(edit?.photoType).toBe("image/png"); // the card is redrawn with the count
    const preview = await (
      await w.app.request(`/g/${gid}`, { headers: { "user-agent": "facebookexternalhit/1.1 Facebot Twitterbot/1.0" } })
    ).text();
    expect(preview).toContain('content="Need 1 more. Open it to say yes in private."');
    expect(preview).not.toContain("Bench by the pond");

    // 5. Plain text: the host copies the SMS line; a friend replies "in {code}"; the host taps it in.
    const row = await w.db.query<{ short_code: string }>("select short_code from gatherings where id = $1", [gid]);
    const code = row.rows[0]?.short_code as string;
    const sms = encodePlain({
      code,
      spot: "Fairlane pond bench",
      need: await need(),
      ends: plainTime("2026-10-11T18:44:00.000Z", "America/Detroit"),
    });
    expect(sms).toBe(`FLARE ${code} Fairlane pond bench. Need 1 more. Reply IN ${code}. Ends 2:44PM`);
    expect(parseReply(` in ${code.toLowerCase()} `)).toBe(code);
    await w.db.query("update gatherings set text_yes = text_yes + 1 where id = $1 and short_code = $2", [gid, code]);
    await engineStep();
    await w.bot.idle();

    // 6. Lit: post edited, chat notified, the Telegram friend gets a private Find them.
    expect((w.tg.of("editMessageMedia").at(-1)?.params.media as { caption?: string }).caption).toBe(
      "It's lit. Sam is at Fairlane pond bench.",
    );
    const lit = w.tg.of("sendMessage").filter((s) => s.params.text === "It's lit. Sam is at Fairlane pond bench.");
    expect(lit.map((s) => s.params.chat_id)).toEqual([CHAT, 4242]);

    // 7. Done after arrival: final line, then every bot message deleted; the sweeper takes the row.
    await w.setState(gid, "gone", ", ended = 'thanks_for_coming'");
    w.bot.effect(gid, "final");
    await w.bot.idle();
    expect((w.tg.of("editMessageMedia").at(-1)?.params.media as { caption?: string }).caption).toBe(
      "Thanks for coming.",
    );
    await w.db.query("delete from gatherings where id = $1", [gid]);
    await wait(60);
    await w.bot.idle();
    const deleted = w.tg.of("deleteMessages").flatMap((d) => d.params.message_ids as number[]);
    // Post + lit notice in the group; yes DM + lit DM in private.
    expect(deleted).toHaveLength(4);
    for (const t of ["bot_messages", "telegram_binds", "responses"])
      expect((await w.db.query(`select 1 from ${t}`)).rows).toHaveLength(0);
  }, 60_000);
});
