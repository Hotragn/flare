// npm run sweep: one sweeper pass now (the server also runs it every 60 s). Prints counts only.
import { sweep } from "../core/sweep.ts";
import { openDb } from "./lib.ts";

const db = await openDb();
const t = performance.now();
const out = await sweep(db, new Date());
console.log(JSON.stringify({ step: "sweep", deleted: out, ms: Math.round(performance.now() - t) }));
await db.close();
