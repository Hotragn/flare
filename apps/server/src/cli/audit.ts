// npm run audit -- <gatheringId | all>
// Proves nothing is left behind (BR-D-7). With an id: rows that still name it in every
// per-gathering table (pass = all 0). With "all" (default): the store audit (pass = 0 expired).
// Exit code 0 on pass, 1 on fail. Prints counts only, never row contents.
import { audit, auditGathering } from "../core/sweep.ts";
import { isUuid } from "../http/middleware.ts";
import { openDb } from "./lib.ts";

const arg = process.argv[2] ?? "all";
if (arg !== "all" && !isUuid(arg)) {
  console.error("usage: npm run audit -- <gatheringId | all>");
  process.exit(2);
}
const db = await openDb();
let pass: boolean;
if (arg === "all") {
  const a = await audit(db, new Date());
  for (const s of a.stores)
    console.log(
      `${s.store.padEnd(8)} ${s.table.padEnd(26)} ${s.per_gathering ? "per-gathering" : "survives     "} total ${String(s.total_rows).padStart(6)}  expired ${s.expired_rows}`,
    );
  pass = a.pass;
  console.log(pass ? "PASS every per-gathering store has 0 expired rows" : "FAIL expired rows remain");
} else {
  const rows = await auditGathering(db, arg.toLowerCase());
  for (const r of rows) console.log(`${r.table.padEnd(16)} ${r.rows}`);
  pass = rows.every((r) => r.rows === 0);
  console.log(pass ? "PASS 0 rows left for this gathering" : "FAIL rows left");
}
await db.close();
process.exit(pass ? 0 : 1);
