// Copies design-system tokens and brand icons into the prototype so imports stay
// inside the package (SvelteKit 3 deprecates config aliases). Runs before dev and build.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GEN = path.join(ROOT, "src/lib/generated");
fs.rmSync(GEN, { recursive: true, force: true });
fs.mkdirSync(path.join(GEN, "icons"), { recursive: true });
fs.copyFileSync(path.join(ROOT, "../system/tokens.css"), path.join(GEN, "tokens.css"));
fs.copyFileSync(path.join(ROOT, "../system/tokens.json"), path.join(GEN, "tokens.json"));
const iconDir = path.join(ROOT, "../../brand/icons");
for (const f of fs.readdirSync(iconDir)) fs.copyFileSync(path.join(iconDir, f), path.join(GEN, "icons", f));
// Screen thumbnails for the catalog (first state of each screen), if exported.
const exp = path.join(ROOT, "../exports/screens");
const thumbs = path.join(ROOT, "static/exports");
fs.rmSync(thumbs, { recursive: true, force: true });
if (fs.existsSync(exp)) { fs.mkdirSync(thumbs, { recursive: true }); for (const f of fs.readdirSync(exp)) fs.copyFileSync(path.join(exp, f), path.join(thumbs, f)); }
console.log("synced tokens and", fs.readdirSync(iconDir).length, "icons");
