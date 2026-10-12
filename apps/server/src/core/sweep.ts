// The sweeper (spike E2) and the deletion audit (BR-D-7). The sweeper is the safety net under
// the delete job: it removes every row past its storage expiry, Gone gatherings older than
// 5 min, and the long-lived stores past their retention (BR-D-5). See docs/backend/03-deletion.md.
import type { Q } from "../db/db.ts";

const DAY = 24 * 3600_000;
export const GONE_GRACE_MS = 5 * 60_000; // BR-D-1
export const PUSH_DAYS = 30; // BR-D-5
export const SPARK_DAYS = 180; // BR-D-5
export const GROUP_DAYS = 180; // 06-erd: groups, 180 days without a gathering

export type SweepResult = Record<string, number>;

/** One pass. Order: gatherings first (cascade), then orphans by their own expiry. */
export async function sweep(db: Q, now: Date): Promise<SweepResult> {
  const t = now.toISOString();
  const graceCut = new Date(now.getTime() - GONE_GRACE_MS).toISOString();
  const pushCut = new Date(now.getTime() - PUSH_DAYS * DAY).toISOString();
  const sparkCut = new Date(now.getTime() - SPARK_DAYS * DAY).toISOString();
  const groupCut = new Date(now.getTime() - GROUP_DAYS * DAY).toISOString();
  const n = async (sql: string, p: unknown[]) => (await db.query(`${sql} returning 1`, p)).rows.length;
  const out: SweepResult = {};
  // Uses the partial index gatherings_gone for the Gone half (spike E2).
  out.gatherings = await n("delete from gatherings where (state = 'gone' and state_since < $2) or expires_at < $1", [
    t,
    graceCut,
  ]);
  for (const table of ["photos", "responses", "jobs", "bot_messages", "live_locations", "telegram_binds"])
    out[table] = await n(`delete from ${table} where expires_at < $1`, [t]);
  out.spark_tickets = await n("delete from spark_tickets where expires_at < $1", [t]);
  out.telegram_links = await n("delete from telegram_links where expires_at < $1", [t]);
  out.idempotency = await n("delete from idempotency where expires_at < $1", [t]);
  const idle = "group_id in (select id from groups where coalesce(last_gathering_at, created_at) < $1)";
  out.push_subscriptions = await n(
    `delete from push_subscriptions where member_id in (select id from members where ${idle})`,
    [pushCut],
  );
  out.telegram_map = (
    await db.query(
      `update members set telegram_user_id = null where telegram_user_id is not null and ${idle} returning 1`,
      [pushCut],
    )
  ).rows.length;
  out.sparks = await n(`delete from sparks where ${idle}`, [sparkCut]);
  out.hotspots = await n(`delete from hotspots where ${idle}`, [sparkCut]);
  // A group with no gathering for 180 days goes with everything in it (cascade).
  out.groups = await n("delete from groups where coalesce(last_gathering_at, created_at) < $1", [groupCut]);
  return out;
}

export type AuditStore = {
  store: string;
  table: string;
  per_gathering: boolean;
  total_rows: number;
  expired_rows: number;
};

/** Every store in the data dictionary with its "should be gone by now" condition. */
const STORES: { store: string; table: string; per: boolean; total: string; expired: string }[] = [
  {
    store: "DS1",
    table: "gatherings",
    per: true,
    total: "select count(*)::int as n from gatherings",
    expired: "select count(*)::int as n from gatherings where expires_at < $1 or (state = 'gone' and state_since < $2)",
  },
  ...["responses:DS2", "photos:DS3", "jobs:DS4", "bot_messages:DS7", "telegram_binds:DS7", "live_locations:DS11"].map(
    (x) => {
      const [table, store] = x.split(":") as [string, string];
      return {
        store,
        table,
        per: true,
        total: `select count(*)::int as n from ${table}`,
        // Expired, or orphaned past the Gone grace (its gathering is Gone for over 5 min).
        expired: `select count(*)::int as n from ${table} t where t.expires_at < $1
          or exists (select 1 from gatherings g where g.id = t.gathering_id and g.state = 'gone' and g.state_since < $2)`,
      };
    },
  ),
  // ADR-0031: Remember this. No expiry of their own: they go with their gathering (cascade).
  ...["remember", "remember_consent"].map((table) => ({
    store: "DS12",
    table,
    per: true,
    total: `select count(*)::int as n from ${table}`,
    expired: `select count(*)::int as n from ${table} t where exists (select 1 from gatherings g
      where g.id = t.gathering_id and (g.expires_at < $1 or (g.state = 'gone' and g.state_since < $2)))`,
  })),
  {
    store: "DS5",
    table: "groups",
    per: false,
    total: "select count(*)::int as n from groups",
    expired: "select count(*)::int as n from groups where coalesce(last_gathering_at, created_at) < $3",
  },
  {
    store: "DS5",
    table: "members",
    per: false,
    total: "select count(*)::int as n from members",
    expired:
      "select count(*)::int as n from members m join groups g on g.id = m.group_id where coalesce(g.last_gathering_at, g.created_at) < $3",
  },
  {
    store: "DS6",
    table: "push_subscriptions",
    per: false,
    total: "select count(*)::int as n from push_subscriptions",
    expired:
      "select count(*)::int as n from push_subscriptions p join members m on m.id = p.member_id join groups g on g.id = m.group_id where coalesce(g.last_gathering_at, g.created_at) < $4",
  },
  {
    store: "DS7",
    table: "members.telegram_user_id",
    per: false,
    total: "select count(*)::int as n from members where telegram_user_id is not null",
    expired:
      "select count(*)::int as n from members m join groups g on g.id = m.group_id where m.telegram_user_id is not null and coalesce(g.last_gathering_at, g.created_at) < $4",
  },
  {
    store: "DS8",
    table: "sparks",
    per: false,
    total: "select count(*)::int as n from sparks",
    expired:
      "select count(*)::int as n from sparks s join groups g on g.id = s.group_id where coalesce(g.last_gathering_at, g.created_at) < $3",
  },
  {
    store: "DS8",
    table: "spark_tickets",
    per: false,
    total: "select count(*)::int as n from spark_tickets",
    expired: "select count(*)::int as n from spark_tickets where expires_at < $1",
  },
  {
    store: "DS9",
    table: "hotspots",
    per: false,
    total: "select count(*)::int as n from hotspots",
    expired:
      "select count(*)::int as n from hotspots h join groups g on g.id = h.group_id where coalesce(g.last_gathering_at, g.created_at) < $3",
  },
  {
    store: "DS10",
    table: "counters",
    per: false,
    total: "select count(*)::int as n from counters",
    expired: "select 0 as n",
  },
  {
    store: "DS7",
    table: "telegram_links",
    per: false,
    total: "select count(*)::int as n from telegram_links",
    expired: "select count(*)::int as n from telegram_links where expires_at < $1",
  },
  {
    store: "SRS-IF-1",
    table: "idempotency",
    per: false,
    total: "select count(*)::int as n from idempotency",
    expired: "select count(*)::int as n from idempotency where expires_at < $1",
  },
];

/** BR-D-7. Passing means 0 expired rows in every per-gathering store. */
export async function audit(db: Q, now: Date): Promise<{ at: string; pass: boolean; stores: AuditStore[] }> {
  const p = [
    now.toISOString(),
    new Date(now.getTime() - GONE_GRACE_MS).toISOString(),
    new Date(now.getTime() - SPARK_DAYS * DAY).toISOString(),
    new Date(now.getTime() - PUSH_DAYS * DAY).toISOString(),
  ];
  const stores: AuditStore[] = [];
  for (const s of STORES) {
    const total = (await db.query<{ n: number }>(s.total)).rows[0]?.n ?? 0;
    // Every query gets all four cut-offs, typed, so unused ones don't break parameter typing.
    const typed = `select x.n from (${s.expired}) x,
      (select $1::timestamptz a, $2::timestamptz b, $3::timestamptz c, $4::timestamptz d) p`;
    const expired = (await db.query<{ n: number }>(typed, p)).rows[0]?.n ?? 0;
    stores.push({ store: s.store, table: s.table, per_gathering: s.per, total_rows: total, expired_rows: expired });
  }
  return { at: now.toISOString(), pass: stores.every((s) => !s.per_gathering || s.expired_rows === 0), stores };
}

/** Rows that still name one gathering id, in every per-gathering table. After deletion: all 0. */
export async function auditGathering(db: Q, gatheringId: string): Promise<{ table: string; rows: number }[]> {
  const out: { table: string; rows: number }[] = [];
  out.push({
    table: "gatherings",
    rows: (await db.query<{ n: number }>("select count(*)::int as n from gatherings where id = $1", [gatheringId]))
      .rows[0]?.n as number,
  });
  for (const t of [
    "responses",
    "photos",
    "jobs",
    "bot_messages",
    "telegram_binds",
    "live_locations",
    "remember",
    "remember_consent",
  ])
    out.push({
      table: t,
      rows: (
        await db.query<{ n: number }>(`select count(*)::int as n from ${t} where gathering_id = $1`, [gatheringId])
      ).rows[0]?.n as number,
    });
  return out;
}
