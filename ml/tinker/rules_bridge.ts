// Bridge for the Python side. Two modes, both read-only on app code:
//   node rules_bridge.ts parse  < texts.json      -> the app rules parser's answer per text
//   node rules_bridge.ts score  < predictions.json -> the eval scoring (same()) per prediction
// The parse mode builds the same context and mapping as evals/harness/tasks/conditions.ts.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "../../apps/web/src/lib/conditions/index.ts";
import { same } from "../../evals/harness/tasks/conditions.ts";

const REPO = join(import.meta.dirname, "..", "..");
const TZ = "America/Detroit";
const NOW = "2026-10-11T15:00:00.000Z";
type Simple = { type: string; value: string | number }[] | string | null;

const fx = JSON.parse(readFileSync(join(REPO, "docs/requirements/fixtures/conditions-60.json"), "utf8")) as {
  group_members: string[];
};
const cr = JSON.parse(readFileSync(join(REPO, "evals/datasets/conditions-cr-a1.json"), "utf8")) as {
  steps: { step: 1 | 2 | 3 | 4; name: string }[];
};
const ctx = {
  members: fx.group_members.map((name) => ({ id: `m-${name.toLowerCase()}`, name })),
  tz: TZ,
  now: NOW,
  kind: "plan" as const,
  steps: cr.steps,
};
const byId = new Map(ctx.members.map((m) => [m.id, m.name]));
const localHm = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(
    new Date(iso),
  );

function rulesParse(text: string): Simple {
  const r = parse(text, ctx);
  if (!r.ok) return r.reason === "not_in_group" ? "error:not_in_group" : null;
  return r.rules.map((x) => {
    if (x.type === "with") return { type: "with", value: byId.get(x.member_id) ?? "?" };
    if (x.type === "after" || x.type === "back_by") return { type: x.type, value: localHm(x.at) };
    if (x.type === "max_walk") return { type: x.type, value: x.minutes };
    return { type: x.type, value: x.step };
  });
}

const input = JSON.parse(readFileSync(0, "utf8"));
const mode = process.argv[2];
if (mode === "parse") {
  process.stdout.write(JSON.stringify((input as string[]).map((t) => rulesParse(t))));
} else if (mode === "score") {
  const rows = input as { got: Simple; expect: Simple }[];
  process.stdout.write(JSON.stringify(rows.map((r) => same(r.got, r.expect as never))));
} else {
  console.error("usage: node rules_bridge.ts parse|score < input.json");
  process.exit(2);
}
