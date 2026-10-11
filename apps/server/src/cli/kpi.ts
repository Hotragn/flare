// npm run kpi: the KPIs in docs/product/07-kpis.md from the stored counters. Counts only.

import { counterTotals, kpis } from "../core/report.ts";
import { openDb } from "./lib.ts";
import { out } from "./out.ts";

const db = await openDb();
const c = await counterTotals(db);
out(
  JSON.stringify({ at: new Date().toISOString(), groups: c.groups, kpis: kpis(c.totals), tier_ran: c.global }, null, 2),
);
await db.close();
