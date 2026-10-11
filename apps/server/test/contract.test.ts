// Contract tests: every operation in openapi.yaml that BE owns, its success case and each
// error code it lists. Describe names are operationIds; the last test checks none is missing.
import { randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import YAML from "yaml";
import { ct, harness, idem, newMember, type TestMember } from "./api-helpers.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OPENAPI = path.resolve(HERE, "../../../docs/architecture/contracts/openapi.yaml");
const INT_OWNED = new Set(["createTelegramLink", "bindTelegram", "putTelegramPhoto", "telegramWebhook"]);

let h: Awaited<ReturnType<typeof harness>>;
beforeAll(async () => {
  h = await harness();
}, 60_000);
afterAll(async () => h.close());

const tok = () => randomBytes(16).toString("base64url");
const G = (id: string, rest = "") => `/api/v1/gatherings/${id}${rest}`;

async function litFlare() {
  const g = await h.group(3);
  const { id } = await h.flare(g.groupId, g.host, { quorum: 2 });
  await h.call("PUT", G(id, "/me"), { as: g.members[1], body: { answer: "yes" } });
  return { ...g, id };
}

describe("getHealth", () => {
  it("200", async () => {
    const r = await h.call("GET", "/api/v1/health");
    expect(r.body).toEqual({ ok: true, version: "test", hub: "absent", db: "ok" });
  });
});

describe("getConfig", () => {
  it("200 with limits", async () => {
    const r = await h.call("GET", "/api/v1/config");
    expect(r.body).toEqual({
      version: "test",
      vapid_public_key: null,
      telegram_bot_username: null,
      limits: { max_members: 12, max_photo_bytes: 1_500_000, flare_quorum: [2, 3, 4], plan_quorum: [2, 3, 4, 5, 6] },
    });
  });
});

describe("getDeletionAudit", () => {
  it("200 with every store", async () => {
    const r = await h.call("GET", "/api/v1/audit");
    expect(r.status).toBe(200);
    expect(r.body.stores.map((s: { table: string }) => s.table)).toEqual(
      expect.arrayContaining(["gatherings", "responses", "photos", "jobs", "bot_messages", "live_locations"]),
    );
  });
});

describe("createGroup", () => {
  it("201, 400 bad_request, 409 on a taken id, repeat with the same key returns the first response", async () => {
    const m = newMember();
    const id = randomUUID();
    const body = { id, member: { id: m.id, name_ct: m.name_ct, write_token: m.token } };
    const key = idem();
    const a = await h.call("POST", "/api/v1/groups", { body, key });
    expect(a.status).toBe(201);
    expect(a.body).toMatchObject({ id, channel: "link", live: [] });
    expect(a.body.members[0]).toMatchObject({ id: m.id, name_ct: m.name_ct, via: "link" });
    expect(a.body.members[0].write_token).toBeUndefined();
    const again = await h.call("POST", "/api/v1/groups", { body, key });
    expect(again.status).toBe(201);
    expect(again.body).toEqual(a.body);
    expect((await h.call("POST", "/api/v1/groups", { body })).status).toBe(409);
    expect((await h.call("POST", "/api/v1/groups", { body: { ...body, extra: 1 } })).body.code).toBe("bad_request");
    expect((await h.call("POST", "/api/v1/groups", { body, key: null })).body.code).toBe("bad_request");
    // Only the hash of the write token is stored (SRS-SEC-4).
    const row = (
      await h.db.query<{ write_token_hash: Uint8Array }>("select write_token_hash from members where id = $1", [m.id])
    ).rows[0];
    expect(Buffer.from(row?.write_token_hash ?? []).toString("base64url")).not.toBe(m.token);
  });
});

describe("getGroup", () => {
  it("200, 401, 404 for another group's member", async () => {
    const g = await h.group(2);
    const r = await h.call("GET", `/api/v1/groups/${g.groupId}`, { as: g.host });
    expect(r.body.members).toHaveLength(2);
    expect((await h.call("GET", `/api/v1/groups/${g.groupId}`)).status).toBe(401);
    const bad = { ...g.host, token: tok() };
    expect((await h.call("GET", `/api/v1/groups/${g.groupId}`, { as: bad })).status).toBe(401);
    const other = await h.group(1);
    expect((await h.call("GET", `/api/v1/groups/${g.groupId}`, { as: other.host })).status).toBe(404);
  });
});

describe("joinGroup", () => {
  it("201, 400, 404, 409 group_full at 12 (SRS-ID-5)", async () => {
    const g = await h.group(11);
    const m = newMember();
    const j = await h.call("POST", `/api/v1/groups/${g.groupId}/members`, {
      body: { id: m.id, name_ct: m.name_ct, write_token: m.token },
    });
    expect(j.status).toBe(201);
    const n = newMember();
    const full = await h.call("POST", `/api/v1/groups/${g.groupId}/members`, {
      body: { id: n.id, name_ct: n.name_ct, write_token: n.token },
    });
    expect(full.body.code).toBe("group_full");
    expect(
      (
        await h.call("POST", `/api/v1/groups/${randomUUID()}/members`, {
          body: { id: n.id, name_ct: n.name_ct, write_token: n.token },
        })
      ).status,
    ).toBe(404);
    expect((await h.call("POST", `/api/v1/groups/${g.groupId}/members`, { body: { id: "x" } })).status).toBe(400);
  });
});

describe("renameMember", () => {
  it("200, 401, 403 for someone else", async () => {
    const g = await h.group(2);
    const name = ct();
    const r = await h.call("PATCH", `/api/v1/groups/${g.groupId}/members/${g.host.id}`, {
      as: g.host,
      body: { name_ct: name },
    });
    expect(r.body.name_ct).toBe(name);
    expect(
      (await h.call("PATCH", `/api/v1/groups/${g.groupId}/members/${g.host.id}`, { body: { name_ct: name } })).status,
    ).toBe(401);
    expect(
      (
        await h.call("PATCH", `/api/v1/groups/${g.groupId}/members/${g.host.id}`, {
          as: g.members[1],
          body: { name_ct: name },
        })
      ).status,
    ).toBe(403);
  });
});

describe("forgetGroup", () => {
  it("200 removes the member and their answers; the last member takes the group (ADR-0015); 401, 403", async () => {
    const g = await litFlare();
    const b = g.members[1] as TestMember;
    expect((await h.call("DELETE", `/api/v1/groups/${g.groupId}/members/${b.id}`, { as: g.host })).status).toBe(403);
    expect((await h.call("DELETE", `/api/v1/groups/${g.groupId}/members/${b.id}`)).status).toBe(401);
    const r = await h.call("DELETE", `/api/v1/groups/${g.groupId}/members/${b.id}`, {
      as: b,
      body: { spark_delete_tokens: [tok()] },
    });
    expect(r.body).toEqual({ last_member: false, sparks_deleted: 0 });
    expect((await h.db.query("select 1 from responses where member_id = $1", [b.id])).rows).toHaveLength(0);
    await h.call("DELETE", `/api/v1/groups/${g.groupId}/members/${g.members[2]?.id}`, { as: g.members[2] });
    const last = await h.call("DELETE", `/api/v1/groups/${g.groupId}/members/${g.host.id}`, { as: g.host });
    expect(last.body.last_member).toBe(true);
    for (const t of ["groups", "members", "gatherings", "counters"])
      expect(
        (await h.db.query(`select 1 from ${t} where ${t === "groups" ? "id" : "group_id"} = $1`, [g.groupId])).rows,
      ).toHaveLength(0);
  });
});

describe("createGathering", () => {
  it("201 Flare and Plan, 400, 401, 409 taken id, 422 quorum_range and plan_times", async () => {
    const g = await h.group(2);
    const { id, r } = await h.flare(g.groupId, g.host);
    expect(r.status).toBe(201);
    const base = { id, kind: "flare", quorum: 2, tz: "America/Detroit", sealed: ct(), notice_ct: ct() };
    const url = `/api/v1/groups/${g.groupId}/gatherings`;
    expect((await h.call("POST", url, { as: g.host, body: base })).status).toBe(409);
    expect((await h.call("POST", url, { body: { ...base, id: randomUUID() } })).status).toBe(401);
    expect((await h.call("POST", url, { as: g.host, body: { ...base, id: randomUUID(), quorum: 5 } })).body.code).toBe(
      "quorum_range",
    );
    expect(
      (await h.call("POST", url, { as: g.host, body: { ...base, id: randomUUID(), sealed: "not base64!" } })).status,
    ).toBe(400);
    expect(
      (
        await h.call("POST", url, {
          as: g.host,
          body: {
            ...base,
            id: randomUUID(),
            telegram: { host: "a", invite: "b", place: "c", link: "https://x.test/g/1" },
          },
        })
      ).status,
    ).toBe(400);
    const plan = h.planBody();
    expect((await h.call("POST", url, { as: g.host, body: plan })).status).toBe(201);
    const late = h.planBody({
      plan: { ...h.planBody().plan, deadline_at: new Date(h.clock.t + 5 * 60_000).toISOString() },
    });
    expect((await h.call("POST", url, { as: g.host, body: late })).body.code).toBe("plan_times");
    const p2 = h.planBody();
    const steps = p2.plan.steps.map((s) => ({ ...s, minutes: 30 }));
    // BR-P-4 ladder errors are the engine's bad_request (docs/engine/02-api.md).
    expect((await h.call("POST", url, { as: g.host, body: { ...p2, plan: { ...p2.plan, steps } } })).body.code).toBe(
      "bad_request",
    );
  });
  it("429 after 30 writes a minute from one member (SRS-SEC-5)", async () => {
    const g = await h.group(1);
    let last = 0;
    let retry: string | null = null;
    for (let i = 0; i < 31; i++) {
      const r = await h.call("PATCH", `/api/v1/groups/${g.groupId}/members/${g.host.id}`, {
        as: g.host,
        body: { name_ct: ct() },
      });
      last = r.status;
      retry = r.headers.get("retry-after");
    }
    expect(last).toBe(429);
    expect(Number(retry)).toBeGreaterThan(0);
    h.clock.advance(61_000);
    expect(
      (
        await h.call("PATCH", `/api/v1/groups/${g.groupId}/members/${g.host.id}`, {
          as: g.host,
          body: { name_ct: ct() },
        })
      ).status,
    ).toBe(200);
  });
});

describe("getGathering", () => {
  it("200 with ETag and server_time, 404, 410 with ended", async () => {
    const g = await h.group(2);
    const { id } = await h.flare(g.groupId, g.host);
    const r = await h.call("GET", G(id));
    expect(r.headers.get("etag")).toBe('"1"');
    expect(r.body.server_time).toBe(h.clock.now().toISOString());
    expect((await h.call("GET", G(randomUUID()))).status).toBe(404);
    await h.call("POST", G(id, "/cancel"), { as: g.host });
    expect((await h.call("GET", G(id))).body).toMatchObject({ code: "gone", ended: "not_this_time" });
  });
});

describe("streamGatheringEvents", () => {
  it("sends the view on connect, every change, and gone; 404; 410", async () => {
    const g = await h.group(2);
    const { id } = await h.flare(g.groupId, g.host, { quorum: 2 });
    const res = await h.app.request(G(id, "/events"));
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const reader = (res.body as ReadableStream<Uint8Array>).getReader();
    let text = "";
    const until = async (s: string) => {
      while (!text.includes(s)) {
        const { value, done } = await reader.read();
        if (done) break;
        text += new TextDecoder().decode(value);
      }
    };
    await until("id: 1");
    await h.call("PUT", G(id, "/me"), { as: g.members[1], body: { answer: "yes" } });
    await until("id: 2");
    expect(text).toContain('"state":"lit"');
    await h.call("POST", G(id, "/done"), { as: g.host });
    await until("event: gone");
    expect(text).toContain('"ended":"thanks_for_coming"');
    await reader.cancel();
    expect(h.ctx.events.listeners(id)).toBe(0);
    expect((await h.app.request(G(randomUUID(), "/events"))).status).toBe(404);
    expect((await h.app.request(G(id, "/events"))).status).toBe(410);
  });
  it("Last-Event-ID equal to the current version sends nothing until the next change", async () => {
    const g = await h.group(2);
    const { id } = await h.flare(g.groupId, g.host, { quorum: 3 });
    const res = await h.app.request(G(id, "/events"), { headers: { "last-event-id": "1" } });
    const reader = (res.body as ReadableStream<Uint8Array>).getReader();
    await h.call("PUT", G(id, "/me"), { as: g.members[1], body: { answer: "yes" } });
    const { value } = await reader.read();
    const first = new TextDecoder().decode(value);
    expect(first).toContain("id: 2");
    expect(first).not.toContain("id: 1\n");
    await reader.cancel();
  });
});

describe("putPhoto", () => {
  it("204, 401, 403 for a non-host, 409 after Gone, 413 over 1.5 MB", async () => {
    const g = await h.group(2);
    const { id } = await h.flare(g.groupId, g.host);
    expect((await h.call("PUT", G(id, "/photo"), { as: g.host, raw: randomBytes(100) })).status).toBe(204);
    expect((await h.call("PUT", G(id, "/photo"), { raw: randomBytes(100) })).status).toBe(401);
    expect((await h.call("PUT", G(id, "/photo"), { as: g.members[1], raw: randomBytes(100) })).status).toBe(403);
    expect((await h.call("PUT", G(id, "/photo"), { as: g.host, raw: Buffer.alloc(1_500_001) })).status).toBe(413);
    await h.call("POST", G(id, "/cancel"), { as: g.host });
    expect((await h.call("PUT", G(id, "/photo"), { as: g.host, raw: randomBytes(100) })).status).toBe(409);
  });
});

describe("getPhoto", () => {
  it("200 ciphertext with private cache, 404 before upload, 410 after Gone", async () => {
    const g = await h.group(2);
    const { id } = await h.flare(g.groupId, g.host);
    expect((await h.app.request(G(id, "/photo"))).status).toBe(404);
    const bytes = randomBytes(300);
    await h.call("PUT", G(id, "/photo"), { as: g.host, raw: bytes });
    const r = await h.app.request(G(id, "/photo"));
    expect(r.headers.get("cache-control")).toBe("private, max-age=3600, immutable");
    expect(Buffer.from(await r.arrayBuffer()).equals(bytes)).toBe(true);
    await h.call("POST", G(id, "/cancel"), { as: g.host });
    expect((await h.app.request(G(id, "/photo"))).status).toBe(410);
  });
});

describe("getMyAnswer", () => {
  it("200 for the host, 401, 404 for another group, 410", async () => {
    const g = await h.group(2);
    const { id } = await h.flare(g.groupId, g.host);
    expect((await h.call("GET", G(id, "/me"), { as: g.host })).body).toMatchObject({
      is_host: true,
      answer: "yes",
      can_take_back: false,
    });
    expect((await h.call("GET", G(id, "/me"))).status).toBe(401);
    const o = await h.group(1);
    expect((await h.call("GET", G(id, "/me"), { as: o.host })).status).toBe(404);
    await h.call("POST", G(id, "/cancel"), { as: g.host });
    expect((await h.call("GET", G(id, "/me"), { as: g.host })).status).toBe(410);
  });
});

describe("putMyAnswer", () => {
  it("200 yes with rules and checks, 400, 401, 409 cant_make_it before Lit, 410, 422 with yourself", async () => {
    const g = await h.group(3);
    const { id } = await h.flare(g.groupId, g.host);
    const b = g.members[1] as TestMember;
    const rules = [
      { type: "with", member_id: g.host.id },
      { type: "max_walk", minutes: 10 },
    ];
    const r = await h.call("PUT", G(id, "/me"), {
      as: b,
      body: { answer: "yes", rules, checks: { results: { spot: true } } },
    });
    expect(r.body).toMatchObject({ answer: "yes", rules });
    expect((await h.call("PUT", G(id, "/me"), { as: b, body: { answer: "maybe" } })).status).toBe(400);
    expect((await h.call("PUT", G(id, "/me"), { body: { answer: "yes" } })).status).toBe(401);
    expect((await h.call("PUT", G(id, "/me"), { as: b, body: { answer: "cant_make_it" } })).body.code).toBe(
      "wrong_state",
    );
    expect(
      (
        await h.call("PUT", G(id, "/me"), {
          as: b,
          body: { answer: "yes", rules: [{ type: "with", member_id: b.id }] },
        })
      ).status,
    ).toBe(422);
    await h.call("POST", G(id, "/cancel"), { as: g.host });
    expect((await h.call("PUT", G(id, "/me"), { as: b, body: { answer: "yes" } })).status).toBe(410);
  });
});

describe("takeBack", () => {
  it("200 before Lit, 401, 409 already_lit, 410", async () => {
    const g = await h.group(3);
    const { id } = await h.flare(g.groupId, g.host);
    const b = g.members[1] as TestMember;
    await h.call("PUT", G(id, "/me"), { as: b, body: { answer: "yes" } });
    expect((await h.call("DELETE", G(id, "/me"), { as: b })).body.answer).toBe("none");
    expect((await h.call("DELETE", G(id, "/me"))).status).toBe(401);
    const lit = await litFlare();
    expect((await h.call("DELETE", G(lit.id, "/me"), { as: lit.members[1] })).body.code).toBe("already_lit");
    await h.call("POST", G(id, "/cancel"), { as: g.host });
    expect((await h.call("DELETE", G(id, "/me"), { as: b })).status).toBe(410);
  });
});

describe("putMyChecks", () => {
  it("204, 400, 401, 410, 422 unknown_member before any answer", async () => {
    const g = await h.group(2);
    const { id } = await h.flare(g.groupId, g.host);
    const b = g.members[1] as TestMember;
    expect((await h.call("PUT", G(id, "/me/checks"), { as: b, body: { results: { spot: true } } })).body.code).toBe(
      "unknown_member",
    );
    await h.call("PUT", G(id, "/me"), { as: b, body: { answer: "yes" } });
    expect(
      (await h.call("PUT", G(id, "/me/checks"), { as: b, body: { results: { c1: true, spot: false } } })).status,
    ).toBe(204);
    expect((await h.call("PUT", G(id, "/me/checks"), { as: b, body: { results: { "osm:123": true } } })).status).toBe(
      400,
    );
    expect((await h.call("PUT", G(id, "/me/checks"), { body: { results: {} } })).status).toBe(401);
    await h.call("POST", G(id, "/cancel"), { as: g.host });
    expect((await h.call("PUT", G(id, "/me/checks"), { as: b, body: { results: {} } })).status).toBe(410);
  });
});

describe("addTextYes", () => {
  it("200, 403 non-host, 422 code_mismatch, 422 text_yes_cap after 3", async () => {
    const g = await h.group(2);
    const { id, r } = await h.flare(g.groupId, g.host, { quorum: 4 });
    const code = r.body.short_code as string;
    expect((await h.call("POST", G(id, "/text-yes"), { as: g.members[1], body: { code } })).status).toBe(403);
    const wrong = code === "22222" ? "33333" : "22222";
    expect((await h.call("POST", G(id, "/text-yes"), { as: g.host, body: { code: wrong } })).body.code).toBe(
      "code_mismatch",
    );
    const one = await h.call("POST", G(id, "/text-yes"), { as: g.host, body: { code } });
    expect(one.body.need).toBe(2);
    await h.call("POST", G(id, "/text-yes"), { as: g.host, body: { code } });
    const three = await h.call("POST", G(id, "/text-yes"), { as: g.host, body: { code } });
    expect(three.body.state).toBe("lit");
  });
  it("422 text_yes_cap from the engine", async () => {
    const g = await h.group(1);
    const p = h.planBody({ quorum: 6 });
    const r = await h.call("POST", `/api/v1/groups/${g.groupId}/gatherings`, { as: g.host, body: p });
    for (let i = 0; i < 3; i++)
      await h.call("POST", G(p.id, "/text-yes"), { as: g.host, body: { code: r.body.short_code } });
    expect(
      (await h.call("POST", G(p.id, "/text-yes"), { as: g.host, body: { code: r.body.short_code } })).body.code,
    ).toBe("text_yes_cap");
  });
});

describe("fade", () => {
  it("200, 401, 409 fade_window_closed", async () => {
    const g = await h.group(3);
    const p = h.planBody({ quorum: 3 });
    await h.call("POST", `/api/v1/groups/${g.groupId}/gatherings`, { as: g.host, body: p });
    await h.call("PUT", G(p.id, "/me"), { as: g.members[1], body: { answer: "yes" } });
    await h.call("PUT", G(p.id, "/me"), { as: g.members[2], body: { answer: "yes" } });
    expect((await h.call("POST", G(p.id, "/fade"))).status).toBe(401);
    expect((await h.call("POST", G(p.id, "/fade"), { as: g.members[1] })).status).toBe(200);
    h.clock.advance(4 * 60 * 60_000);
    expect((await h.call("POST", G(p.id, "/fade"), { as: g.members[2] })).body.code).toBe("fade_window_closed");
  });
  it("403 not_in_set for a member outside the chosen set", async () => {
    const g = await h.group(3);
    const p = h.planBody({ quorum: 2 });
    await h.call("POST", `/api/v1/groups/${g.groupId}/gatherings`, { as: g.host, body: p });
    await h.call("PUT", G(p.id, "/me"), { as: g.members[1], body: { answer: "yes" } });
    h.clock.advance(60 * 60_000 + 1); // the deadline lights it (P4)
    await h.tick();
    expect((await h.call("GET", G(p.id))).body.state).toBe("lit");
    expect((await h.call("POST", G(p.id, "/fade"), { as: g.members[2] })).body.code).toBe("not_in_set");
  });
});

describe("addArrival", () => {
  it("200 counted, duplicate not counted (BR-H-3), outbox tap before Lit not counted (BR-H-5), 401, 403, 409", async () => {
    const g = await litFlare();
    const b = g.members[1] as TestMember;
    const now = () => h.clock.now().toISOString();
    expect(
      (await h.call("POST", G(g.id, "/arrivals"), { as: b, body: { for: "self", recorded_at: now() } })).body.counted,
    ).toBe(true);
    const dup = await h.call("POST", G(g.id, "/arrivals"), { as: b, body: { for: "self", recorded_at: now() } });
    expect(dup.body).toMatchObject({ counted: false, spark_ticket: null });
    const early = await h.call("POST", G(g.id, "/arrivals"), {
      as: g.members[2],
      body: { for: "self", recorded_at: new Date(h.clock.t - 3600_000).toISOString() },
    });
    expect(early.body.counted).toBe(false);
    expect((await h.call("POST", G(g.id, "/arrivals"), { body: { for: "self", recorded_at: now() } })).status).toBe(
      401,
    );
    expect(
      (await h.call("POST", G(g.id, "/arrivals"), { as: b, body: { for: "someone_else", recorded_at: now() } })).status,
    ).toBe(403);
    const k = await h.group(2);
    const { id } = await h.flare(k.groupId, k.host);
    expect(
      (await h.call("POST", G(id, "/arrivals"), { as: k.host, body: { for: "self", recorded_at: now() } })).status,
    ).toBe(409);
  });
});

describe("markDone", () => {
  it("200 Gone, 403 not_host, 409 before Lit", async () => {
    const g = await litFlare();
    expect((await h.call("POST", G(g.id, "/done"), { as: g.members[1] })).body.code).toBe("not_host");
    const k = await h.group(2);
    const { id } = await h.flare(k.groupId, k.host);
    expect((await h.call("POST", G(id, "/done"), { as: k.host })).status).toBe(409);
    expect((await h.call("POST", G(g.id, "/done"), { as: g.host })).body.ended).toBe("thanks_for_coming");
  });
});

describe("cancelGathering", () => {
  it("200 Gone not_this_time, 403, 409 after Lit", async () => {
    const lit = await litFlare();
    expect((await h.call("POST", G(lit.id, "/cancel"), { as: lit.host })).status).toBe(409);
    const k = await h.group(2);
    const { id } = await h.flare(k.groupId, k.host);
    expect((await h.call("POST", G(id, "/cancel"), { as: k.members[1] })).status).toBe(403);
    expect((await h.call("POST", G(id, "/cancel"), { as: k.host })).body.ended).toBe("not_this_time");
  });
});

describe("putLiveLocation", () => {
  it("204 overwrite in place, 403 non-host, 409 before Lit", async () => {
    const k = await h.group(2);
    const { id } = await h.flare(k.groupId, k.host);
    expect((await h.call("PUT", G(id, "/live-location"), { as: k.host, body: { location_ct: ct() } })).status).toBe(
      409,
    );
    const g = await litFlare();
    await h.call("PUT", G(g.id, "/live-location"), { as: g.host, body: { location_ct: ct() } });
    await h.call("PUT", G(g.id, "/live-location"), { as: g.host, body: { location_ct: ct() } });
    expect((await h.db.query("select 1 from live_locations where gathering_id = $1", [g.id])).rows).toHaveLength(1);
    expect(
      (await h.call("PUT", G(g.id, "/live-location"), { as: g.members[1], body: { location_ct: ct() } })).status,
    ).toBe(403);
  });
});

describe("getLiveLocation", () => {
  it("200 for the set, 403 not_in_set, 404 when not sharing", async () => {
    const g = await litFlare();
    expect((await h.call("GET", G(g.id, "/live-location"), { as: g.members[1] })).status).toBe(404);
    const loc = ct();
    await h.call("PUT", G(g.id, "/live-location"), { as: g.host, body: { location_ct: loc } });
    expect((await h.call("GET", G(g.id, "/live-location"), { as: g.members[1] })).body.location_ct).toBe(loc);
    expect((await h.call("GET", G(g.id, "/live-location"), { as: g.members[2] })).body.code).toBe("not_in_set");
  });
});

describe("stopLiveLocation", () => {
  it("204, 403", async () => {
    const g = await litFlare();
    await h.call("PUT", G(g.id, "/live-location"), { as: g.host, body: { location_ct: ct() } });
    expect((await h.call("DELETE", G(g.id, "/live-location"), { as: g.members[1] })).status).toBe(403);
    expect((await h.call("DELETE", G(g.id, "/live-location"), { as: g.host })).status).toBe(204);
    expect((await h.db.query("select 1 from live_locations where gathering_id = $1", [g.id])).rows).toHaveLength(0);
  });
});

describe("addSpark", () => {
  it("201 with a ticket, 401, 403 not_arrived without one, 409 spark_exists", async () => {
    const g = await litFlare();
    const a = await h.call("POST", G(g.id, "/arrivals"), {
      as: g.members[1],
      body: { for: "self", recorded_at: h.clock.now().toISOString() },
    });
    const spark = {
      id: randomUUID(),
      ticket: a.body.spark_ticket,
      place: randomBytes(32).toString("base64url"),
      text_ct: ct(),
      delete_token: tok(),
    };
    const url = `/api/v1/groups/${g.groupId}/sparks`;
    expect((await h.call("POST", url, { body: spark })).status).toBe(401);
    expect((await h.call("POST", url, { as: g.members[1], body: { ...spark, ticket: tok() } })).body.code).toBe(
      "not_arrived",
    );
    expect((await h.call("POST", url, { as: g.members[1], body: spark })).status).toBe(201);
    expect((await h.call("POST", url, { as: g.members[1], body: spark })).body.code).toBe("spark_exists");
    // Forget deletes it by its delete token.
    const f = await h.call("DELETE", `/api/v1/groups/${g.groupId}/members/${g.members[1]?.id}`, {
      as: g.members[1],
      body: { spark_delete_tokens: [spark.delete_token] },
    });
    expect(f.body.sparks_deleted).toBe(1);
  });
});

describe("listSparks", () => {
  it("200 empty, 400 without place, 401", async () => {
    const g = await h.group(1);
    const place = randomBytes(32).toString("base64url");
    expect(
      (await h.call("GET", `/api/v1/groups/${g.groupId}/sparks?place=${place}&limit=5`, { as: g.host })).body,
    ).toEqual({ sparks: [] });
    expect((await h.call("GET", `/api/v1/groups/${g.groupId}/sparks`, { as: g.host })).status).toBe(400);
    expect((await h.call("GET", `/api/v1/groups/${g.groupId}/sparks?place=${place}`)).status).toBe(401);
  });
});

describe("getHotspots", () => {
  it("404 before the first save", async () => {
    const g = await h.group(1);
    expect((await h.call("GET", `/api/v1/groups/${g.groupId}/hotspots`, { as: g.host })).status).toBe(404);
  });
});

describe("putHotspots", () => {
  it("200 with If-Match 0 then 1, 412 version_conflict on a stale version", async () => {
    const g = await h.group(2);
    const url = `/api/v1/groups/${g.groupId}/hotspots`;
    const a = await h.call("PUT", url, { as: g.host, body: { blob_ct: ct() }, headers: { "if-match": '"0"' } });
    expect(a.body.version).toBe(1);
    const b = await h.call("PUT", url, { as: g.members[1], body: { blob_ct: ct() }, headers: { "if-match": '"1"' } });
    expect(b.body.version).toBe(2);
    const stale = await h.call("PUT", url, { as: g.host, body: { blob_ct: ct() }, headers: { "if-match": '"1"' } });
    expect(stale).toMatchObject({ status: 412, body: { code: "version_conflict" } });
    const got = await h.call("GET", url, { as: g.host });
    expect(got.headers.get("etag")).toBe('"2"');
  });
});

describe("putPushSubscription", () => {
  it("204, 400 for a non-https endpoint, 401", async () => {
    const g = await h.group(1);
    const url = `/api/v1/groups/${g.groupId}/push-subscriptions`;
    const sub = { endpoint: "https://push.example.test/abc", keys: { p256dh: "BAbc", auth: "xyz" } };
    expect((await h.call("PUT", url, { as: g.host, body: sub })).status).toBe(204);
    expect((await h.call("PUT", url, { as: g.host, body: { ...sub, endpoint: "http://x.test/" } })).status).toBe(400);
    expect((await h.call("PUT", url, { body: sub })).status).toBe(401);
  });
});

describe("deletePushSubscription", () => {
  it("204, 401", async () => {
    const g = await h.group(1);
    const url = `/api/v1/groups/${g.groupId}/push-subscriptions`;
    await h.call("PUT", url, {
      as: g.host,
      body: { endpoint: "https://push.example.test/a", keys: { p256dh: "B", auth: "x" } },
    });
    expect((await h.call("DELETE", url, { as: g.host })).status).toBe(204);
    expect((await h.db.query("select 1 from push_subscriptions where member_id = $1", [g.host.id])).rows).toHaveLength(
      0,
    );
    expect((await h.call("DELETE", url)).status).toBe(401);
  });
});

describe("draftFromPhoto", () => {
  it("200 rules tier with no hub, 400, 413, 415; counts tier_ran.photo", async () => {
    const jpeg = Buffer.alloc(100, 1);
    jpeg[0] = 0xff;
    jpeg[1] = 0xd8;
    jpeg[2] = 0xff;
    const r = await h.call("POST", "/api/v1/drafts", { raw: jpeg, type: "image/jpeg", key: null });
    expect(r.body.tier).toBe("rules");
    expect(
      (await h.call("POST", "/api/v1/drafts", { raw: Buffer.alloc(10), type: "image/jpeg", key: null })).status,
    ).toBe(400);
    expect(
      (await h.call("POST", "/api/v1/drafts", { raw: Buffer.alloc(1_500_001), type: "image/jpeg", key: null })).status,
    ).toBe(413);
    expect((await h.call("POST", "/api/v1/drafts", { raw: jpeg, type: "image/png", key: null })).status).toBe(415);
    const c = await h.db.query<{ value: string }>(
      "select value::text from global_counters where name = 'tier_ran.photo' and bucket = 'rules'",
    );
    expect(Number(c.rows[0]?.value)).toBeGreaterThanOrEqual(1);
  });
});

describe("draftLadder", () => {
  it("200 template ladder with no hub (ADR-0007), 400", async () => {
    const r = await h.call("POST", "/api/v1/drafts/ladder", {
      body: { ask: "Fairlane walk at 11?", total_minutes: 60 },
      key: null,
    });
    expect(r.body.tier).toBe("rules");
    expect(r.body.steps.map((s: { minutes: number }) => s.minutes)).toEqual([60, 30, 15, 10]);
    expect(r.body.steps[0].label).toBe("Long walk");
    expect(
      (await h.call("POST", "/api/v1/drafts/ladder", { body: { ask: "", total_minutes: 60 }, key: null })).status,
    ).toBe(400);
    expect(
      (await h.call("POST", "/api/v1/drafts/ladder", { body: { ask: "x", total_minutes: 30 }, key: null })).status,
    ).toBe(400);
  });
});

describe("coverage of the contract", () => {
  it("has a describe block for every BE operation in openapi.yaml", () => {
    const spec = YAML.parse(fs.readFileSync(OPENAPI, "utf8")) as {
      paths: Record<string, Record<string, { operationId?: string }>>;
    };
    const ops = Object.values(spec.paths)
      .flatMap((p) => Object.values(p).map((o) => o?.operationId))
      .filter((x): x is string => !!x && !INT_OWNED.has(x));
    const src = fs.readFileSync(fileURLToPath(import.meta.url), "utf8");
    const missing = ops.filter((op) => !src.includes(`describe("${op}"`));
    expect(missing).toEqual([]);
    expect(ops.length).toBeGreaterThanOrEqual(33);
  });
});
