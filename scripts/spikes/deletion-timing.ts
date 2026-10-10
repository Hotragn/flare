// Spike E2: how fast does the sweep delete Gone gatherings, and is the 5-minute promise
// (BR-D-1) safe? Runs on PGlite (Postgres 17 compiled to WASM, single connection), which is
// slower than native Postgres, so the timings are an upper bound.
//
// Measures: sweep duration by batch size, the query plan with and without a partial index,
// the audit query, a timed run of the real sweep loop (scaled 10x faster), the expiry
// backstop, and that the cascade leaves 0 rows.
// Usage: node scripts/spikes/deletion-timing.ts [--gatherings 1000] [--photo-kb 150]
import { type Db, memoryDb, migrate } from "../../apps/server/src/db/db.ts";

const arg = (k: string, d: number) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? Number(process.argv[i + 1]) : d;
};
const N = arg("gatherings", 1000);
const PHOTO_KB = arg("photo-kb", 150);
const PER_GATHERING = ["photos", "responses", "jobs", "bot_messages", "live_locations", "telegram_binds"];

// The sweep the backend will ship (backend work package B6). Deletes in batches so one
// transaction never holds many rows; ON DELETE CASCADE removes the children.
export const SWEEP_SQL = `
  delete from gatherings where id in (
    select id from gatherings
    where (state = 'gone' and state_since < now() - $1::interval) or expires_at < now()
    limit $2
  ) returning id`;

async function sweep(db: Db, grace = "60 seconds", batch = 200): Promise<number> {
  let total = 0;
  for (;;) {
    const r = await db.query<{ id: string }>(SWEEP_SQL, [grace, batch]);
    total += r.rows.length;
    if (r.rows.length < batch) return total;
  }
}

async function seed(db: Db, n: number) {
  const t = performance.now();
  await db.query(`insert into groups (id) select gen_random_uuid() from generate_series(1, $1)`, [Math.ceil(n / 4)]);
  await db.query(`
    insert into members (id, group_id, name_ct, write_token_hash)
    select gen_random_uuid(), g.id, '\\x01', '\\x02' from groups g, generate_series(1, 12)`);
  await db.query(
    `
    insert into gatherings (id, group_id, kind, state, short_code, host_member_id, quorum, tz, sealed, notice_ct, expires_at)
    select gen_random_uuid(), g.id, 'flare', 'kindling', null, (select id from members m where m.group_id = g.id limit 1),
           2, 'America/Detroit', decode(repeat('ab', 8000), 'hex'), decode(repeat('cd', 1000), 'hex'), now() + interval '5 hours'
    from groups g, generate_series(1, 4) s limit $1`.replace("null", "upper(substr(md5(random()::text), 1, 5))"),
    [n],
  );
  await db.query(`insert into photos select id, decode(repeat('ef', $1), 'hex'), expires_at from gatherings`, [
    PHOTO_KB * 1024,
  ]);
  await db.query(`
    insert into responses (id, gathering_id, member_id, status, expires_at)
    select gen_random_uuid(), g.id, m.id, 'yes', g.expires_at from gatherings g join members m on m.group_id = g.group_id`);
  await db.query(`
    insert into jobs select gen_random_uuid(), id, k, now() + interval '30 minutes', expires_at
    from gatherings, unnest(array['ember', 'gone', 'delete']) k`);
  await db.query(
    `insert into bot_messages select id, -100, row_number() over () * 2 + s, expires_at from gatherings, generate_series(0, 1) s`,
  );
  await db.query(
    `insert into live_locations (gathering_id, member_id, ct, expires_at) select id, host_member_id, '\\x05', expires_at from gatherings`,
  );
  await db.query(
    `insert into telegram_binds select decode(md5(id::text), 'hex'), id, host_member_id, expires_at from gatherings`,
  );
  return Math.round(performance.now() - t);
}

const count = async (db: Db, t: string) =>
  (await db.query<{ n: number }>(`select count(*)::int as n from ${t}`)).rows[0]?.n ?? 0;
const time = async <T>(f: () => Promise<T>) => {
  const t = performance.now();
  const v = await f();
  return { v, ms: Math.round((performance.now() - t) * 10) / 10 };
};

const db = await memoryDb();
await migrate(db);
const seedMs = await seed(db, N);
const rows: Record<string, number> = {};
for (const t of ["gatherings", ...PER_GATHERING]) rows[t] = await count(db, t);
console.log(JSON.stringify({ step: "seed", gatherings: N, photoKB: PHOTO_KB, ms: seedMs, rows }));

// 1. Sweep duration by number of Gone gatherings.
for (const k of [1, 10, 100, 250]) {
  await db.query(
    `update gatherings set state = 'gone', state_since = now() - interval '2 minutes'
     where id in (select id from gatherings where state <> 'gone' limit $1)`,
    [k],
  );
  const { v, ms } = await time(() => sweep(db));
  console.log(
    JSON.stringify({
      step: "sweep",
      gone: k,
      deleted: v,
      ms,
      perGatheringMs: Math.round((ms / Math.max(v, 1)) * 100) / 100,
    }),
  );
}

// 2. Query plans.
const plan = async () =>
  (
    await db.query<{ "QUERY PLAN": string }>(
      `explain ${SWEEP_SQL.replace("$1::interval", "'60 seconds'::interval").replace("$2", "200")}`,
    )
  ).rows
    .map((r) => r["QUERY PLAN"])
    .join(" | ");
await db.query("analyze");
const planBefore = await plan();
await db.query("create index gatherings_gone on gatherings(state_since) where state = 'gone'");
await db.query("analyze");
const planAfter = await plan();
console.log(
  JSON.stringify({
    step: "plan",
    withoutPartialIndex: planBefore.slice(0, 260),
    withPartialIndex: planAfter.slice(0, 260),
  }),
);
await db.query(
  `update gatherings set state = 'gone', state_since = now() - interval '2 minutes' where id in (select id from gatherings where state <> 'gone' limit 100)`,
);
const idx = await time(() => sweep(db));
console.log(JSON.stringify({ step: "sweep with partial index", deleted: idx.v, ms: idx.ms }));

// 3. Audit query over every per-gathering table.
const auditSql = ["gatherings", ...PER_GATHERING]
  .map(
    (t) =>
      `select '${t}' as t, count(*) filter (where expires_at < now())::int as expired, count(*)::int as total from ${t}`,
  )
  .join(" union all ");
const audit = await time(() => db.query(auditSql));
console.log(JSON.stringify({ step: "audit", ms: audit.ms, rows: audit.v.rows }));

// 4. Expiry backstop: the engine "forgot" to end these; expires_at is past.
await db.query(
  `update gatherings set expires_at = now() - interval '1 second' where id in (select id from gatherings where state <> 'gone' limit 20)`,
);
const back = await time(() => sweep(db));
console.log(JSON.stringify({ step: "expiry backstop", deleted: back.v, ms: back.ms }));

// 5. Timed loop, scaled 10x: grace 6 s, interval 3 s (production: 60 s and 30 s).
// 40 gatherings go Gone at random times over 20 s; we record Gone -> deleted.
const goneAt = new Map<string, number>();
const deletedAt = new Map<string, number>();
const ids = (await db.query<{ id: string }>("select id from gatherings where state <> 'gone' limit 40")).rows.map(
  (r) => r.id,
);
const t0 = Date.now();
const loop = setInterval(async () => {
  const r = await db.query<{ id: string }>(SWEEP_SQL, ["6 seconds", 200]);
  for (const x of r.rows) if (goneAt.has(x.id)) deletedAt.set(x.id, Date.now());
}, 3000);
await Promise.all(
  ids.map(async (id, i) => {
    await new Promise((r) => setTimeout(r, (i / ids.length) * 20_000));
    await db.query("update gatherings set state = 'gone', state_since = now() where id = $1", [id]);
    goneAt.set(id, Date.now());
  }),
);
while (deletedAt.size < ids.length && Date.now() - t0 < 60_000) await new Promise((r) => setTimeout(r, 200));
clearInterval(loop);
const delays = ids
  .map((id) => ((deletedAt.get(id) ?? Number.NaN) - (goneAt.get(id) ?? 0)) / 1000)
  .sort((a, b) => a - b);
console.log(
  JSON.stringify({
    step: "timed loop (scaled 10x)",
    gatherings: ids.length,
    deleted: deletedAt.size,
    minS: delays[0],
    medianS: delays[Math.floor(delays.length / 2)],
    maxS: delays.at(-1),
    boundS: 6 + 3,
    productionMaxS: Math.round((delays.at(-1) ?? 0) * 10),
  }),
);

// 6. Cascade leaves nothing for swept gatherings.
const orphans: Record<string, number> = {};
for (const t of PER_GATHERING)
  orphans[t] =
    (
      await db.query<{ n: number }>(
        `select count(*)::int as n from ${t} c where not exists (select 1 from gatherings g where g.id = c.gathering_id)`,
      )
    ).rows[0]?.n ?? 0;
console.log(JSON.stringify({ step: "orphans after all sweeps", orphans }));
await db.close();
