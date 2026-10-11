// SRS-SEC-7: scans Entire's recorded agent sessions (refs/entire/*) for secrets before they
// are pushed. Same rules as the file scan, plus the exact secret values in the local .env.
// Prints ref, file and rule only, never the text. Runs in the pre-push hook and on demand:
//   npm run scan-sessions              secrets only (blocks any push)
//   npm run scan-sessions -- --public  also personal data: emails, phone numbers (gate before the
//                                      repo or its session logs go public)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type Finding, scan } from "./lib/secrets.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const git = (...a: string[]) => execFileSync("git", a, { cwd: ROOT, maxBuffer: 1 << 30 }).toString();
const envFile = process.env.FLARE_ENV_FILE ?? path.join(ROOT, ".env");
const SECRET_KEY = /(TOKEN|SECRET|KEY|PASSWORD|_URI|DATABASE_URL|DSN)$/;
const known = fs.existsSync(envFile)
  ? Object.entries(
      (process as unknown as { getBuiltinModule: (m: string) => { parseEnv: (s: string) => Record<string, string> } })
        .getBuiltinModule("node:util")
        .parseEnv(fs.readFileSync(envFile, "utf8")),
    )
      .filter(([key]) => SECRET_KEY.test(key))
      .map(([key, value]) => ({ key, value }))
  : [];

const PUBLIC = process.argv.includes("--public");
const PERSONAL: { rule: string; re: RegExp }[] = [
  { rule: "email-address", re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/ },
  { rule: "phone-number", re: /(?<![\d.])\+?1?[ (.-]*\d{3}[ ).-]+\d{3}[ .-]+\d{4}(?![\d.])/ },
];
const ALLOWED_EMAILS = /noreply@anthropic\.com|@users\.noreply\.github\.com|git@github\.com|example\.(com|net|org)/;
const refs = git("for-each-ref", "--format=%(refname)", "refs/entire").split("\n").filter(Boolean);
const findings: (Finding & { ref: string })[] = [];
let blobs = 0;
const seen = new Set<string>();
for (const ref of refs) {
  for (const line of git("ls-tree", "-r", ref).split("\n").filter(Boolean)) {
    const [meta, file] = line.split("\t");
    const sha = meta?.split(" ")[2];
    if (!sha || !file || seen.has(sha)) continue;
    seen.add(sha);
    blobs++;
    const text = git("cat-file", "-p", sha);
    const short = ref.replace("refs/entire/checkpoints/", "");
    for (const f of scan(file, text, known)) findings.push({ ...f, ref: short });
    if (PUBLIC)
      text.split("\n").forEach((l, i) => {
        for (const { rule, re } of PERSONAL) {
          const m = l.match(re);
          if (m && !(rule === "email-address" && ALLOWED_EMAILS.test(m[0])))
            findings.push({ file, line: i + 1, rule, ref: short });
        }
      });
  }
}
for (const f of findings) console.error(`FAIL ${f.ref} ${f.file}:${f.line} ${f.rule}`);
console.log(
  `session scan${PUBLIC ? " (public: secrets and personal data)" : ""}: ${refs.length} checkpoints, ${blobs} files, ${known.length} local values checked, ${findings.length} findings`,
);
process.exit(findings.length ? 1 : 0);
