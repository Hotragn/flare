// Gathering rows <-> ICD-1 types, the engine run inside one transaction, and the effects
// after commit (02-interface-control.md: "only BE executes them, after commit").
import { randomBytes } from "node:crypto";
import type { Answer, Effect, EngineEvent, Gathering, Id, Iso, JobKind } from "@flare/shared/icd/engine";
import type { Q } from "../db/db.ts";
import { ApiError, ENGINE_STATUS } from "../http/errors.ts";
import { sha256 } from "../http/middleware.ts";
import { log } from "../log.ts";
import type { Ctx, Notify } from "./deps.ts";
import { bumpLaunch, launchNameFor } from "./launch.ts";

export const b64u = (b: Uint8Array | null): string => (b ? Buffer.from(b).toString("base64url") : "");
export const unb64u = (s: string): Buffer => Buffer.from(s, "base64url");
const iso = (d: Date | string | null): Iso | null => (d ? new Date(d).toISOString() : null);

/** Seconds after Gone before the delete job runs (state machine F14). */
export const DELETE_AFTER_MS = 60_000;
/** BR-D-1: everything gone within 5 min of Gone; the sweeper uses this. */
export const GONE_GRACE_MS = 5 * 60_000;

export type GatheringRow = {
  id: string;
  group_id: string;
  kind: "flare" | "plan";
  state: Gathering["state"];
  short_code: string;
  host_member_id: string;
  quorum: number;
  tz: string;
  version: number;
  state_since: Date;
  ended: Gathering["ended"];
  sealed: Uint8Array;
  notice_ct: Uint8Array;
  telegram_plain: Record<string, unknown> | null;
  text_yes: number;
  ember_candidates: string[];
  ember_choice: string | null;
  plan_steps: { step: 1 | 2 | 3 | 4; minutes: number; place: string }[] | null;
  current_step: number | null;
  chosen_set: string[];
  created_at: Date;
  deadline_at: Date | null;
  start_at: Date | null;
  lit_at: Date | null;
  done_at: Date | null;
  headcount: number | null;
  expires_at: Date;
  group_size: number;
  has_photo: boolean;
};

type ResponseRow = {
  member_id: string;
  status: Answer["status"];
  ember_only: boolean;
  rules: Answer["rules"];
  spot_checks: Answer["checks"];
  checks_at: Date | null;
  faded: boolean;
  still_coming: boolean;
  arrived_at: Date | null;
};

const SELECT_G = `select g.*,
  (select count(*)::int from members m where m.group_id = g.group_id) as group_size,
  exists (select 1 from photos p where p.gathering_id = g.id) as has_photo
  from gatherings g where g.id = $1`;

export async function loadRow(q: Q, id: string, lock = false): Promise<GatheringRow | null> {
  // FOR UPDATE can't sit on a query with aggregates in the select list in every planner,
  // so lock the row first, then read it with its counts.
  if (lock) await q.query("select id from gatherings where id = $1 for update", [id]);
  const { rows } = await q.query<GatheringRow>(SELECT_G, [id]);
  return rows[0] ?? null;
}

export async function loadAnswers(q: Q, id: string): Promise<Answer[]> {
  const { rows } = await q.query<ResponseRow>(
    "select member_id, status, ember_only, rules, spot_checks, checks_at, faded, still_coming, arrived_at from responses where gathering_id = $1 order by member_id",
    [id],
  );
  return rows.map((r) => ({
    member_id: r.member_id,
    status: r.status,
    ember_only: r.ember_only,
    rules: r.rules ?? [],
    checks: r.spot_checks ?? {},
    checks_at: iso(r.checks_at),
    faded: r.faded,
    still_coming: r.still_coming,
    arrived_at: iso(r.arrived_at),
  }));
}

export function toIcd(r: GatheringRow): Gathering {
  return {
    id: r.id,
    group_id: r.group_id,
    kind: r.kind,
    state: r.state,
    host: r.host_member_id,
    group_size: r.group_size,
    quorum: r.quorum,
    version: r.version,
    created_at: iso(r.created_at) as Iso,
    state_since: iso(r.state_since) as Iso,
    lit_at: iso(r.lit_at),
    done_at: iso(r.done_at),
    ended: r.ended,
    ember_candidates: r.ember_candidates as Gathering["ember_candidates"],
    ember_choice: r.ember_choice as Gathering["ember_choice"],
    plan:
      r.kind === "plan" && r.start_at && r.deadline_at
        ? {
            start_at: iso(r.start_at) as Iso,
            deadline_at: iso(r.deadline_at) as Iso,
            steps: (r.plan_steps ?? []) as NonNullable<Gathering["plan"]>["steps"],
            current_step: (r.current_step ?? null) as NonNullable<Gathering["plan"]>["current_step"],
          }
        : null,
    chosen_set: r.chosen_set ?? [],
    text_yes: r.text_yes,
    headcount: r.headcount,
  };
}

/** The shared view (openapi Gathering). Counts and sealed data only; no member ids. */
export function toView(ctx: Ctx, r: GatheringRow, answers: Answer[], now: Date): Record<string, unknown> {
  const g = toIcd(r);
  const v = ctx.engine
    ? ctx.engine.view(g, answers, now.toISOString())
    : { need: Math.max(0, r.quorum - 1), next_change_at: null };
  return {
    id: r.id,
    group_id: r.group_id,
    kind: r.kind,
    state: r.state,
    quorum: r.quorum,
    need: r.state === "lit" || r.state === "gone" ? 0 : v.need,
    short_code: r.short_code,
    version: r.version,
    created_at: g.created_at,
    state_since: g.state_since,
    next_change_at: r.state === "gone" ? null : v.next_change_at,
    server_time: now.toISOString(),
    sealed: b64u(r.sealed),
    notice_ct: b64u(r.notice_ct),
    has_photo: r.has_photo,
    headcount: r.state === "lit" || r.state === "gone" ? r.headcount : null,
    ember_choice: r.ember_choice,
    plan: g.plan
      ? {
          start_at: g.plan.start_at,
          deadline_at: g.plan.deadline_at,
          current_step: g.plan.current_step,
          steps: g.plan.steps,
        }
      : null,
    ended: r.ended,
  };
}

/** 410 with the ending, so every phone shows the same last screen (SRS-ST-3). */
export function goneError(r: GatheringRow): ApiError {
  return new ApiError(410, "gone", "This gathering ended", {}, { ended: r.ended });
}

export function notifyOf(ctx: Ctx, r: GatheringRow, answers: Answer[], now: Date): Notify {
  const view = toView(ctx, r, answers, now);
  return {
    gatheringId: r.id,
    groupId: r.group_id,
    kind: r.kind,
    state: r.state,
    ended: r.ended,
    noticeCt: b64u(r.notice_ct),
    startAt: iso(r.start_at),
    need: view.need as number,
    headcount: r.headcount,
    telegram: r.telegram_plain,
  };
}

async function saveGathering(q: Q, g: Gathering): Promise<void> {
  await q.query(
    `update gatherings set state = $2, quorum = $3, version = $4, state_since = $5, lit_at = $6,
       done_at = $7, ended = $8, ember_choice = $9, current_step = $10, chosen_set = $11,
       text_yes = $12, headcount = $13
     where id = $1`,
    [
      g.id,
      g.state,
      g.quorum,
      g.version,
      g.state_since,
      g.lit_at,
      g.done_at,
      g.ended,
      g.ember_choice,
      g.plan?.current_step ?? null,
      g.chosen_set,
      g.text_yes,
      g.headcount,
    ],
  );
}

async function saveAnswers(q: Q, gid: string, answers: Answer[], expiresAt: Date): Promise<void> {
  const keep = answers.map((a) => a.member_id);
  await q.query("delete from responses where gathering_id = $1 and not (member_id = any($2::uuid[]))", [gid, keep]);
  for (const a of answers) {
    await q.query(
      `insert into responses (id, gathering_id, member_id, status, ember_only, rules, spot_checks, checks_at,
         faded, still_coming, arrived_at, expires_at)
       values (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       on conflict (gathering_id, member_id) do update set status = excluded.status,
         ember_only = excluded.ember_only, rules = excluded.rules, spot_checks = excluded.spot_checks,
         checks_at = excluded.checks_at, faded = excluded.faded, still_coming = excluded.still_coming,
         arrived_at = excluded.arrived_at`,
      [
        gid,
        a.member_id,
        a.status,
        a.ember_only,
        JSON.stringify(a.rules),
        JSON.stringify(a.checks),
        a.checks_at,
        a.faded,
        a.still_coming,
        a.arrived_at,
        expiresAt,
      ],
    );
  }
}

export async function scheduleJob(q: Q, gid: string, job: JobKind, at: Iso | Date, expiresAt: Date): Promise<void> {
  await q.query(
    `insert into jobs (id, gathering_id, kind, due_at, expires_at) values (gen_random_uuid(), $1, $2, $3, $4)
     on conflict (gathering_id, kind) do update set due_at = excluded.due_at`,
    [gid, job, new Date(at).toISOString(), expiresAt],
  );
}

export async function bump(q: Q, groupId: string, name: string, bucket = ""): Promise<void> {
  await q.query(
    `insert into counters (group_id, name, bucket, value) values ($1, $2, $3, 1)
     on conflict (group_id, name, bucket) do update set value = counters.value + 1`,
    [groupId, name, bucket],
  );
}

/** Value-carrying counters whose number rides in `bucket` (docs/engine/02-api.md section 3). */
const VALUE_IN_BUCKET: Record<string, "add" | "max"> = {
  headcount_sum: "add",
  lit_minutes_sum: "add",
  headcount_max: "max",
};

/**
 * ICD-1 v1.1 counter effect: `by` and `op` when present; otherwise the engine's 1.0 form,
 * where headcount_sum, lit_minutes_sum and headcount_max carry their number in `bucket`.
 */
/** "2026-W41": the ISO week a date falls in (UTC). */
export function isoWeek(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const year = t.getUTCFullYear();
  const week = Math.ceil(((t.getTime() - Date.UTC(year, 0, 1)) / 86_400_000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export async function applyCounter(
  q: Q,
  groupId: string,
  e: { name: string; bucket?: string; by?: number; op?: "add" | "max" },
): Promise<void> {
  const launch = launchNameFor(e.name);
  if (launch) await bumpLaunch(q, launch, groupId); // Since launch (core/launch.ts)
  let bucket = e.bucket ?? "";
  let by = e.by ?? 1;
  let op = e.op ?? "add";
  const legacy = VALUE_IN_BUCKET[e.name];
  if (legacy && e.by === undefined && /^\d+$/.test(bucket)) {
    by = Number(bucket);
    bucket = "";
    op = legacy;
  }
  if (!Number.isFinite(by) || by < 0) return;
  // Crew space: the week's outside minutes too, bucketed by ISO week (counts only, deleted
  // with the group). Lit-to-Gone minutes are the "outside together" time.
  if (e.name === "lit_minutes_sum")
    await q.query(
      `insert into counters (group_id, name, bucket, value) values ($1, 'lit_minutes_week', $2, $3)
       on conflict (group_id, name, bucket) do update set value = counters.value + excluded.value`,
      [groupId, isoWeek(new Date()), Math.round(by)],
    );
  await q.query(
    op === "max"
      ? `insert into counters (group_id, name, bucket, value) values ($1, $2, $3, $4)
         on conflict (group_id, name, bucket) do update set value = greatest(counters.value, excluded.value)`
      : `insert into counters (group_id, name, bucket, value) values ($1, $2, $3, $4)
         on conflict (group_id, name, bucket) do update set value = counters.value + excluded.value`,
    [groupId, e.name, bucket, Math.round(by)],
  );
}

export async function bumpGlobal(q: Q, name: string, bucket = ""): Promise<void> {
  await q.query(
    `insert into global_counters (name, bucket, value) values ($1, $2, 1)
     on conflict (name, bucket) do update set value = global_counters.value + 1`,
    [name, bucket],
  );
}

export type Outcome = {
  /** The row as it was under the lock, before the event. */
  before: GatheringRow | null;
  row: GatheringRow;
  answers: Answer[];
  sparkTicket: string | null;
  changed: boolean;
};

type Post = { before: GatheringRow; row: GatheringRow; answers: Answer[]; effects: Effect[]; members: Id[] };

/**
 * Runs one engine event on one gathering: lock the row, call the engine, store the result and
 * the database effects in the same transaction, then (after commit) SSE, push and Telegram.
 * `now` is the server receive time, taken before the lock (BR-F-2 race rule).
 */
export async function runEvent(
  ctx: Ctx,
  gid: string,
  ev: EngineEvent,
  now: Date,
  opts: { jobId?: string } = {},
): Promise<Outcome> {
  const db = ctx.db;
  const engine = ctx.engine;
  if (!db || !engine) throw new ApiError(503, "not_configured", "Database or engine not configured");
  let ticket: string | null = null;
  const post = await db.tx(async (q): Promise<Post | null> => {
    const row = await loadRow(q, gid, true);
    if (!row) throw new ApiError(404, "not_found", "No such gathering");
    if (opts.jobId) {
      // The job may have been replaced or removed while we waited for the lock.
      const j = await q.query("delete from jobs where id = $1 returning id", [opts.jobId]);
      if (!j.rows[0]) return null;
    }
    if (row.state === "gone") throw goneError(row);
    const answers = await loadAnswers(q, gid);
    const res = engine.transition(toIcd(row), answers, ev, now.toISOString());
    if (!res.ok) throw new ApiError(ENGINE_STATUS[res.error] ?? 409, res.error, "Not allowed now");
    if (res.gathering.version === row.version && res.effects.length === 0) return null;
    await saveGathering(q, res.gathering);
    await saveAnswers(q, gid, res.answers, row.expires_at);
    // Since launch: a yes counts once per person per Flare (a take-back and yes again doesn't add).
    const wasYes = new Set(answers.filter((a) => a.status === "yes").map((a) => a.member_id));
    const newYes = res.answers.filter((a) => a.status === "yes" && !wasYes.has(a.member_id)).length;
    if (newYes) await bumpLaunch(q, "yeses", row.group_id, newYes);
    const goneNow = res.gathering.state === "gone";
    for (const e of res.effects) {
      if (e.type === "schedule") await scheduleJob(q, gid, e.job, e.at, row.expires_at);
      else if (e.type === "unschedule")
        await q.query("delete from jobs where gathering_id = $1 and kind = $2", [gid, e.job]);
      else if (e.type === "counter") await applyCounter(q, row.group_id, e);
      else if (e.type === "spark_ticket" && !ticket) {
        const t = randomBytes(16).toString("base64url");
        // Outlives the gathering: 24 h after its storage expiry at the latest (BR-K-1).
        await q.query("insert into spark_tickets (token_hash, group_id, expires_at) values ($1, $2, $3)", [
          sha256(t),
          row.group_id,
          new Date(row.expires_at.getTime() + 24 * 3600_000),
        ]);
        ticket = t;
      }
    }
    if (goneNow) {
      // BR-D-1: drop what nobody needs after Gone at once; the rest goes with the delete job.
      await q.query("delete from live_locations where gathering_id = $1", [gid]);
      await q.query("delete from photos where gathering_id = $1", [gid]);
      await q.query("delete from telegram_binds where gathering_id = $1", [gid]);
      await q.query("delete from jobs where gathering_id = $1 and kind <> 'delete'", [gid]);
      await scheduleJob(q, gid, "delete", new Date(now.getTime() + DELETE_AFTER_MS), row.expires_at);
    }
    const after = await loadRow(q, gid);
    if (!after) throw new ApiError(404, "not_found", "No such gathering");
    const members = (
      await q.query<{ id: string }>("select id from members where group_id = $1 order by id", [row.group_id])
    ).rows.map((m) => m.id);
    return { before: row, row: after, answers: res.answers, effects: res.effects, members };
  });
  if (!post) {
    const row = await loadRow(db, gid);
    if (!row) throw new ApiError(404, "not_found", "No such gathering");
    return { before: row, row, answers: await loadAnswers(db, gid), sparkTicket: null, changed: false };
  }
  await afterCommit(ctx, post, now);
  return { before: post.before, row: post.row, answers: post.answers, sparkTicket: ticket, changed: true };
}

async function afterCommit(ctx: Ctx, p: Post, now: Date): Promise<void> {
  publish(ctx, p.row, p.answers, now);
  const n = notifyOf(ctx, p.row, p.answers, now);
  for (const e of p.effects) {
    try {
      if (e.type === "push" && ctx.effects.push) {
        const to = e.to === "all" ? p.members : e.to === "set" ? p.row.chosen_set : e.to;
        const eff: { event: string; label?: typeof e.label; step?: typeof e.step } = { event: e.event };
        if (e.label) eff.label = e.label;
        if (e.step) eff.step = e.step;
        await ctx.effects.push(eff, to, n);
      } else if (e.type === "telegram" && ctx.effects.telegram && p.row.telegram_plain) {
        await ctx.effects.telegram({ action: e.action }, n);
      }
    } catch {
      // A failed push or bot call never undoes the committed change; deletion runs regardless.
      log.warn({ event: "effect.failed", effect: e.type }, "effect failed");
    }
  }
}

export function publish(ctx: Ctx, row: GatheringRow, answers: Answer[], now: Date): void {
  const view = toView(ctx, row, answers, now);
  ctx.events.publish(row.id, { type: "gathering", version: row.version, view });
  if (row.state === "gone" && row.ended) ctx.events.publish(row.id, { type: "gone", id: row.id, ended: row.ended });
}
