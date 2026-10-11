// npm run audit:logs -- <exported-log-file>
// DS12 check: an exported server log must hold no UUID and no short code (BR-D-6).
// Prints counts and line numbers only. Exit 0 when both are 0.

import fs from "node:fs";
import { scanLog } from "../core/report.ts";
import { out } from "./out.ts";

const file = process.argv[2];
if (!file || !fs.existsSync(file)) {
  console.error("usage: npm run audit:logs -- <exported-log-file>");
  process.exit(2);
}
const r = scanLog(fs.readFileSync(file, "utf8"));
out(JSON.stringify({ lines: r.lines, uuids: r.uuids, short_codes: r.codes, first_lines: r.at }));
const pass = r.uuids === 0 && r.codes === 0;
out(pass ? "PASS 0 ids and 0 short codes" : "FAIL ids or short codes found");
process.exit(pass ? 0 : 1);
