// npm run sweep: one sweeper pass now (the server also runs it every 60 s). Prints counts only.
import { sweep } from "../core/sweep.ts";
import { openDb } from "./lib.ts";
import { out } from "./out.ts";

const db = await openDb();
const t = performance.now();
const deleted = await sweep(db, new Date());
out(JSON.stringify({ step: "sweep", deleted, ms: Math.round(performance.now() - t) }));
await db.close();
