// Walking network pack ("paths pack", v1) for rest loops. A separate file from the ICD-6 pack
// because only Bench to Bench needs it: apps/web/static/maps/{area}-paths.json.
// Format: docs/maps/02-pack-format.md ("Paths pack").
import type { LatLon } from "@flare/shared/icd/map";
import { distanceM, distanceToSegmentM } from "./geo.ts";
import type { OverpassResult } from "./overpass.ts";
import { ATTRIBUTION, MAX_AGE_MS, PackError } from "./pack.ts";

export const PATHS_VERSION = 1;
export const FLAG_STEPS = 1;
export const FLAG_OFFROAD = 2; // footway, path, pedestrian, cycleway, track: nicer to walk

export type PathsPack = {
  v: 1;
  area: string;
  center: [number, number];
  radius_m: number;
  osm_base: string;
  attribution: string;
  names: string[];
  /**
   * Node coordinates as integer deltas in 1e-5 degrees: [dlat, dlon, dlat, dlon, …]. The first
   * pair is relative to `center`, each next pair to the node before it.
   */
  nodes: number[];
  /** [name index or -1, flags, node index, node index, …] */
  ways: number[][];
};

const OFFROAD = new Set(["footway", "path", "pedestrian", "cycleway", "track", "steps"]);
/** Service roads nobody walks a loop on. */
const SKIP_SERVICE = new Set(["parking_aisle", "drive-through", "driveway"]);
export const SIMPLIFY_M = 3;

/** Douglas-Peucker on one chain; keeps the ends. Returns kept positions. */
function simplify(pts: LatLon[], tol: number): number[] {
  const keep = new Set<number>([0, pts.length - 1]);
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop() as [number, number];
    let worst = -1;
    let worstM = tol;
    for (let k = i + 1; k < j; k++) {
      const m = distanceToSegmentM(pts[k] as LatLon, pts[i] as LatLon, pts[j] as LatLon);
      if (m > worstM) {
        worstM = m;
        worst = k;
      }
    }
    if (worst >= 0) {
      keep.add(worst);
      stack.push([i, worst], [worst, j]);
    }
  }
  return [...keep].sort((x, y) => x - y);
}

/** Build the paths pack from query 3 (ways with node ids, then their nodes). Deterministic. */
export function buildPaths(input: {
  area: string;
  center: [number, number];
  radius_m: number;
  result: OverpassResult;
  now?: Date;
}): PathsPack {
  const base = input.result.osm3s?.timestamp_osm_base;
  if (!base) throw new PackError("Overpass result has no timestamp_osm_base");
  if (!((input.now ?? new Date()).getTime() - Date.parse(base) <= MAX_AGE_MS))
    throw new PackError(`OSM data is older than 7 days (${base})`);
  const coords = new Map<number, LatLon>();
  for (const e of input.result.elements)
    if (e.type === "node" && e.lat !== undefined && e.lon !== undefined) coords.set(e.id, { lat: e.lat, lon: e.lon });

  const waysIn = input.result.elements
    .filter((e) => e.type === "way" && Array.isArray(e.nodes))
    .filter((e) => !SKIP_SERVICE.has(e.tags?.service ?? ""))
    .sort((x, y) => x.id - y.id);
  // Nodes used by two or more ways (or twice in one) are junctions and must survive simplification.
  const uses = new Map<number, number>();
  for (const w of waysIn) for (const id of w.nodes ?? []) uses.set(id, (uses.get(id) ?? 0) + 1);

  const index = new Map<number, number>();
  const nodes: number[] = [];
  let prevLat = Math.round(input.center[0] * 1e5);
  let prevLon = Math.round(input.center[1] * 1e5);
  const names: string[] = [];
  const nameIdx = new Map<string, number>();
  const ways: number[][] = [];
  for (const w of waysIn) {
    const ids = (w.nodes ?? []).filter((id) => coords.has(id));
    if (ids.length < 2) continue;
    // Split at junctions, simplify each run, then stitch.
    const kept: number[] = [];
    let start = 0;
    for (let k = 1; k < ids.length; k++) {
      if (k < ids.length - 1 && (uses.get(ids[k] as number) ?? 0) < 2) continue;
      const run = ids.slice(start, k + 1);
      const pos = simplify(
        run.map((id) => coords.get(id) as LatLon),
        SIMPLIFY_M,
      );
      for (const p of pos) {
        const id = run[p] as number;
        if (kept[kept.length - 1] !== id) kept.push(id);
      }
      start = k;
    }
    const out: number[] = [];
    for (const id of kept) {
      let i = index.get(id);
      if (i === undefined) {
        i = nodes.length / 2;
        index.set(id, i);
        const c = coords.get(id) as LatLon;
        const la = Math.round(c.lat * 1e5);
        const lo = Math.round(c.lon * 1e5);
        nodes.push(la - prevLat, lo - prevLon);
        prevLat = la;
        prevLon = lo;
      }
      if (out[out.length - 1] !== i) out.push(i);
    }
    if (out.length < 2) continue;
    const tags = w.tags ?? {};
    let n = -1;
    if (tags.name) {
      n = nameIdx.get(tags.name) ?? -1;
      if (n < 0) {
        n = names.length;
        names.push(tags.name);
        nameIdx.set(tags.name, n);
      }
    }
    const flags = (tags.highway === "steps" ? FLAG_STEPS : 0) | (OFFROAD.has(tags.highway ?? "") ? FLAG_OFFROAD : 0);
    ways.push([n, flags, ...out]);
  }
  return {
    v: 1,
    area: input.area,
    center: input.center,
    radius_m: input.radius_m,
    osm_base: base,
    attribution: ATTRIBUTION,
    names,
    nodes,
    ways,
  };
}

/** Absolute coordinates of every node. */
export function decodeNodes(pack: PathsPack): Float64Array {
  const out = new Float64Array(pack.nodes.length);
  let la = Math.round(pack.center[0] * 1e5);
  let lo = Math.round(pack.center[1] * 1e5);
  for (let i = 0; i < pack.nodes.length; i += 2) {
    la += pack.nodes[i] as number;
    lo += pack.nodes[i + 1] as number;
    out[i] = la / 1e5;
    out[i + 1] = lo / 1e5;
  }
  return out;
}

export function validatePaths(x: unknown): PathsPack {
  const p = x as PathsPack;
  if (!p || p.v !== PATHS_VERSION || !Array.isArray(p.nodes) || !Array.isArray(p.ways) || !Array.isArray(p.names))
    throw new PackError("Not a paths pack v1");
  if (!p.attribution?.includes("OpenStreetMap")) throw new PackError("Paths pack has no ODbL attribution");
  const n = p.nodes.length / 2;
  for (const w of p.ways)
    for (let i = 2; i < w.length; i++) {
      const v = w[i] as number;
      if (!(v >= 0 && v < n)) throw new PackError("Paths pack has a bad node index");
    }
  return p;
}

export type Edge = { to: number; m: number; name: number; flags: number };

export type Graph = {
  pack: PathsPack;
  at(i: number): LatLon;
  adj: Edge[][];
  name(e: Edge): string | null;
  /** Node ids within `m` metres of a point (grid lookup). */
  within(p: LatLon, m: number): number[];
};

const CELL_DEG = 0.002; // about 220 m north-south

const graphs = new WeakMap<PathsPack, Graph>();

/** Undirected graph over the paths pack. Cached per pack. */
export function graph(pack: PathsPack): Graph {
  const hit = graphs.get(pack);
  if (hit) return hit;
  const n = pack.nodes.length / 2;
  const xy = decodeNodes(pack);
  const at = (i: number): LatLon => ({ lat: xy[2 * i] as number, lon: xy[2 * i + 1] as number });
  const adj: Edge[][] = Array.from({ length: n }, () => []);
  for (const w of pack.ways) {
    const [name, flags] = w as [number, number];
    for (let k = 3; k < w.length; k++) {
      const a = w[k - 1] as number;
      const b = w[k] as number;
      const m = distanceM(at(a), at(b));
      adj[a]?.push({ to: b, m, name, flags });
      adj[b]?.push({ to: a, m, name, flags });
    }
  }
  const cells = new Map<string, number[]>();
  const key = (i: number, j: number) => `${i}|${j}`;
  for (let i = 0; i < n; i++) {
    if ((adj[i]?.length ?? 0) === 0) continue;
    const k = key(Math.floor((xy[2 * i] as number) / CELL_DEG), Math.floor((xy[2 * i + 1] as number) / CELL_DEG));
    const list = cells.get(k) ?? [];
    list.push(i);
    cells.set(k, list);
  }
  const within = (p: LatLon, m: number): number[] => {
    const r = Math.ceil(m / 111_000 / CELL_DEG / Math.max(0.2, Math.cos((p.lat * Math.PI) / 180))) + 1;
    const ci = Math.floor(p.lat / CELL_DEG);
    const cj = Math.floor(p.lon / CELL_DEG);
    const out: number[] = [];
    for (let di = -r; di <= r; di++)
      for (let dj = -r; dj <= r; dj++)
        for (const v of cells.get(key(ci + di, cj + dj)) ?? []) if (distanceM(p, at(v)) <= m) out.push(v);
    return out;
  };
  const g: Graph = { pack, at, adj, within, name: (e) => (e.name >= 0 ? (pack.names[e.name] ?? null) : null) };
  graphs.set(pack, g);
  return g;
}

/** Nearest graph node to a point, within `max` metres; -1 when none. */
export function nearestNode(g: Graph, p: LatLon, max = 60): number {
  let best = -1;
  let bestM = Number.POSITIVE_INFINITY;
  for (const v of g.within(p, max)) {
    const m = distanceM(p, g.at(v));
    if (m < bestM || (m === bestM && v < best)) {
      bestM = m;
      best = v;
    }
  }
  return best;
}
