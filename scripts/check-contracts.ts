// Validates the API contracts and checks the server against them.
// 1. Redocly lints openapi.yaml (recommended rules, strict).
// 2. @asyncapi/parser parses asyncapi.yaml with no errors.
// 3. Every route the server registers is in openapi.yaml (no undocumented endpoint).
// 4. The hub protocol zod schemas accept the AsyncAPI examples' shapes (kinds and errors match).
// Usage: npm run contracts
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Parser } from "@asyncapi/parser";
import YAML from "yaml";
import { contractProblems } from "./lib/contracts.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "docs/architecture/contracts");
let failed = false;
const fail = (msg: string) => {
  failed = true;
  console.error(`FAIL ${msg}`);
};

// 1. OpenAPI
try {
  const bin = path.join(ROOT, "node_modules/.bin/redocly");
  execFileSync(bin, ["lint", path.join(DIR, "openapi.yaml"), "--config", path.join(DIR, "redocly.yaml")], { stdio: "pipe" });
  console.log("ok   openapi.yaml passes redocly lint");
} catch (e) {
  const out = e as { stdout?: Buffer; stderr?: Buffer };
  fail(`openapi.yaml lint\n${out.stdout?.toString() ?? ""}${out.stderr?.toString() ?? ""}`);
}

// 2. AsyncAPI
const parser = new Parser();
const asyncText = fs.readFileSync(path.join(DIR, "asyncapi.yaml"), "utf8");
const { diagnostics, document } = await parser.parse(asyncText);
const errors = diagnostics.filter((d) => d.severity === 0);
if (!document || errors.length) fail(`asyncapi.yaml\n${errors.map((d) => `  ${d.path.join(".")}: ${d.message}`).join("\n")}`);
else console.log(`ok   asyncapi.yaml parses (${document.channels().length} channels, ${document.operations().length} operations)`);

// 3 and 4.
const openapi = YAML.parse(fs.readFileSync(path.join(DIR, "openapi.yaml"), "utf8"));
const asyncapi = YAML.parse(asyncText);
const problems = await contractProblems(openapi, asyncapi);
for (const p of problems) fail(p);
if (!problems.length) console.log("ok   server routes and hub protocol match the contracts");

process.exit(failed ? 1 : 0);
