// Database access (ADR-0004: PostgreSQL). One tiny interface so the server runs on
// node-postgres in production and on PGlite (Postgres compiled to WASM) in tests.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  close(): Promise<void>;
}

const MIGRATIONS = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");

export async function pgDb(url: string): Promise<Db> {
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({
    connectionString: url,
    max: 5,
    ssl: url.includes("localhost") ? false : { rejectUnauthorized: false },
  });
  return { query: (s, p) => pool.query(s, p as unknown[]) as never, close: () => pool.end() };
}

export async function memoryDb(): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite();
  return { query: (s, p) => db.query(s, p as unknown[]) as never, close: () => db.close() };
}

/** Applies every migrations/*.sql once, in name order, recorded in schema_migrations. */
export async function migrate(db: Db): Promise<string[]> {
  await db.query(
    "create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())",
  );
  const done = new Set(
    (await db.query<{ name: string }>("select name from schema_migrations")).rows.map((r) => r.name),
  );
  const applied: string[] = [];
  for (const f of fs
    .readdirSync(MIGRATIONS)
    .filter((x) => x.endsWith(".sql"))
    .sort()) {
    if (done.has(f)) continue;
    await db.query("begin");
    try {
      for (const stmt of fs
        .readFileSync(path.join(MIGRATIONS, f), "utf8")
        .split(/;\s*$/m)
        .filter((s) => s.trim()))
        await db.query(stmt);
      await db.query("insert into schema_migrations (name) values ($1)", [f]);
      await db.query("commit");
      applied.push(f);
    } catch (e) {
      await db.query("rollback");
      throw e;
    }
  }
  return applied;
}
