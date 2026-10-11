// The server as main.ts builds it: real engine, Backend routes, and Integrations mounted through
// integrations(). One Telegram Flare from create to a Telegram yes, and the safe link preview.
import { randomUUID } from "node:crypto";
import { engine } from "@flare/engine";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildCtx, createApp } from "../../src/app.ts";
import { memoryDb, migrate } from "../../src/db/db.ts";
import { HubRelay } from "../../src/hub/relay.ts";
import { integrations } from "../../src/integrations.ts";
import { ct, idem, newMember, TestClock } from "../api-helpers.ts";
import { fakeJpeg } from "../helpers.ts";
import { type FakeBotApi, startFakeBotApi } from "./fakes/bot-api.ts";
import { BOT, CHAT, SECRET, tap } from "./fakes/world.ts";

let tg: FakeBotApi;
beforeAll(async () => {
  tg = await startFakeBotApi();
});
afterAll(async () => tg.close());

async function server(env: NodeJS.ProcessEnv) {
  const db = await memoryDb();
  await migrate(db);
  const ints = integrations(env);
  const deps = {
    relay: new HubRelay(200, { pingMs: 60_000 }),
    db,
    version: "t",
    engine,
    clock: new TestClock(),
    mounts: [ints.mount],
    config: { publicBaseUrl: "https://flare.test" },
  };
  const app = createApp(deps, buildCtx(deps));
  return { db, app, ints };
}

const until = async (f: () => boolean, ms = 3000) => {
  const end = Date.now() + ms;
  while (!f() && Date.now() < end) await new Promise((r) => setTimeout(r, 20));
  return f();
};

describe("wired server (lead integration)", () => {
  it("a Telegram Flare posts, a Telegram tap counts through the engine, the preview stays safe", async () => {
    const { db, app, ints } = await server({
      TELEGRAM_BOT_TOKEN: "123456:fake-token-for-tests-only-xxxxxxxxxx",
      TELEGRAM_WEBHOOK_SECRET: SECRET,
      TELEGRAM_BOT_USERNAME: BOT,
      TELEGRAM_ALLOWED_CHAT_IDS: String(CHAT),
      TELEGRAM_API_BASE_URL: tg.baseUrl,
    });
    const host = newMember();
    const groupId = randomUUID();
    const post = (path: string, body: unknown, auth = true) =>
      app.request(path, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": idem(),
          ...(auth ? { authorization: `Bearer ${host.id}.${host.token}` } : {}),
        },
        body: JSON.stringify(body),
      });
    expect(
      (
        await post(
          "/api/v1/groups",
          { id: groupId, member: { id: host.id, name_ct: host.name_ct, write_token: host.token } },
          false,
        )
      ).status,
    ).toBe(201);
    await db.query("update groups set channel = 'telegram', telegram_chat_id = $1 where id = $2", [CHAT, groupId]);
    const gid = randomUUID();
    const created = await post(`/api/v1/groups/${groupId}/gatherings`, {
      id: gid,
      kind: "flare",
      quorum: 2,
      tz: "America/Detroit",
      sealed: ct(64),
      notice_ct: ct(32),
      telegram: {
        host: "Fuego",
        invite: "Golden pond, come sit",
        place: "Ford Woods Park",
        link: `https://flare.test/g/${gid}/#k=abc`,
      },
    });
    expect(created.status).toBe(201);
    const photo = await app.request(`/api/v1/gatherings/${gid}/telegram-photo`, {
      method: "PUT",
      headers: {
        "content-type": "image/jpeg",
        "idempotency-key": idem(),
        authorization: `Bearer ${host.id}.${host.token}`,
      },
      body: fakeJpeg(),
    });
    expect([204, 409]).toContain(photo.status);
    expect(await until(() => tg.of("sendPhoto").length + tg.of("sendMessage").length > 0)).toBe(true);

    const before = (await (await app.request(`/api/v1/gatherings/${gid}`)).json()) as { need: number; state: string };
    expect(before.need).toBe(1);
    await app.request("/api/v1/telegram/webhook", {
      method: "POST",
      headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": SECRET },
      body: JSON.stringify({ update_id: 1, ...tap(4242, `y:${gid}`) }),
    });
    expect(await until(() => tg.of("answerCallbackQuery").length > 0)).toBe(true);
    const after = (await (await app.request(`/api/v1/gatherings/${gid}`)).json()) as { need: number; state: string };
    expect(after.state).toBe("lit"); // host + one Telegram yes = quorum 2
    expect(after.need).toBe(0);

    const preview = await app.request(`/g/${gid}`);
    const html = await preview.text();
    expect(html).toContain("og:title");
    expect(html).not.toContain("Golden pond");
    expect(html).not.toContain("Ford Woods");
    ints.close();
  });

  it("without a bot token the Telegram routes answer 503 and the API still works", async () => {
    const { app } = await server({});
    const r = await app.request(`/api/v1/groups/${randomUUID()}/telegram-link`, {
      method: "POST",
      headers: { "idempotency-key": idem() },
    });
    expect(r.status).toBe(503);
    expect((await app.request("/api/v1/health")).status).toBe(200);
  });
});
