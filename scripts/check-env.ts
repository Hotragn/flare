// Reports which settings are set or missing, per app. Never prints a value.
// Usage: npm run check-env [-- server hub bot deploy test-area]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type App, check, failed, format } from "./lib/env-spec.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = process.env.FLARE_ENV_FILE ?? path.join(ROOT, ".env");
const ALL: App[] = ["server", "hub", "bot", "deploy", "test-area"];
const asked = process.argv.slice(2).filter((a): a is App => (ALL as string[]).includes(a));
const apps = asked.length ? asked : ALL;

// Parse into a private object so the check never mutates process.env.
const vars: Record<string, string | undefined> = { ...process.env };
if (fs.existsSync(file)) Object.assign(vars, parseEnv(fs.readFileSync(file, "utf8")));
function parseEnv(text: string): Record<string, string> {
  const util = process as unknown as {
    getBuiltinModule?: (m: string) => { parseEnv?: (s: string) => Record<string, string> };
  };
  const parse = util.getBuiltinModule?.("node:util")?.parseEnv;
  if (!parse) throw new Error("Node 24.21+ needed for util.parseEnv");
  return parse(text);
}

const lines = check(vars, apps);
console.log(`env file: ${fs.existsSync(file) ? "found" : "not found"} (${path.relative(ROOT, file) || file})`);
console.log(format(lines));
const bad = failed(lines);
console.log(bad ? "\nSome required settings are missing or invalid." : "\nAll required settings are set.");
process.exit(bad ? 1 : 0);
