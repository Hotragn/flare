import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Db, memoryDb, migrate } from "../src/db/db.ts";

let db: Db;
beforeAll(async () => {
  db = await memoryDb();
});
afterAll(async () => db.close());

const PER_GATHERING = ["photos", "responses", "jobs", "bot_messages", "live_locations"];

describe("schema", () => {
  it("migrates once and is idempotent", async () => {
    expect(await migrate(db)).toEqual(["0001_init.sql"]);
    expect(await migrate(db)).toEqual([]);
  });
  it("has no column that could hold a readable place or coordinate (ADR-0009)", async () => {
    const cols = (
      await db.query<{ column_name: string }>(
        "select column_name from information_schema.columns where table_schema = 'public' and table_name not in ('schema_migrations', 'counters')",
      )
    ).rows.map((r) => r.column_name);
    for (const bad of ["lat", "lon", "latitude", "longitude", "spot", "place_name", "name"])
      expect(cols).not.toContain(bad);
  });
  it("deleting a gathering removes every per-gathering row (BR-D-1)", async () => {
    const g = "11111111-1111-4111-8111-111111111111";
    const m = "22222222-2222-4222-8222-222222222222";
    const gat = "33333333-3333-4333-8333-333333333333";
    await db.query("insert into groups (id) values ($1)", [g]);
    await db.query("insert into members (id, group_id, name_ct, write_token_hash) values ($1, $2, '\\x01', '\\x02')", [
      m,
      g,
    ]);
    await db.query(
      "insert into gatherings (id, group_id, kind, state, short_code, host_member_id, quorum, tz, sealed, expires_at) values ($1, $2, 'flare', 'kindling', 'K7Q2M', $3, 2, 'America/Detroit', '\\x03', now() + interval '5 hours')",
      [gat, g, m],
    );
    await db.query("insert into photos values ($1, '\\x04', null, now() + interval '5 hours')", [gat]);
    await db.query(
      "insert into responses (id, gathering_id, member_id, status, expires_at) values (gen_random_uuid(), $1, $2, 'yes', now() + interval '5 hours')",
      [gat, m],
    );
    await db.query("insert into jobs values (gen_random_uuid(), $1, 'ember', now(), now() + interval '5 hours')", [
      gat,
    ]);
    await db.query("insert into bot_messages values ($1, -100, 7, now() + interval '5 hours')", [gat]);
    await db.query(
      "insert into live_locations (gathering_id, member_id, ct, expires_at) values ($1, $2, '\\x05', now() + interval '5 hours')",
      [gat, m],
    );
    await db.query("delete from gatherings where id = $1", [gat]);
    for (const t of PER_GATHERING) {
      const n = (await db.query<{ n: number }>(`select count(*)::int as n from ${t}`)).rows[0]?.n;
      expect(n, t).toBe(0);
    }
  });
  it("allows only one live gathering per short code", async () => {
    const g = "11111111-1111-4111-8111-111111111111";
    const m = "22222222-2222-4222-8222-222222222222";
    const ins = (id: string) =>
      db.query(
        "insert into gatherings (id, group_id, kind, state, short_code, host_member_id, quorum, tz, sealed, expires_at) values ($1, $2, 'flare', 'kindling', 'ABCDE', $3, 2, 'UTC', '\\x00', now())",
        [id, g, m],
      );
    await ins("44444444-4444-4444-8444-444444444444");
    await expect(ins("55555555-5555-4555-8555-555555555555")).rejects.toThrow();
  });
});
