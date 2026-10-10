// Scans every file git would push for secrets (SRS-SEC-2). Runs in CI and as the pre-push
// hook (npm run hooks). Also checks for the exact values in the local .env, if there is one.
// Prints file, line and rule only.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scan } from "./lib/secrets.ts";

// Only settings that are secret; public ones (PORT, OLLAMA_MODEL, the bot's @name) are in code on purpose.
const SECRET_KEY = /(TOKEN|SECRET|KEY|PASSWORD|_URI|DATABASE_URL)$/;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFile = process.env.FLARE_ENV_FILE ?? path.join(ROOT, ".env");
const known = fs.existsSync(envFile)
  ? Object.entries(
      (process as unknown as { getBuiltinModule: (m: string) => { parseEnv: (s: string) => Record<string, string> } })
        .getBuiltinModule("node:util")
        .parseEnv(fs.readFileSync(envFile, "utf8")),
    )
      .filter(([key]) => SECRET_KEY.test(key))
      .map(([key, value]) => ({ key, value }))
  : [];

const files = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd: ROOT })
  .toString()
  .split("\0")
  .filter(Boolean);
if (files.includes(".env")) {
  console.error("FAIL .env is tracked by git");
  process.exit(1);
}
const findings = [];
for (const f of files) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p) || fs.statSync(p).size > 5_000_000) continue;
  const buf = fs.readFileSync(p);
  if (buf.includes(0)) continue; // binary
  findings.push(...scan(f, buf.toString("utf8"), known));
}
for (const x of findings) console.error(`FAIL ${x.file}:${x.line} ${x.rule}`);
console.log(`secret scan: ${files.length} files, ${known.length} local values checked, ${findings.length} findings`);
process.exit(findings.length ? 1 : 0);
