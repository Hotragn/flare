// Groups and members (openapi tag groups): create, read, join, rename, forget (SRS-ID-1 to 6).

import type { Hono } from "hono";
import type { Ctx } from "../core/deps.ts";
import { b64u, isoWeek, runEvent, unb64u } from "../core/gatherings.ts";
import type { Q } from "../db/db.ts";
import { ApiError } from "../http/errors.ts";
import { body, isUuid, type RateLimiter, requireMember, sha256 } from "../http/middleware.ts";
import { CreateGroup, Forget, NewMember, Rename } from "../http/schemas.ts";
import { clientIp, needDb, write } from "../http/write.ts";

export const MAX_MEMBERS = 12; // SRS-ID-5

type MemberRow = { id: string; name_ct: Uint8Array | null; joined_at: Date; via: "link" | "telegram" };
const memberView = (m: MemberRow) => ({
  id: m.id,
  name_ct: m.name_ct ? b64u(m.name_ct) : null,
  joined_at: new Date(m.joined_at).toISOString(),
  via: m.via,
});

export async function groupView(q: Q, groupId: string) {
  const g = (await q.query<{ id: string; channel: string }>("select id, channel from groups where id = $1", [groupId]))
    .rows[0];
  if (!g) return null;
  const members = (
    await q.query<MemberRow>(
      "select id, name_ct, joined_at, via from members where group_id = $1 order by joined_at, id",
      [groupId],
    )
  ).rows.map(memberView);
  const live = (
    await q.query<{ id: string; kind: string; state: string }>(
      "select id, kind, state from gatherings where group_id = $1 and state <> 'gone' order by created_at",
      [groupId],
    )
  ).rows;
  return { id: g.id, channel: g.channel, members, live };
}

export const groupParam = (v: string | undefined): string => {
  if (!isUuid(v)) throw new ApiError(400, "bad_request", "Bad id");
  return v.toLowerCase();
};

/** The member must belong to this group; otherwise the group does not exist for them. */
export function sameGroup(member: { group_id: string }, groupId: string): void {
  if (member.group_id !== groupId) throw new ApiError(404, "not_found", "No such group");
}

export function mountGroups(app: Hono, ctx: Ctx, rl: RateLimiter): void {
  app.post("/api/v1/groups", async (c) =>
    write(c, ctx, rl, { anon: clientIp(c) }, async () => {
      const b = await body(c, CreateGroup);
      const db = needDb(ctx);
      return db.tx(async (q) => {
        const dup = await q.query("select 1 from groups where id = $1 union all select 1 from members where id = $2", [
          b.id,
          b.member.id,
        ]);
        if (dup.rows.length) throw new ApiError(409, "wrong_state", "That id is taken");
        await q.query("insert into groups (id) values ($1)", [b.id]);
        await q.query("insert into members (id, group_id, name_ct, write_token_hash) values ($1, $2, $3, $4)", [
          b.member.id,
          b.id,
          unb64u(b.member.name_ct),
          sha256(b.member.write_token),
        ]);
        return { status: 201, body: await groupView(q, b.id) };
      });
    }),
  );

  // Crew space stats (backlog #5): from the group's own counters only, never who or where.
  app.get("/api/v1/groups/:groupId/stats", async (c) => {
    const db = needDb(ctx);
    const groupId = groupParam(c.req.param("groupId"));
    const m = await requireMember(c, db);
    sameGroup(m, groupId);
    const r = await db.query<{ name: string; bucket: string; value: string }>(
      `select name, bucket, value::text from counters where group_id = $1
       and name in ('flares_lit', 'embers_lit', 'lit_minutes_sum', 'lit_minutes_week', 'plans_lit_step')`,
      [groupId],
    );
    const sum = (n: string, bucket?: string) =>
      r.rows
        .filter((x) => x.name === n && (bucket === undefined || x.bucket === bucket))
        .reduce((a, x) => a + Number(x.value), 0);
    return c.json({
      outings: sum("flares_lit") + sum("plans_lit_step"),
      outside_min: sum("lit_minutes_sum"),
      outside_min_week: sum("lit_minutes_week", isoWeek(new Date())),
      embers_saved: sum("embers_lit"),
    });
  });

  app.get("/api/v1/groups/:groupId", async (c) => {
    const db = needDb(ctx);
    const groupId = groupParam(c.req.param("groupId"));
    const m = await requireMember(c, db);
    sameGroup(m, groupId);
    const v = await groupView(db, groupId);
    if (!v) throw new ApiError(404, "not_found", "No such group");
    return c.json(v);
  });

  app.post("/api/v1/groups/:groupId/members", async (c) => {
    const groupId = groupParam(c.req.param("groupId"));
    return write(c, ctx, rl, { anon: clientIp(c), gathering: `group:${groupId}` }, async () => {
      const b = await body(c, NewMember);
      return needDb(ctx).tx(async (q) => {
        const g = await q.query("select id from groups where id = $1 for update", [groupId]);
        if (!g.rows[0]) throw new ApiError(404, "not_found", "No such group");
        if ((await q.query("select 1 from members where id = $1", [b.id])).rows.length)
          throw new ApiError(409, "wrong_state", "That id is taken");
        const n = (
          await q.query<{ n: number }>("select count(*)::int as n from members where group_id = $1", [groupId])
        ).rows[0]?.n;
        if ((n ?? 0) >= MAX_MEMBERS) throw new ApiError(409, "group_full", "12 members at most");
        const row = (
          await q.query<MemberRow>(
            "insert into members (id, group_id, name_ct, write_token_hash) values ($1, $2, $3, $4) returning id, name_ct, joined_at, via",
            [b.id, groupId, unb64u(b.name_ct), sha256(b.write_token)],
          )
        ).rows[0] as MemberRow;
        return { status: 201, body: memberView(row) };
      });
    });
  });

  app.patch("/api/v1/groups/:groupId/members/:memberId", async (c) => {
    const db = needDb(ctx);
    const groupId = groupParam(c.req.param("groupId"));
    const memberId = groupParam(c.req.param("memberId"));
    const m = await requireMember(c, db);
    if (m.group_id !== groupId || m.id !== memberId) throw new ApiError(403, "forbidden", "Only your own name");
    return write(c, ctx, rl, { member: m }, async () => {
      const b = await body(c, Rename);
      const row = (
        await db.query<MemberRow>(
          "update members set name_ct = $2 where id = $1 returning id, name_ct, joined_at, via",
          [m.id, unb64u(b.name_ct)],
        )
      ).rows[0] as MemberRow;
      return { status: 200, body: memberView(row) };
    });
  });

  app.delete("/api/v1/groups/:groupId/members/:memberId", async (c) => {
    const db = needDb(ctx);
    const groupId = groupParam(c.req.param("groupId"));
    const memberId = groupParam(c.req.param("memberId"));
    const m = await requireMember(c, db);
    if (m.group_id !== groupId || m.id !== memberId) throw new ApiError(403, "forbidden", "Only yourself");
    return write(c, ctx, rl, { member: m }, async () => {
      let tokens: string[] = [];
      if (c.req.header("content-type")?.includes("json")) tokens = (await body(c, Forget)).spark_delete_tokens ?? [];
      return { status: 200, body: await forgetMember(ctx, groupId, m.id, tokens) };
    });
  });
}

/**
 * "Forget this group" (SRS-ID-6, ADR-0015). Order matters: answers leave live gatherings
 * through the engine first (so counts and SSE stay right), then rows are deleted.
 */
export async function forgetMember(ctx: Ctx, groupId: string, memberId: string, sparkTokens: string[]) {
  const db = needDb(ctx);
  const now = ctx.clock.now();
  // 1. Answers in live gatherings the member does not host.
  const live = (
    await db.query<{ id: string; host_member_id: string }>(
      `select g.id, g.host_member_id from gatherings g where g.group_id = $1 and g.state <> 'gone'
       and (g.host_member_id = $2 or exists (select 1 from responses r where r.gathering_id = g.id and r.member_id = $2))`,
      [groupId, memberId],
    )
  ).rows;
  for (const g of live) {
    if (g.host_member_id === memberId) {
      // A host who forgets the group ends their gatherings: "Not this time." for everyone.
      await runEvent(ctx, g.id, { type: "cancel", by: memberId }, now).catch(() => null);
    } else {
      await runEvent(ctx, g.id, { type: "member_left", member_id: memberId }, now).catch(() => null);
    }
  }
  return db.tx(async (q) => {
    // 2. Sparks the member wrote, by their delete tokens (no author id is kept).
    let sparks = 0;
    if (sparkTokens.length) {
      const r = await q.query(
        "delete from sparks where group_id = $1 and delete_token_hash = any($2::bytea[]) returning id",
        [groupId, sparkTokens.map((t) => sha256(t))],
      );
      sparks = r.rows.length;
    }
    // 3. Gatherings the member hosts that are already Gone go now (FK cascade would anyway).
    const hosted = (
      await q.query<{ id: string; ended: "not_this_time" | "thanks_for_coming" | null }>(
        "delete from gatherings where host_member_id = $1 returning id, ended",
        [memberId],
      )
    ).rows;
    // 4. The member row; cascade takes push subscription, answers, live location, binds.
    await q.query("delete from members where id = $1", [memberId]);
    const left = (await q.query<{ n: number }>("select count(*)::int as n from members where group_id = $1", [groupId]))
      .rows[0]?.n;
    const last = (left ?? 0) === 0;
    if (last) {
      const all = await q.query("select count(*)::int as n from sparks where group_id = $1", [groupId]);
      sparks += (all.rows[0] as { n: number } | undefined)?.n ?? 0;
      await q.query("delete from groups where id = $1", [groupId]); // cascade: everything else
    }
    for (const h of hosted) ctx.events.publish(h.id, { type: "gone", id: h.id, ended: h.ended ?? "not_this_time" });
    return { last_member: last, sparks_deleted: sparks };
  });
}
