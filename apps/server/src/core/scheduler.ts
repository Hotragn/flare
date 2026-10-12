// Timers that survive restarts: every job is a row in `jobs`; a 1 s tick runs the due ones.
// After a crash the next boot's first tick runs anything overdue, in due order (SRS-REL-*).

import type { JobKind } from "@flare/shared/icd/engine";
import { ApiError } from "../http/errors.ts";
import { log } from "../log.ts";
import type { Ctx } from "./deps.ts";
import { runEvent } from "./gatherings.ts";
import { bumpLaunch } from "./launch.ts";
import { sweep } from "./sweep.ts";

type JobRow = { id: string; gathering_id: string; kind: JobKind };

/** Runs every job due at `now`. Returns how many ran. Safe to call from two places at once. */
export async function runDue(ctx: Ctx, now: Date, limit = 100): Promise<number> {
  const db = ctx.db;
  if (!db) return 0;
  const due = (
    await db.query<JobRow>("select id, gathering_id, kind from jobs where due_at <= $1 order by due_at, id limit $2", [
      now.toISOString(),
      limit,
    ])
  ).rows;
  let ran = 0;
  for (const j of due) {
    try {
      if (j.kind === "delete") {
        if (await deleteGathering(ctx, j.gathering_id, j.id)) ran++;
        continue;
      }
      const out = await runEvent(ctx, j.gathering_id, { type: "timer", job: j.kind }, now, { jobId: j.id });
      if (out.changed) ran++;
    } catch (e) {
      if (e instanceof ApiError && (e.code === "gone" || e.code === "not_found")) {
        // The gathering ended first; the job has no work. Remove it (cascade does at delete).
        await db.query("delete from jobs where id = $1", [j.id]);
        continue;
      }
      if (e instanceof ApiError) {
        // The engine refused the timer (state moved on): drop the job, the state is final.
        await db.query("delete from jobs where id = $1", [j.id]);
        log.info({ event: "job.refused", kind: j.kind, code: e.code }, "timer refused");
        continue;
      }
      log.error({ event: "job.failed", kind: j.kind }, "job failed; retried next tick");
    }
  }
  return ran;
}

/** F14: the delete job. One statement; ON DELETE CASCADE takes every per-gathering row. */
export async function deleteGathering(ctx: Ctx, gatheringId: string, jobId?: string): Promise<boolean> {
  const db = ctx.db;
  if (!db) return false;
  const r = await db.tx(async (q) => {
    if (jobId) {
      const j = await q.query("delete from jobs where id = $1 returning id", [jobId]);
      if (!j.rows[0]) return null;
    }
    const gone = (
      await q.query<{
        id: string;
        state: string;
        ended: "not_this_time" | "thanks_for_coming" | null;
        group_id: string;
      }>("delete from gatherings where id = $1 returning id, state, ended, group_id", [gatheringId])
    ).rows[0];
    if (gone) await bumpLaunch(q, "deleted_on_time", gone.group_id); // the delete job: 60 s after Gone
    return gone;
  });
  if (r) {
    ctx.events.publish(r.id, { type: "gone", id: r.id, ended: r.ended ?? "not_this_time" });
    log.info({ event: "gathering.deleted" }, "gathering deleted");
  }
  return !!r;
}

export type Scheduler = { stop(): void; tick(): Promise<void> };

/** Starts the 1 s job tick and the 60 s sweep. */
export function startScheduler(ctx: Ctx, opts: { tickMs?: number; sweepMs?: number } = {}): Scheduler {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runDue(ctx, ctx.clock.now());
    } catch {
      log.error({ event: "tick.failed" }, "scheduler tick failed");
    } finally {
      running = false;
    }
  };
  const t = setInterval(tick, opts.tickMs ?? 1000);
  const sweepNow = () => {
    if (!ctx.db) return;
    sweep(ctx.db, ctx.clock.now()).catch(() => log.error({ event: "sweep.failed" }, "sweep failed"));
  };
  const s = setInterval(sweepNow, opts.sweepMs ?? 60_000);
  t.unref();
  s.unref();
  void tick();
  // At boot too: on Render's free tier the server sleeps when idle, so anything that expired
  // while it slept is deleted the moment it wakes (BR-D-1; ADR-0005 amended).
  sweepNow();
  return {
    stop: () => {
      clearInterval(t);
      clearInterval(s);
    },
    tick,
  };
}
