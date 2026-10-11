// Pure functions behind `npm run kpi` (docs/product/07-kpis.md) and `npm run audit:logs`
// (DS12: an exported log must hold no UUID and no short code).
import type { Q } from "../db/db.ts";

export type Totals = Record<string, number>;

/** Sums every group counter by name (and bucket, as name[bucket]) plus the global counters. */
export async function counterTotals(db: Q): Promise<{ groups: number; totals: Totals; global: Totals }> {
  const totals: Totals = {};
  for (const r of (
    await db.query<{ name: string; bucket: string; sum: string; max: string }>(
      "select name, bucket, sum(value)::text as sum, max(value)::text as max from counters group by name, bucket",
    )
  ).rows) {
    const key = r.bucket ? `${r.name}[${r.bucket}]` : r.name;
    totals[key] = r.name === "headcount_max" ? Number(r.max) : Number(r.sum);
  }
  const global: Totals = {};
  for (const r of (
    await db.query<{ name: string; bucket: string; value: string }>(
      "select name, bucket, value::text from global_counters",
    )
  ).rows)
    global[r.bucket ? `${r.name}[${r.bucket}]` : r.name] = Number(r.value);
  const groups =
    (await db.query<{ n: number }>("select count(distinct group_id)::int as n from counters")).rows[0]?.n ?? 0;
  return { groups, totals, global };
}

const ratio = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 1000 : null);

/** KPI 1 to 3 and Plan outcomes from the counters. Ratios are null when the base is 0. */
export function kpis(t: Totals) {
  const v = (k: string) => t[k] ?? 0;
  const created = v("flares_created");
  const lit = v("flares_lit") + v("embers_lit");
  return {
    flares_created: created,
    headcount: {
      sum: v("headcount_sum"),
      max: v("headcount_max"),
      lit_flares: lit,
      mean: ratio(v("headcount_sum"), lit),
    },
    light_rate: { value: ratio(lit, created), direct: ratio(v("flares_lit"), created), n: created },
    ember_save_rate: { value: ratio(v("embers_lit"), v("embers")), embers: v("embers"), embers_lit: v("embers_lit") },
    lit_minutes_sum: v("lit_minutes_sum"),
    plans: {
      created: v("plans_created"),
      fades: v("plan_fades"),
      lit_step: [1, 2, 3, 4].map((n) => v(`plans_lit_step[${n}]`)),
    },
    sparks_left: v("sparks_left"),
  };
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const CODE = /(?<![A-Za-z0-9])[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{5}(?![A-Za-z0-9])/g;

/** Finds UUIDs and short codes in a log. Returns counts and line numbers, never the values. */
export function scanLog(text: string): { lines: number; uuids: number; codes: number; at: number[] } {
  let uuids = 0;
  let codes = 0;
  const at: number[] = [];
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    const u = line.match(UUID)?.length ?? 0;
    const c = line.match(CODE)?.length ?? 0;
    if (u || c) at.push(i + 1);
    uuids += u;
    codes += c;
  });
  return { lines: lines.length, uuids, codes, at: at.slice(0, 50) };
}
