// Builds map pack v2 (ICD-6 MapPack) from Overpass and writes apps/web/static/maps/{area}.json.
// Two queries to overpass-api.de, spaced 2.5 s or more, with an identifying User-Agent.
// Never contacts any openstreetmap.org host. Spec: docs/maps/02-pack-format.md.
//
// Usage:
//   node scripts/build-map-pack.ts                      # Fairlane (TEST_AREA), fetch and write
//   node scripts/build-map-pack.ts --raw DIR             # also keep the raw responses in DIR
//   node scripts/build-map-pack.ts --from-raw DIR        # rebuild from saved responses, no network
//   node scripts/build-map-pack.ts --paths [--raw DIR]   # walking network for rest loops (query 3)
//   node scripts/build-map-pack.ts --area NAME --lat N --lon N --radius M --out FILE
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import {
  extraQuery,
  MIN_SPACING_MS,
  type OverpassResult,
  pathsQuery,
  pinnedQuery,
  runQuery,
  USER_AGENT,
} from "../apps/web/src/lib/map/overpass.ts";
import { buildPack, countByKind } from "../apps/web/src/lib/map/pack.ts";
import { buildPaths } from "../apps/web/src/lib/map/paths.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** TEST_AREA: Fairlane Town Center, OSM way 168151050 centroid (docs/requirements/evidence/README.md). */
export const FAIRLANE = { area: "fairlane", lat: 42.3169092, lon: -83.2229394, radius_m: 3000 };

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

export function sizes(json: string): { raw: number; gzip: number; brotli: number } {
  const buf = Buffer.from(json);
  return {
    raw: buf.length,
    gzip: gzipSync(buf, { level: 9 }).length,
    brotli: brotliCompressSync(buf, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length,
  };
}

async function main() {
  const area = arg("area") ?? FAIRLANE.area;
  const lat = Number(arg("lat") ?? FAIRLANE.lat);
  const lon = Number(arg("lon") ?? FAIRLANE.lon);
  const radius_m = Number(arg("radius") ?? FAIRLANE.radius_m);
  const out = arg("out") ?? path.join(ROOT, "apps/web/static/maps", `${area}.json`);
  const fromRaw = arg("from-raw");
  const rawDir = arg("raw") ?? fromRaw ?? path.join(os.tmpdir(), "flare-map-raw");
  if (![lat, lon, radius_m].every(Number.isFinite)) throw new Error("lat, lon and radius must be numbers");

  if (process.argv.includes("--paths")) {
    // Query 3 only: the walking network for rest loops, written to {area}-paths.json.
    let result: OverpassResult;
    const rawFile = path.join(rawDir, `${area}-paths.json`);
    if (fromRaw) result = JSON.parse(fs.readFileSync(rawFile, "utf8"));
    else {
      console.log("query 3 (walking network) to overpass-api.de");
      result = await runQuery(pathsQuery({ lat, lon, radius_m }), { userAgent: USER_AGENT });
      fs.mkdirSync(rawDir, { recursive: true });
      fs.writeFileSync(rawFile, JSON.stringify(result));
    }
    const paths = buildPaths({ area, center: [lat, lon], radius_m, result });
    const pOut = arg("out") ?? path.join(ROOT, "apps/web/static/maps", `${area}-paths.json`);
    const json = JSON.stringify(paths);
    fs.writeFileSync(pOut, `${json}\n`);
    const s = sizes(json);
    console.log(`wrote ${path.relative(ROOT, pOut)}: ${paths.nodes.length / 2} nodes, ${paths.ways.length} ways`);
    console.log(`size: ${s.raw} B raw, ${s.gzip} B gzip, ${s.brotli} B brotli`);
    return;
  }

  let pinned: OverpassResult;
  let extra: OverpassResult;
  if (fromRaw) {
    pinned = JSON.parse(fs.readFileSync(path.join(fromRaw, `${area}-pinned.json`), "utf8"));
    extra = JSON.parse(fs.readFileSync(path.join(fromRaw, `${area}-extra.json`), "utf8"));
  } else {
    const a = { lat, lon, radius_m };
    console.log(`query 1 of 2 (pinned) to overpass-api.de`);
    pinned = await runQuery(pinnedQuery(a), { userAgent: USER_AGENT });
    await new Promise((r) => setTimeout(r, MIN_SPACING_MS));
    console.log(`query 2 of 2 (nature, parks, streets)`);
    extra = await runQuery(extraQuery(a), { userAgent: USER_AGENT });
    fs.mkdirSync(rawDir, { recursive: true });
    fs.writeFileSync(path.join(rawDir, `${area}-pinned.json`), JSON.stringify(pinned));
    fs.writeFileSync(path.join(rawDir, `${area}-extra.json`), JSON.stringify(extra));
    console.log(`raw responses kept in ${rawDir}`);
  }

  const pack = buildPack({ area, center: [lat, lon], radius_m, pinned, extra });
  const json = JSON.stringify(pack);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${json}\n`);
  const s = sizes(json);
  const counts = countByKind(pack);
  console.log(`wrote ${path.relative(ROOT, out)}: ${pack.items.length} items, osm_base ${pack.osm_base}`);
  console.log(`size: ${s.raw} B raw, ${s.gzip} B gzip, ${s.brotli} B brotli`);
  console.log(`distinct OSM elements per kind: ${JSON.stringify(counts)}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e: unknown) => {
    console.error(`FAIL ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  });
}
