// Flares and Plans (openapi tags gatherings, answers, arrival): create, view, live stream,
// photo, your answer, checks, text yes, fade, arrivals, done, cancel, live location.

import { createFlare, createPlan } from "@flare/engine";
import { newCode } from "@flare/shared";
import type { Answer, EngineEvent, Label, PlanStep, Rule } from "@flare/shared/icd/engine";
import type { Context, Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { Ctx } from "../core/deps.ts";
import {
  applyCounter,
  b64u,
  type GatheringRow,
  goneError,
  loadAnswers,
  loadRow,
  notifyOf,
  publish,
  runEvent,
  scheduleJob,
  toView,
  unb64u,
} from "../core/gatherings.ts";
import { ApiError } from "../http/errors.ts";
import { body, type Member, type RateLimiter, requireMember } from "../http/middleware.ts";
import { AnswerBody, ArrivalBody, Checks, CreateGathering, LiveLocation, TextYes } from "../http/schemas.ts";
import { needDb, write } from "../http/write.ts";
import { log } from "../log.ts";
import { groupParam, sameGroup } from "./groups.ts";

const MIN = 60_000;
export const MAX_PHOTO_CT_BYTES = 1_500_000;
export const KEEPALIVE_MS = 15_000;

const CREATE_STATUS = { quorum_range: 422, plan_times: 422, group_full: 409, bad_request: 400 } as const;

/** Your own view (openapi Me). Only ever about the caller. */
export function meView(row: GatheringRow, answers: Answer[], memberId: string, now: Date) {
  const a = answers.find((x) => x.member_id === memberId);
  const isHost = row.host_member_id === memberId;
  const answer = isHost || a?.status === "yes" ? "yes" : a?.status === "cant_make_it" ? "cant_make_it" : "none";
  const lit = row.state === "lit" || (row.state === "gone" && row.lit_at !== null);
  const inSet = lit ? row.chosen_set.includes(memberId) : null;
  let canFade = false;
  if (row.kind === "plan" && row.state === "lit" && inSet && !a?.faded && row.start_at) {
    const k = row.current_step ?? 1;
    const minutes = row.plan_steps?.find((s) => s.step === k)?.minutes ?? 0;
    canFade = now.getTime() <= row.start_at.getTime() + (minutes * MIN) / 2;
  }
  return {
    member_id: memberId,
    is_host: isHost,
    answer,
    rules: (a?.rules ?? []) as Rule[],
    ember_only: a?.ember_only ?? false,
    in_set: inSet,
    arrived: !!a?.arrived_at,
    can_take_back: answer === "yes" && !isHost && (row.state === "kindling" || row.state === "ember"),
    can_fade: canFade,
    still_coming: a?.still_coming ?? false,
  };
}

export function mountGatherings(app: Hono, ctx: Ctx, rl: RateLimiter): void {
  const gid = (c: Context) => groupParam(c.req.param("gatheringId"));

  /** Loads the gathering and checks the caller is a member of its group. */
  async function memberOf(c: Context): Promise<{ m: Member; row: GatheringRow }> {
    const db = needDb(ctx);
    const id = gid(c);
    const m = await requireMember(c, db);
    const row = await loadRow(db, id);
    if (!row || row.group_id !== m.group_id) throw new ApiError(404, "not_found", "No such gathering");
    return { m, row };
  }

  /** Runs one engine event as a write and answers with the shared view. */
  const viewWrite = (ev: (m: Member, c: Context) => EngineEvent | Promise<EngineEvent>) => async (c: Context) => {
    const now = ctx.clock.now(); // receive time, before any lock (BR-F-2)
    const { m, row } = await memberOf(c);
    return write(c, ctx, rl, { member: m, gathering: row.id }, async () => {
      const out = await runEvent(ctx, row.id, await ev(m, c), now);
      return { status: 200, body: toView(ctx, out.row, out.answers, ctx.clock.now()) };
    });
  };

  app.post("/api/v1/groups/:groupId/gatherings", async (c) => {
    const db = needDb(ctx);
    const groupId = groupParam(c.req.param("groupId"));
    const m = await requireMember(c, db);
    sameGroup(m, groupId);
    return write(c, ctx, rl, { member: m }, async () => {
      const b = await body(c, CreateGathering);
      const now = ctx.clock.now();
      if (b.kind === "flare" && b.plan) throw new ApiError(400, "bad_request", "A Flare has no plan");
      if (b.kind === "plan" && !b.plan) throw new ApiError(400, "bad_request", "A Plan needs plan");
      if (b.kind === "plan" && b.ember_candidates?.length)
        throw new ApiError(400, "bad_request", "Plans have no Ember");
      const created = await db.tx(async (q) => {
        const grp = (
          await q.query<{ channel: string }>("select channel from groups where id = $1 for update", [groupId])
        ).rows[0];
        if (!grp) throw new ApiError(404, "not_found", "No such group");
        if (b.telegram && grp.channel !== "telegram")
          throw new ApiError(400, "bad_request", "Readable post text is for Telegram groups only");
        if ((await q.query("select 1 from gatherings where id = $1", [b.id])).rows.length)
          throw new ApiError(409, "wrong_state", "That id is taken");
        const size =
          (await q.query<{ n: number }>("select count(*)::int as n from members where group_id = $1", [groupId]))
            .rows[0]?.n ?? 0;
        // Rows F1 and P1 live in the engine (docs/engine/02-api.md section 2).
        const common = { id: b.id, group_id: groupId, host: m.id, group_size: size, quorum: b.quorum };
        const made =
          b.kind === "flare"
            ? createFlare({ ...common, ember_candidates: (b.ember_candidates ?? []) as Label[] }, now.toISOString())
            : createPlan(
                {
                  ...common,
                  start_at: b.plan?.start_at ?? "",
                  deadline_at: b.plan?.deadline_at ?? "",
                  steps: (b.plan?.steps ?? []) as PlanStep[],
                },
                now.toISOString(),
              );
        if (!made.ok) throw new ApiError(CREATE_STATUS[made.error], made.error, "Not allowed");
        const g = made.gathering;
        const expires = new Date(made.expires_at);
        let code = "";
        for (let i = 0; i < 20 && !code; i++) {
          const c2 = newCode();
          const taken = await q.query("select 1 from gatherings where short_code = $1 and state <> 'gone'", [c2]);
          if (!taken.rows.length) code = c2;
        }
        if (!code) throw new ApiError(409, "wrong_state", "No free short code");
        await q.query(
          `insert into gatherings (id, group_id, kind, state, short_code, host_member_id, quorum, tz, sealed,
             notice_ct, telegram_plain, ember_candidates, plan_steps, current_step, version, created_at, state_since,
             deadline_at, start_at, expires_at)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, null, $14, $15, $16, $17, $18, $19)`,
          [
            g.id,
            groupId,
            g.kind,
            g.state,
            code,
            g.host,
            g.quorum,
            b.tz,
            unb64u(b.sealed),
            unb64u(b.notice_ct),
            b.telegram ? JSON.stringify(b.telegram) : null,
            g.ember_candidates,
            g.plan ? JSON.stringify(g.plan.steps) : null,
            g.version,
            g.created_at,
            g.state_since,
            g.plan?.deadline_at ?? null,
            g.plan?.start_at ?? null,
            expires,
          ],
        );
        // The host is always in the set and is not an answer row (docs/engine/01-algorithm.md 6.1).
        for (const e of made.effects) {
          if (e.type === "schedule") await scheduleJob(q, g.id, e.job, e.at, expires);
          else if (e.type === "counter") await applyCounter(q, groupId, e);
        }
        await q.query("update groups set last_gathering_at = $2 where id = $1", [groupId, now]);
        return loadRow(q, b.id);
      });
      if (!created) throw new ApiError(404, "not_found", "No such gathering");
      const answers = await loadAnswers(db, b.id);
      if (ctx.effects.created && created.telegram_plain)
        await ctx.effects.created(notifyOf(ctx, created, answers, now)).catch(() => {
          log.warn({ event: "effect.failed", effect: "created" }, "effect failed");
        });
      return { status: 201, body: toView(ctx, created, answers, now) };
    });
  });

  // The shared view. Anyone with the 122-bit id may read it (counts and sealed data only).
  app.get("/api/v1/gatherings/:gatheringId", async (c) => {
    const db = needDb(ctx);
    const row = await loadRow(db, gid(c));
    if (!row) throw new ApiError(404, "not_found", "No such gathering");
    if (row.state === "gone") throw goneError(row);
    const view = toView(ctx, row, await loadAnswers(db, row.id), ctx.clock.now());
    c.header("etag", `"${row.version}"`);
    c.header("cache-control", "no-store");
    return c.json(view);
  });

  app.get("/api/v1/gatherings/:gatheringId/events", async (c) => {
    const db = needDb(ctx);
    const id = gid(c);
    const row = await loadRow(db, id);
    if (!row) throw new ApiError(404, "not_found", "No such gathering");
    if (row.state === "gone") throw goneError(row);
    const last = Number(c.req.header("last-event-id") ?? "");
    c.header("cache-control", "no-store");
    c.header("x-accel-buffering", "no");
    return streamSSE(c, async (stream) => {
      let closed = false;
      const queue: (() => Promise<void>)[] = [];
      let busy = false;
      const pump = async () => {
        if (busy) return;
        busy = true;
        while (queue.length && !closed) await queue.shift()?.();
        busy = false;
      };
      let sent = Number.isFinite(last) && last > 0 ? last : 0;
      let resolveDone: () => void = () => {};
      const done = new Promise<void>((r) => {
        resolveDone = r;
      });
      const finish = () => {
        if (closed) return;
        closed = true;
        unsub();
        clearInterval(keep);
        resolveDone();
      };
      const unsub = ctx.events.subscribe(id, (msg) => {
        queue.push(async () => {
          if (msg.type === "gathering") {
            if (msg.version <= sent) return;
            sent = msg.version;
            await stream.writeSSE({ event: "gathering", id: String(msg.version), data: JSON.stringify(msg.view) });
          } else if (msg.type === "remember") {
            await stream.writeSSE({ event: "remember", data: JSON.stringify(msg.state) });
          } else {
            await stream.writeSSE({ event: "gone", data: JSON.stringify({ id: msg.id, ended: msg.ended }) });
            finish();
          }
        });
        void pump();
      });
      const keep = setInterval(() => {
        queue.push(() => stream.write(": keepalive\n\n").then(() => {}));
        void pump();
      }, KEEPALIVE_MS);
      stream.onAbort(finish);
      if (row.version > sent) {
        const fresh = (await loadRow(db, id)) ?? row;
        sent = fresh.version;
        await stream.writeSSE({
          event: "gathering",
          id: String(fresh.version),
          data: JSON.stringify(toView(ctx, fresh, await loadAnswers(db, id), ctx.clock.now())),
        });
      }
      await done;
    });
  });

  app.put("/api/v1/gatherings/:gatheringId/photo", async (c) => {
    const { m, row } = await memberOf(c);
    if (row.host_member_id !== m.id) throw new ApiError(403, "not_host", "Host only");
    return write(c, ctx, rl, { member: m, gathering: row.id }, async () => {
      const len = Number(c.req.header("content-length") ?? "0");
      if (len > MAX_PHOTO_CT_BYTES) throw new ApiError(413, "too_large", "1.5 MB at most");
      const buf = Buffer.from(await c.req.arrayBuffer());
      if (buf.length === 0) throw new ApiError(400, "bad_request", "Empty photo");
      if (buf.length > MAX_PHOTO_CT_BYTES) throw new ApiError(413, "too_large", "1.5 MB at most");
      const db = needDb(ctx);
      const after = await db.tx(async (q) => {
        const r = await loadRow(q, row.id, true);
        if (!r) throw new ApiError(404, "not_found", "No such gathering");
        if (r.state === "gone") throw new ApiError(409, "wrong_state", "Ended");
        await q.query(
          `insert into photos (gathering_id, ct, expires_at) values ($1, $2, $3)
           on conflict (gathering_id) do update set ct = excluded.ct`,
          [row.id, buf, r.expires_at],
        );
        await q.query("update gatherings set version = version + 1 where id = $1", [row.id]);
        return loadRow(q, row.id);
      });
      if (after) publish(ctx, after, await loadAnswers(db, row.id), ctx.clock.now());
      return { status: 204, body: null };
    });
  });

  app.get("/api/v1/gatherings/:gatheringId/photo", async (c) => {
    const db = needDb(ctx);
    const id = gid(c);
    const row = await loadRow(db, id);
    if (!row) throw new ApiError(404, "not_found", "No such gathering");
    if (row.state === "gone") throw goneError(row);
    const p = (await db.query<{ ct: Uint8Array }>("select ct from photos where gathering_id = $1", [id])).rows[0];
    if (!p) throw new ApiError(404, "not_found", "No photo yet");
    return c.body(Buffer.from(p.ct), 200, {
      "content-type": "application/octet-stream",
      "cache-control": "private, max-age=3600, immutable",
    });
  });

  app.get("/api/v1/gatherings/:gatheringId/me", async (c) => {
    const { m, row } = await memberOf(c);
    if (row.state === "gone") throw goneError(row);
    return c.json(meView(row, await loadAnswers(needDb(ctx), row.id), m.id, ctx.clock.now()));
  });

  app.put("/api/v1/gatherings/:gatheringId/me", async (c) => {
    const now = ctx.clock.now();
    const { m, row } = await memberOf(c);
    return write(c, ctx, rl, { member: m, gathering: row.id }, async () => {
      const b = await body(c, AnswerBody);
      const rules = b.rules as Rule[];
      for (const r of rules)
        if (r.type === "with" && r.member_id === m.id) throw new ApiError(422, "unknown_member", "Not yourself");
      // SRS-RES-6: "Can't make it" only after Lit; before Lit the phone takes the yes back.
      if (b.answer === "cant_make_it") {
        const cur = await loadRow(needDb(ctx), row.id);
        if (cur?.state === "gone") throw goneError(cur);
        if (cur?.state !== "lit") throw new ApiError(409, "wrong_state", "Only after it's lit");
      }
      let out = await runEvent(
        ctx,
        row.id,
        { type: "answer", member_id: m.id, answer: b.answer, rules, ember_only: b.ember_only },
        now,
      );
      if (b.checks)
        out = await runEvent(ctx, row.id, { type: "checks", member_id: m.id, results: b.checks.results }, now);
      return { status: 200, body: meView(out.row, out.answers, m.id, ctx.clock.now()) };
    });
  });

  app.delete("/api/v1/gatherings/:gatheringId/me", async (c) => {
    const now = ctx.clock.now();
    const { m, row } = await memberOf(c);
    if (row.state === "gone") throw goneError(row);
    if (row.host_member_id === m.id) throw new ApiError(409, "wrong_state", "The host cancels instead");
    return write(c, ctx, rl, { member: m, gathering: row.id }, async () => {
      const out = await runEvent(ctx, row.id, { type: "take_back", member_id: m.id }, now);
      return { status: 200, body: meView(out.row, out.answers, m.id, ctx.clock.now()) };
    });
  });

  app.put("/api/v1/gatherings/:gatheringId/me/checks", async (c) => {
    const now = ctx.clock.now();
    const { m, row } = await memberOf(c);
    return write(c, ctx, rl, { member: m, gathering: row.id }, async () => {
      const b = await body(c, Checks);
      await runEvent(ctx, row.id, { type: "checks", member_id: m.id, results: b.results }, now);
      return { status: 204, body: null };
    });
  });

  app.post("/api/v1/gatherings/:gatheringId/text-yes", async (c) => {
    const now = ctx.clock.now();
    const { m, row } = await memberOf(c);
    if (row.host_member_id !== m.id) throw new ApiError(403, "not_host", "Host only");
    return write(c, ctx, rl, { member: m, gathering: row.id }, async () => {
      const b = await body(c, TextYes);
      if (b.code !== row.short_code) throw new ApiError(422, "code_mismatch", "That code is for another Flare");
      const out = await runEvent(ctx, row.id, { type: "text_yes" }, now);
      return { status: 200, body: toView(ctx, out.row, out.answers, ctx.clock.now()) };
    });
  });

  app.post(
    "/api/v1/gatherings/:gatheringId/fade",
    viewWrite((m) => ({ type: "fade", member_id: m.id })),
  );

  app.post("/api/v1/gatherings/:gatheringId/arrivals", async (c) => {
    const now = ctx.clock.now();
    const { m, row } = await memberOf(c);
    return write(c, ctx, rl, { member: m, gathering: row.id }, async () => {
      const b = await body(c, ArrivalBody);
      if (b.for !== "self" && row.host_member_id !== m.id) throw new ApiError(403, "not_host", "Host only");
      if (b.for === "member") {
        const ok = await needDb(ctx).query("select 1 from members where id = $1 and group_id = $2", [
          b.member_id,
          row.group_id,
        ]);
        if (!ok.rows.length) throw new ApiError(422, "unknown_member", "Not in this group");
      }
      // SRS-OFF-3, BR-H-5: an outbox tap counts only if it fell inside the Lit window.
      const tap = Date.parse(b.recorded_at);
      const inWindow =
        row.state === "lit" &&
        row.lit_at !== null &&
        tap >= row.lit_at.getTime() - 5_000 &&
        tap <= now.getTime() + 60_000;
      if (row.state === "gone") throw goneError(row);
      if (row.state !== "lit") throw new ApiError(409, "wrong_state", "Only while it's lit");
      if (!inWindow)
        return {
          status: 200,
          body: {
            gathering: toView(ctx, row, await loadAnswers(needDb(ctx), row.id), now),
            counted: false,
            spark_ticket: null,
          },
        };
      const who =
        b.for === "self"
          ? ({ for: "self" } as const)
          : b.for === "member"
            ? ({ for: "member", member_id: b.member_id as string } as const)
            : ({ for: "someone_else" } as const);
      const out = await runEvent(ctx, row.id, { type: "arrival", by: m.id, who, recorded_at: b.recorded_at }, now);
      const counted = (out.row.headcount ?? 1) > (out.before?.headcount ?? 1) || out.sparkTicket !== null;
      return {
        status: 200,
        body: {
          gathering: toView(ctx, out.row, out.answers, ctx.clock.now()),
          counted,
          spark_ticket: b.for === "self" ? out.sparkTicket : null,
        },
      };
    });
  });

  app.post(
    "/api/v1/gatherings/:gatheringId/done",
    viewWrite((m) => ({ type: "done", by: m.id })),
  );
  app.post(
    "/api/v1/gatherings/:gatheringId/cancel",
    viewWrite((m) => ({ type: "cancel", by: m.id })),
  );

  app.put("/api/v1/gatherings/:gatheringId/live-location", async (c) => {
    const { m, row } = await memberOf(c);
    if (row.host_member_id !== m.id) throw new ApiError(403, "not_host", "Host only");
    return write(c, ctx, rl, { member: m, gathering: row.id }, async () => {
      const b = await body(c, LiveLocation);
      await needDb(ctx).tx(async (q) => {
        const r = await loadRow(q, row.id, true);
        if (!r) throw new ApiError(404, "not_found", "No such gathering");
        if (r.state !== "lit") throw new ApiError(409, "wrong_state", "Only while it's lit");
        // Overwritten in place, no history (SRS-CMP-6).
        await q.query(
          `insert into live_locations (gathering_id, member_id, ct, at, expires_at) values ($1, $2, $3, $4, $5)
           on conflict (gathering_id, member_id) do update set ct = excluded.ct, at = excluded.at`,
          [row.id, m.id, unb64u(b.location_ct), ctx.clock.now(), r.expires_at],
        );
      });
      return { status: 204, body: null };
    });
  });

  app.get("/api/v1/gatherings/:gatheringId/live-location", async (c) => {
    const { m, row } = await memberOf(c);
    if (row.host_member_id !== m.id && !row.chosen_set.includes(m.id))
      throw new ApiError(403, "not_in_set", "For the people going");
    const l = (
      await needDb(ctx).query<{ ct: Uint8Array; at: Date }>(
        "select ct, at from live_locations where gathering_id = $1 and member_id = $2",
        [row.id, row.host_member_id],
      )
    ).rows[0];
    if (!l || row.state !== "lit") throw new ApiError(404, "not_found", "Not sharing");
    return c.json({ location_ct: b64u(l.ct), at: new Date(l.at).toISOString() });
  });

  app.delete("/api/v1/gatherings/:gatheringId/live-location", async (c) => {
    const { m, row } = await memberOf(c);
    if (row.host_member_id !== m.id) throw new ApiError(403, "not_host", "Host only");
    return write(c, ctx, rl, { member: m, gathering: row.id }, async () => {
      await needDb(ctx).query("delete from live_locations where gathering_id = $1", [row.id]);
      return { status: 204, body: null };
    });
  });
}
