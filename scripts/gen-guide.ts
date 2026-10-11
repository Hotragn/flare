// Writes apps/web/static/check/guide.js, the device-check page's copy of the compass guide,
// from apps/web/src/lib/compass/guide.ts with Node's own type stripping (no build tool).
// `npm run gen:guide`; apps/web/test/flow/guide.test.ts fails when the copy is stale.
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const SRC = path.join(ROOT, "apps/web/src/lib/compass/guide.ts");
export const OUT = path.join(ROOT, "apps/web/static/check/guide.js");

export function generated(): string {
  const js = stripTypeScriptTypes(fs.readFileSync(SRC, "utf8"), { mode: "strip" });
  return `// GENERATED from apps/web/src/lib/compass/guide.ts by scripts/gen-guide.ts. Do not edit.\n${js}`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  fs.writeFileSync(OUT, generated());
  console.info(`wrote ${path.relative(ROOT, OUT)}`);
}
