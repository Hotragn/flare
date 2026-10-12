// Adds copy keys to the end of the deck, or rewords an existing key's text, as text edits, so the
// rest of deck.json keeps its exact bytes. Usage: node tools/motion/add-copy.mjs <keys.json>
// keys.json: { "key": { "text": "...", "kind": "...", "where": "..." }, ... }; an existing key gets only its text replaced.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DECK = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../design/prototype/src/lib/copy/deck.json",
);
const add = JSON.parse(fs.readFileSync(process.argv[2] ?? "", "utf8"));
let src = fs.readFileSync(DECK, "utf8");
const have = JSON.parse(src).strings;
const fresh = [];
for (const [key, entry] of Object.entries(add)) {
  if (have[key]) {
    const at = src.indexOf(`    ${JSON.stringify(key)}: {`);
    const t0 = src.indexOf('"text": ', at);
    const t1 = src.indexOf("\n", t0);
    src = `${src.slice(0, t0)}"text": ${JSON.stringify(entry.text)},${src.slice(t1)}`;
  } else {
    const body = JSON.stringify(entry, null, 2).replace(/\n/g, "\n    ");
    fresh.push(`    ${JSON.stringify(key)}: ${body}`);
  }
}
if (fresh.length) {
  const end = src.lastIndexOf("    }\n  }\n}");
  if (end < 0) throw new Error("deck.json: unexpected ending");
  src = `${src.slice(0, end)}    },\n${fresh.join(",\n")}\n  }\n}${src.slice(end + "    }\n  }\n}".length)}`;
}
JSON.parse(src);
fs.writeFileSync(DECK, src);
console.info(`added ${fresh.length}, reworded ${Object.keys(add).length - fresh.length}`);
