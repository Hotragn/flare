// Sparks, Hot spots and push subscriptions (openapi tags places, push). All sealed or opaque.
import type { Context, Hono } from "hono";
import type { Ctx } from "../core/deps.ts";
import { b64u, bump, unb64u } from "../core/gatherings.ts";
import { ApiError } from "../http/errors.ts";
import { body, type RateLimiter, requireMember, sha256 } from "../http/middleware.ts";
import { HotspotsBody, NewSpark, PlaceHash, PushSubscription } from "../http/schemas.ts";
import { needDb, write } from "../http/write.ts";
import { groupParam, sameGroup } from "./groups.ts";

const day = (d: Date | string) => new Date(d).toISOString().slice(0, 10); // nothing finer than the day

export function mountPlaces(app: Hono, ctx: Ctx, rl: RateLimiter): void {
  const member = async (c: Context) => {
    const db = needDb(ctx);
    const groupId = groupParam(c.req.param("groupId"));
    const m = await requireMember(c, db);
    sameGroup(m, groupId);
    return { db, groupId, m };
  };

  app.post("/api/v1/groups/:groupId/sparks", async (c) => {
    const { db, groupId, m } = await member(c);
    return write(c, ctx, rl, { member: m }, async () => {
      const b = await body(c, NewSpark);
      return db.tx(async (q) => {
        if ((await q.query("select 1 from sparks where id = $1", [b.id])).rows.length)
          throw new ApiError(409, "spark_exists", "Already saved");
        // One Spark per ticket (BR-K-1): the ticket is consumed in the same transaction.
        const t = await q.query(
          "delete from spark_tickets where token_hash = $1 and group_id = $2 and expires_at > $3 returning 1",
          [sha256(b.ticket), groupId, ctx.clock.now()],
        );
        if (!t.rows.length) throw new ApiError(403, "not_arrived", "Sparks are for people who came");
        const r = (
          await q.query<{ id: string; text_ct: Uint8Array; created_on: Date | string }>(
            `insert into sparks (id, group_id, place_key_hash, text_ct, delete_token_hash, created_on)
             values ($1, $2, $3, $4, $5, $6) returning id, text_ct, created_on`,
            [b.id, groupId, unb64u(b.place), unb64u(b.text_ct), sha256(b.delete_token), day(ctx.clock.now())],
          )
        ).rows[0] as { id: string; text_ct: Uint8Array; created_on: Date | string };
        await bump(q, groupId, "sparks_left");
        return { status: 201, body: { id: r.id, text_ct: b64u(r.text_ct), created_on: day(r.created_on) } };
      });
    });
  });

  app.get("/api/v1/groups/:groupId/sparks", async (c) => {
    const { db, groupId } = await member(c);
    const place = PlaceHash.safeParse(c.req.query("place"));
    const limRaw = c.req.query("limit");
    const limit = limRaw === undefined ? 1 : Number(limRaw);
    if (!place.success || !Number.isInteger(limit) || limit < 1 || limit > 20)
      throw new ApiError(400, "bad_request", "place and limit 1 to 20");
    const rows = (
      await db.query<{ id: string; text_ct: Uint8Array; created_on: Date | string }>(
        "select id, text_ct, created_on from sparks where group_id = $1 and place_key_hash = $2 order by created_on desc, id limit $3",
        [groupId, unb64u(place.data), limit],
      )
    ).rows;
    return c.json({ sparks: rows.map((r) => ({ id: r.id, text_ct: b64u(r.text_ct), created_on: day(r.created_on) })) });
  });

  app.get("/api/v1/groups/:groupId/hotspots", async (c) => {
    const { db, groupId } = await member(c);
    const r = (
      await db.query<{ blob_ct: Uint8Array; version: number }>(
        "select blob_ct, version from hotspots where group_id = $1",
        [groupId],
      )
    ).rows[0];
    if (!r) throw new ApiError(404, "not_found", "No Hot spots yet");
    c.header("etag", `"${r.version}"`);
    return c.json({ blob_ct: b64u(r.blob_ct), version: r.version });
  });

  app.put("/api/v1/groups/:groupId/hotspots", async (c) => {
    const { db, groupId, m } = await member(c);
    return write(c, ctx, rl, { member: m }, async () => {
      const match = (c.req.header("if-match") ?? "").replace(/^W\//, "").replace(/"/g, "").trim();
      if (!/^\d{1,10}$/.test(match)) throw new ApiError(400, "bad_request", "If-Match version needed");
      const b = await body(c, HotspotsBody);
      return db.tx(async (q) => {
        const cur = (
          await q.query<{ version: number }>("select version from hotspots where group_id = $1 for update", [groupId])
        ).rows[0];
        const want = Number(match);
        // No blob yet: If-Match "0" creates version 1.
        if ((cur?.version ?? 0) !== want) throw new ApiError(412, "version_conflict", "Fetch, merge, retry");
        const r = (
          await q.query<{ version: number }>(
            `insert into hotspots (group_id, blob_ct, version) values ($1, $2, 1)
             on conflict (group_id) do update set blob_ct = excluded.blob_ct, version = hotspots.version + 1
             returning version`,
            [groupId, unb64u(b.blob_ct)],
          )
        ).rows[0] as { version: number };
        return { status: 200, body: { blob_ct: b.blob_ct, version: r.version }, headers: { etag: `"${r.version}"` } };
      });
    });
  });

  app.put("/api/v1/groups/:groupId/push-subscriptions", async (c) => {
    const { db, m } = await member(c);
    return write(c, ctx, rl, { member: m }, async () => {
      const b = await body(c, PushSubscription);
      if (!b.endpoint.startsWith("https://")) throw new ApiError(400, "bad_request", "https endpoint only");
      await db.query(
        `insert into push_subscriptions (member_id, endpoint, p256dh, auth) values ($1, $2, $3, $4)
         on conflict (member_id) do update set endpoint = excluded.endpoint, p256dh = excluded.p256dh,
           auth = excluded.auth, created_at = now()`,
        [m.id, b.endpoint, b.keys.p256dh, b.keys.auth],
      );
      return { status: 204, body: null };
    });
  });

  app.delete("/api/v1/groups/:groupId/push-subscriptions", async (c) => {
    const { db, m } = await member(c);
    return write(c, ctx, rl, { member: m }, async () => {
      await db.query("delete from push_subscriptions where member_id = $1", [m.id]);
      return { status: 204, body: null };
    });
  });
}
