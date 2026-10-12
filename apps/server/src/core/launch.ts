// Since launch: six totals for the website, increment only. Nothing here holds an id, a name,
// a time per event or a group: one row per name. Groups made with the test header never count.
import type { Q } from "../db/db.ts";

export const LAUNCH_NAMES = ["flares_sent", "lit", "embers", "yeses", "crews", "deleted_on_time"] as const;
export type LaunchName = (typeof LAUNCH_NAMES)[number];
export const TEST_HEADER = "x-flare-test";

/** Engine counter names to launch totals. */
const FROM_ENGINE: Record<string, LaunchName> = {
  flares_created: "flares_sent",
  flares_lit: "lit",
  embers_lit: "lit",
  embers: "embers",
};
export const launchNameFor = (engineCounter: string): LaunchName | null => FROM_ENGINE[engineCounter] ?? null;

export async function bumpLaunch(q: Q, name: LaunchName, groupId: string | null, by = 1): Promise<void> {
  if (by <= 0) return;
  if (groupId) {
    const g = await q.query<{ is_test: boolean }>("select is_test from groups where id = $1", [groupId]);
    if (!g.rows[0] || g.rows[0].is_test) return;
  }
  await q.query(
    `insert into launch_counters (metric, value) values ($1, $2)
     on conflict (metric) do update set value = launch_counters.value + excluded.value`,
    [name, by],
  );
}

export type LaunchStats = { since: string } & Record<LaunchName, number>;

export async function launchStats(q: Q): Promise<LaunchStats> {
  const since = (await q.query<{ since: Date | string }>("select since from launch_meta where id = 1")).rows[0]?.since;
  const out = { since: new Date(since ?? 0).toISOString() } as LaunchStats;
  for (const n of LAUNCH_NAMES) out[n] = 0;
  for (const r of (await q.query<{ name: string; value: string }>("select metric as name, value::text from launch_counters"))
    .rows)
    if ((LAUNCH_NAMES as readonly string[]).includes(r.name)) out[r.name as LaunchName] = Number(r.value);
  return out;
}
