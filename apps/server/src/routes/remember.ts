// Remember this (ADR-0031): a conversation note made only with everyone's consent, per Flare or
// Plan, off by default. The host turns it on; each person who said yes agrees on their own phone;
// any no or late joiner without consent keeps it off for everyone (core/remember.ts). When lit
// and everyone agreed, anyone can record up to 60 s on their phone; every phone shows the sign
// live and anyone can stop it for everyone. The audio goes once to ElevenLabs Scribe (speaker
// labels, no names) and is zero-filled; the transcript goes back to that phone, which seals it
// with the Flare key; Gemma on the hub writes one line (hub only, never the cloud). The server
// stores only the sealed note, deleted with the gathering at Gone.

import { enforceSummary } from "@flare/shared";
import type { Context, Hono } from "hono";
import { z } from "zod";
import type { Ctx } from "../core/deps.ts";
import { b64u, loadAnswers, loadRow, unb64u } from "../core/gatherings.ts";
import { loadRemember, RECORD_MAX_MS, rememberState } from "../core/remember.ts";
import { ApiError } from "../http/errors.ts";
import { body, limitWrite, type RateLimiter, requireMember } from "../http/middleware.ts";
import { needDb } from "../http/write.ts";
import { MAX_REMEMBER_AUDIO_BYTES, SPARK_AUDIO_TYPES } from "../voice.ts";
import { groupParam } from "./groups.ts";

const MAX_NOTE_BYTES = 24_000;

export function mountRemember(app: Hono, ctx: Ctx, rl: RateLimiter): void {
  const gid = (c: Context) => groupParam(c.req.param("gatheringId"));
  app.use("/api/v1/gatherings/:gatheringId/remember/*", async (c, next) => {
    if (!ctx.rememberThis) throw new ApiError(404, "not_found", "No such route");
    await next();
  });

  async function context(c: Context) {
    // Parked behind REMEMBER_THIS=1 (ADR-0031): off, the routes don't exist for the phones.
    if (!ctx.rememberThis) throw new ApiError(404, "not_found", "No such route");
    const db = needDb(ctx);
    const m = await requireMember(c, db);
    const row = await loadRow(db, gid(c));
    if (!row || row.group_id !== m.group_id) throw new ApiError(404, "not_found", "No such gathering");
    if (row.state === "gone") throw new ApiError(410, "gone", "This gathering ended");
    if (c.req.method !== "GET") limitWrite(rl, { member: m.id, gathering: row.id }); // per person and per Flare
    const answers = await loadAnswers(db, row.id);
    const r = await loadRemember(db, row.id);
    const state = rememberState({
      on: r.row.on_by_host,
      lit: row.state === "lit",
      yes: answers.filter((a) => a.status === "yes").map((a) => a.member_id),
      consent: r.consent,
      recordingUntil: r.row.recording_until ? r.row.recording_until.getTime() : null,
      now: ctx.clock.now().getTime(),
    });
    return { db, m, row, r, state, isHost: row.host_member_id === m.id };
  }
  const publicState = (x: Awaited<ReturnType<typeof context>>) => ({ ...x.state, has_note: !!x.r.row.note_ct });
  async function publish(c: Context) {
    const x = await context(c);
    ctx.events.publish(x.row.id, { type: "remember", state: publicState(x) });
    return x;
  }
  const upsert = (x: Awaited<ReturnType<typeof context>>, set: string, args: unknown[]) =>
    x.db
      .query(`insert into remember (gathering_id) values ($1) on conflict (gathering_id) do nothing;`, [x.row.id])
      .then(() =>
        x.db.query(`update remember set ${set}, updated_at = now() where gathering_id = $1`, [x.row.id, ...args]),
      );

  // Never who said no: the answer has flags and this phone's own choice, nothing else.
  app.get("/api/v1/gatherings/:gatheringId/remember", async (c) => {
    const x = await context(c);
    c.header("cache-control", "no-store");
    return c.json({
      ...publicState(x),
      my_ok: x.isHost ? x.state.on : (x.r.consent.get(x.m.id) ?? null),
      is_host: x.isHost,
      note_ct: x.r.row.note_ct ? b64u(x.r.row.note_ct) : null,
    });
  });

  app.put("/api/v1/gatherings/:gatheringId/remember", async (c) => {
    const b = await body(c, z.object({ on: z.boolean() }).strict());
    const x = await context(c);
    if (!x.isHost) throw new ApiError(403, "forbidden", "Only the host turns this on");
    await upsert(x, b.on ? "on_by_host = true" : "on_by_host = false, recording_until = null", []);
    if (!b.on) await x.db.query("delete from remember_consent where gathering_id = $1", [x.row.id]);
    const y = await publish(c);
    return c.json(publicState(y));
  });

  app.put("/api/v1/gatherings/:gatheringId/remember/consent", async (c) => {
    const b = await body(c, z.object({ ok: z.boolean() }).strict());
    const x = await context(c);
    if (x.isHost) throw new ApiError(400, "bad_request", "The host agreed by turning it on");
    await x.db.query(
      `insert into remember_consent (gathering_id, member_id, ok) values ($1, $2, $3)
       on conflict (gathering_id, member_id) do update set ok = excluded.ok`,
      [x.row.id, x.m.id, b.ok],
    );
    if (!b.ok) await upsert(x, "recording_until = null", []); // a no stops any recording at once
    const y = await publish(c);
    return c.json(publicState(y));
  });

  app.post("/api/v1/gatherings/:gatheringId/remember/record", async (c) => {
    const b = await body(c, z.object({ action: z.enum(["start", "stop"]) }).strict());
    const x = await context(c);
    if (b.action === "start") {
      if (!x.state.ready) throw new ApiError(409, "not_ready", "Recording is off for this Flare");
      await upsert(x, "recording_until = $2", [new Date(ctx.clock.now().getTime() + RECORD_MAX_MS)]);
    } else await upsert(x, "recording_until = null", []); // anyone can stop it for everyone
    const y = await publish(c);
    return c.json(publicState(y));
  });

  // The audio goes once to Scribe and is zero-filled; nothing of it is kept.
  app.post("/api/v1/gatherings/:gatheringId/remember/transcribe", async (c) => {
    if (!ctx.voice) throw new ApiError(503, "not_configured", "Remember this needs ElevenLabs");
    const type = (c.req.header("content-type") ?? "").split(";")[0]?.trim() ?? "";
    if (!SPARK_AUDIO_TYPES.includes(type)) throw new ApiError(415, "not_audio", "Send audio");
    const buf = new Uint8Array(await c.req.arrayBuffer());
    try {
      if (buf.length === 0 || buf.length > MAX_REMEMBER_AUDIO_BYTES)
        throw new ApiError(413, "too_large", "60 seconds at most");
      const x = await context(c);
      if (!x.state.ready) throw new ApiError(409, "not_ready", "Recording is off for this Flare");
      const lines = await ctx.voice.conversation(buf, type);
      return c.json({ lines });
    } finally {
      buf.fill(0);
    }
  });

  // One line from Gemma on the hub. Hub only: with the hub off there is no summary.
  app.post("/api/v1/gatherings/:gatheringId/remember/summary", async (c) => {
    const b = await body(c, z.object({ text: z.string().min(1).max(4000) }).strict());
    const x = await context(c);
    if (!x.state.ready) throw new ApiError(409, "not_ready", "Recording is off for this Flare");
    const r = ctx.relay.status === "connected" ? await ctx.relay.summary?.(b.text, ctx.ladderTimeoutMs) : null;
    const line = r?.ok && r.summary ? enforceSummary(JSON.stringify({ line: r.summary })) : null;
    return c.json({ line, tier: line ? "hub" : "none" });
  });

  app.put("/api/v1/gatherings/:gatheringId/remember/note", async (c) => {
    const b = await body(
      c,
      z
        .object({
          note_ct: z
            .string()
            .min(1)
            .max(Math.ceil((MAX_NOTE_BYTES * 4) / 3) + 4),
        })
        .strict(),
    );
    const x = await context(c);
    if (!x.state.ready) throw new ApiError(409, "not_ready", "Recording is off for this Flare");
    await upsert(x, "note_ct = $2, recording_until = null", [unb64u(b.note_ct)]);
    const y = await publish(c);
    return c.json(publicState(y));
  });
}
