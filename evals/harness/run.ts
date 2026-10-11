// npm run eval -- <task> [--tier hub|rules] [--limit n] [--parser path] [--strict]
// Tasks: photo, ladder, conditions, rest-loop, osm-tags, all. Model calls are sequential.
import { parseArgs } from "node:util";
import { MODEL, modelReady, warm } from "./ollama.ts";
import { allPass, type Report, writeReport } from "./report.ts";
import { runConditions } from "./tasks/conditions.ts";
import { runLadder } from "./tasks/ladder.ts";
import { runOsmTags } from "./tasks/osm-tags.ts";
import { runPhoto } from "./tasks/photo.ts";
import { runRestLoop } from "./tasks/rest-loop.ts";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    tier: { type: "string" },
    limit: { type: "string" },
    parser: { type: "string" },
    strict: { type: "boolean", default: false },
  },
});

const TASKS = ["photo", "ladder", "conditions", "rest-loop", "osm-tags"] as const;
type Task = (typeof TASKS)[number];
const DEFAULT_TIER: Record<Task, string> = {
  photo: "hub",
  ladder: "hub",
  conditions: "rules",
  "rest-loop": "rules",
  "osm-tags": "hub",
};
const MODEL_TIERS = new Set(["hub", "model"]);

const task = positionals[0] ?? "";
const list: Task[] = task === "all" ? [...TASKS] : TASKS.includes(task as Task) ? [task as Task] : [];
if (!list.length) {
  console.error(`usage: npm run eval -- <${TASKS.join("|")}|all> [--tier hub|rules] [--limit n] [--strict]`);
  process.exit(2);
}
const limit = values.limit ? Number(values.limit) : undefined;

let warmed = false;
let failed = false;
for (const t of list) {
  const tier = values.tier ?? DEFAULT_TIER[t];
  if (MODEL_TIERS.has(tier) && !warmed) {
    if (!(await modelReady())) {
      console.error(`Ollama model ${MODEL} not available; start Ollama or pass --tier rules`);
      process.exit(3);
    }
    const ms = await warm();
    console.info(`warm-up ${ms} ms (not counted)`);
    warmed = true;
  }
  let r: Report;
  if (t === "photo") r = await runPhoto(tier, limit);
  else if (t === "ladder") r = await runLadder(tier, limit);
  else if (t === "conditions") r = await runConditions(tier, values.parser);
  else if (t === "rest-loop") r = await runRestLoop(tier, values.parser, limit);
  else r = await runOsmTags(tier, limit);
  const out = writeReport(r);
  console.info(`\n${r.task} (${r.tier}) n=${r.n}${r.latency ? ` median ${r.latency.median_ms} ms` : ""}`);
  for (const b of r.bars) console.info(`  ${b.pass ? "pass" : "FAIL"}  ${b.name}: ${b.value} (target ${b.target})`);
  console.info(`  report: ${out}`);
  if (!allPass(r)) failed = true;
}
if (values.strict && failed) process.exit(1);
