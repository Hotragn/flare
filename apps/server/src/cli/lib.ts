// Shared by the CLIs: open the database named by DATABASE_URL (never printed) and migrate.
import { type Db, migrate, pgDb } from "../db/db.ts";
import { env } from "../env.ts";

export async function openDb(): Promise<Db> {
  if (!env.databaseUrl) {
    console.error("DATABASE_URL is not set (npm run check-env server shows set/missing).");
    process.exit(2);
  }
  const db = await pgDb(env.databaseUrl);
  await migrate(db);
  return db;
}
