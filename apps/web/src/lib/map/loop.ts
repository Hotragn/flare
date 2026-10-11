// Bench to Bench: walking loops with rest stops (SRS-REST-2 to -4, -6). Deterministic, on the
// phone, no model. Spec: docs/maps/05-rest-loops.md.
//
// 1. Snap usable seats (benches, picnic tables) to the walking graph. The start spot counts
//    as a rest: people gather there.
// 2. Shortest paths between rests, each no longer than the rest gap ("rest graph").
// 3. Search the rest graph for a cycle from the start whose length at 3 km/h is within ±20% of
//    the asked minutes, preferring little retracing and the person's preferences.
// 4. Turn list: left/right at junctions, bench distances, restrooms and water by side.
import type { Kind, LatLon, MapPack, Place } from "@flare/shared/icd/map";
import { fmt } from "./copy.ts";
import { angleDiff, bearingDeg, distanceM } from "./geo.ts";
import { FLAG_OFFROAD, FLAG_STEPS, type Graph, graph, nearestNode, type PathsPack } from "./paths.ts";
import { isUsable, near, SEAT_KINDS } from "./places.ts";

export const LOOP_M_PER_MIN = 3000 / 60; // SRS-REST-3: 3 km/h
export const TOLERANCE = 0.2; // ±20%
export const SNAP_M = 25; // a seat this close to a path is on the loop
export const AMENITY_SIDE_M = 30; // restrooms and water this close get a line
export const TURN_DEG = 40;
export const TURN_GAP_M = 30; // turns closer than this to the last line are noise (crossings, kinks)
export const GAPS = [100, 200, 400] as const;
const MAX_EXPANSIONS = 20_000;

export type Preference = "trees" | "water" | "quiet";
export type LoopRequest = {
  minutes: number;
  rest_gap_m: 100 | 200 | 400;
  avoid_steps: boolean;
  prefer?: Preference[];
};

export type Turn = {
  kind: "start" | "left" | "right" | "straight" | "restroom" | "water" | "end";
  text: string;
  at: LatLon;
  /** Metres walked from the start when this line applies. */
  m: number;
};

export type Loop = {
  length_m: number;
  minutes: number;
  /** Rest stops in walking order: metres from the previous rest (or the start). */
  rests: { place: Place | null; at: LatLon; gap_m: number }[];
  path: LatLon[];
  turns: Turn[];
  restrooms: number;
  water: number;
};

export type LoopResult = { ok: true; loop: Loop } | { ok: false; message: string; next_gap_m: 200 | 400 | null };

// ---------- shortest paths ----------

class Heap {
  private a: [number, number][] = [];
  get size() {
    return this.a.length;
  }
  push(d: number, v: number) {
    const a = this.a;
    a.push([d, v]);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if ((a[p] as [number, number])[0] <= d) break;
      [a[i], a[p]] = [a[p] as [number, number], a[i] as [number, number]];
      i = p;
    }
  }
  pop(): [number, number] {
    const a = this.a;
    const top = a[0] as [number, number];
    const last = a.pop() as [number, number];
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && (a[l] as [number, number])[0] < (a[m] as [number, number])[0]) m = l;
        if (r < a.length && (a[r] as [number, number])[0] < (a[m] as [number, number])[0]) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m] as [number, number], a[i] as [number, number]];
        i = m;
      }
    }
    return top;
  }
}

/** Dijkstra from `src` up to `limit` metres. Returns distance and predecessor maps. */
function dijkstra(g: Graph, src: number, limit: number, avoidSteps: boolean) {
  const dist = new Map<number, number>([[src, 0]]);
  const prev = new Map<number, number>();
  const h = new Heap();
  h.push(0, src);
  while (h.size) {
    const [d, u] = h.pop();
    if (d > (dist.get(u) ?? Number.POSITIVE_INFINITY)) continue;
    for (const e of g.adj[u] ?? []) {
      if (avoidSteps && e.flags & FLAG_STEPS) continue;
      const nd = d + e.m;
      if (nd > limit || nd >= (dist.get(e.to) ?? Number.POSITIVE_INFINITY)) continue;
      dist.set(e.to, nd);
      prev.set(e.to, u);
      h.push(nd, e.to);
    }
  }
  return { dist, prev };
}

function pathTo(prev: Map<number, number>, src: number, dst: number): number[] {
  const out = [dst];
  let v = dst;
  while (v !== src) {
    const p = prev.get(v);
    if (p === undefined) return [];
    out.push(p);
    v = p;
  }
  return out.reverse();
}

// ---------- the search ----------

type RestEdge = { to: number; m: number; nodes: number[] };

function edgeKey(a: number, b: number) {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

/** Nodes within 80 m of named water, woods or parks, as asked. Computed once per request. */
function preferredNodes(g: Graph, pack: MapPack, spot: LatLon, reach: number, prefer: Preference[]): Set<number> {
  const kinds = new Set<Kind>();
  if (prefer.includes("trees")) kinds.add("wood").add("park");
  if (prefer.includes("water")) kinds.add("water");
  const out = new Set<number>();
  if (kinds.size === 0) return out;
  for (const { place } of near(pack, spot, kinds, reach + 80)) for (const v of g.within(place, 80)) out.add(v);
  return out;
}

/** Fraction of the walk on preferred ground: off-road paths ("quiet") or near preferred nodes. */
function preferenceScore(g: Graph, nodes: number[], prefer: Preference[], good: Set<number>): number {
  if (prefer.length === 0 || nodes.length < 2) return 0;
  let ok = 0;
  let total = 0;
  for (let i = 1; i < nodes.length; i++) {
    const a = nodes[i - 1] as number;
    const b = nodes[i] as number;
    const e = g.adj[a]?.find((x) => x.to === b);
    const m = e?.m ?? 0;
    total += m;
    if (good.has(b) || (prefer.includes("quiet") && e && e.flags & FLAG_OFFROAD)) ok += m;
  }
  return total ? ok / total : 0;
}

/**
 * SRS-REST-2 to -4. `spot` is the meeting place. `paths` is the walking network, `pack` the
 * ICD-6 pack for seats, restrooms and water. `placeName` names the spot on the turn list.
 */
export function buildLoop(
  pack: MapPack,
  paths: PathsPack,
  spot: LatLon,
  req: LoopRequest,
  placeName: string,
): LoopResult {
  const g = graph(paths);
  const target = req.minutes * LOOP_M_PER_MIN;
  const lo = target * (1 - TOLERANCE);
  const hi = target * (1 + TOLERANCE);
  const gap = req.rest_gap_m;
  const none = (): LoopResult => {
    const next = GAPS.find((x) => x > gap) ?? null;
    return {
      ok: false,
      message: next ? `${fmt("loop.none")} ${fmt("loop.tryNext", { m: next })}` : fmt("loop.none"),
      next_gap_m: next as 200 | 400 | null,
    };
  };

  const start = nearestNode(g, spot, 60);
  if (start < 0) return none();

  // Rest nodes: the start plus every usable seat on the network within reach of a loop.
  const restAt = new Map<number, Place | null>([[start, null]]);
  for (const { place } of near(pack, spot, SEAT_KINDS, hi / 2 + SNAP_M)) {
    if (!isUsable(place)) continue;
    const n = nearestNode(g, place, SNAP_M);
    if (n >= 0 && !restAt.has(n)) restAt.set(n, place);
  }

  // Rest graph.
  const rest = [...restAt.keys()];
  const redges = new Map<number, RestEdge[]>();
  for (const u of rest) {
    const { dist, prev } = dijkstra(g, u, gap, req.avoid_steps);
    const list: RestEdge[] = [];
    for (const v of rest) {
      if (v === u) continue;
      const d = dist.get(v);
      if (d !== undefined && d > 0) list.push({ to: v, m: d, nodes: pathTo(prev, u, v) });
    }
    // Longer hops first: fewer stops to cover the distance, and a wider loop.
    list.sort((a, b) => b.m - a.m || a.to - b.to);
    redges.set(u, list);
  }

  // Distance back to the start over the rest graph, for pruning.
  const back = new Map<number, number>([[start, 0]]);
  {
    const h = new Heap();
    h.push(0, start);
    while (h.size) {
      const [d, u] = h.pop();
      if (d > (back.get(u) ?? Number.POSITIVE_INFINITY)) continue;
      for (const e of redges.get(u) ?? []) {
        const nd = d + e.m;
        if (nd < (back.get(e.to) ?? Number.POSITIVE_INFINITY)) {
          back.set(e.to, nd);
          h.push(nd, e.to);
        }
      }
    }
  }

  let best: { seq: RestEdge[]; score: number; len: number } | null = null;
  let expansions = 0;
  const seq: RestEdge[] = [];
  const onLoop = new Set<number>([start]);
  const prefer = req.prefer ?? [];
  const good = preferredNodes(g, pack, spot, hi / 2, prefer);

  const score = (edges: RestEdge[], len: number) => {
    // Retracing: share of underlying graph edges walked twice.
    const seen = new Map<string, number>();
    let walked = 0;
    let twice = 0;
    for (const e of edges)
      for (let i = 1; i < e.nodes.length; i++) {
        const k = edgeKey(e.nodes[i - 1] as number, e.nodes[i] as number);
        const n = (seen.get(k) ?? 0) + 1;
        seen.set(k, n);
        walked++;
        if (n > 1) twice++;
      }
    const retrace = walked ? twice / walked : 0;
    const nodes = edges.flatMap((e, i) => (i === 0 ? e.nodes : e.nodes.slice(1)));
    return Math.abs(len - target) / target + retrace - 0.3 * preferenceScore(g, nodes, prefer, good);
  };

  const dfs = (u: number, len: number) => {
    if (++expansions > MAX_EXPANSIONS) return;
    for (const e of redges.get(u) ?? []) {
      const nl = len + e.m;
      if (e.to === start) {
        if (seq.length >= 1 && nl >= lo && nl <= hi) {
          // The full score is at least the length term minus the 0.3 preference bonus.
          const floor = Math.abs(nl - target) / target - (prefer.length ? 0.3 : 0);
          if (best && floor >= best.score) continue;
          const cand = [...seq, e];
          const s = score(cand, nl);
          if (!best || s < best.score) best = { seq: cand, score: s, len: nl };
        }
        continue;
      }
      if (onLoop.has(e.to)) continue;
      if (nl + (back.get(e.to) ?? Number.POSITIVE_INFINITY) > hi) continue;
      onLoop.add(e.to);
      seq.push(e);
      dfs(e.to, nl);
      seq.pop();
      onLoop.delete(e.to);
      if (expansions > MAX_EXPANSIONS) return;
    }
  };
  dfs(start, 0);

  const found = best as { seq: RestEdge[]; score: number; len: number } | null;
  if (!found) return none();

  const nodes = found.seq.flatMap((e, i) => (i === 0 ? e.nodes : e.nodes.slice(1)));
  const rests = found.seq.map((e) => ({ place: restAt.get(e.to) ?? null, at: g.at(e.to), gap_m: Math.round(e.m) }));
  const { turns, restrooms, water } = turnList(g, pack, nodes, found.seq, placeName);
  return {
    ok: true,
    loop: {
      length_m: Math.round(found.len),
      minutes: Math.round(found.len / LOOP_M_PER_MIN),
      rests,
      path: nodes.map((n) => g.at(n)),
      turns,
      restrooms,
      water,
    },
  };
}

// ---------- turns ----------

/** Bearing over about 20 m before or after node i, so tiny kinks don't count as turns. */
function smoothBearing(g: Graph, nodes: number[], i: number, dir: 1 | -1): number {
  const a = g.at(nodes[i] as number);
  let j = i + dir;
  let b = g.at(nodes[j] as number);
  while (distanceM(a, b) < 20 && j + dir >= 0 && j + dir < nodes.length) {
    j += dir;
    b = g.at(nodes[j] as number);
  }
  return dir === 1 ? bearingDeg(a, b) : bearingDeg(b, a);
}

function edgeName(g: Graph, a: number, b: number): string | null {
  const e = g.adj[a]?.find((x) => x.to === b);
  return e ? g.name(e) : null;
}

function turnList(g: Graph, pack: MapPack, nodes: number[], seq: RestEdge[], placeName: string) {
  // Cumulative metres at each node, and where each rest is reached.
  const cum: number[] = [0];
  for (let i = 1; i < nodes.length; i++)
    cum.push((cum[i - 1] as number) + distanceM(g.at(nodes[i - 1] as number), g.at(nodes[i] as number)));
  const restM: number[] = [];
  let acc = 0;
  for (const e of seq) {
    acc += e.m;
    restM.push(acc);
  }
  const total = cum[cum.length - 1] as number;
  const nextBench = (m: number) => {
    const r = restM.find((x) => x > m + 1);
    return Math.max(1, Math.round(((r ?? total) - m) / 10) * 10);
  };

  const turns: Turn[] = [
    { kind: "start", text: fmt("loop.turn.start", { place: placeName }), at: g.at(nodes[0] as number), m: 0 },
  ];
  let lastTurnM = -1e9;
  let restIdx = 0;
  for (let i = 1; i < nodes.length - 1; i++) {
    const m = cum[i] as number;
    // Passing a bench without turning: say how far the next one is.
    while (restIdx < restM.length - 1 && (restM[restIdx] as number) <= m + 0.5) {
      const benchM = restM[restIdx] as number;
      restIdx++;
      // A bench right after the last line is already counted in that line's "Bench in" figure.
      if (benchM - lastTurnM < TURN_GAP_M) continue;
      turns.push({
        kind: "straight",
        text: fmt("loop.turn.straight", { landmark: fmt("loop.landmark.bench"), m: nextBench(benchM) }),
        at: g.at(nodes[i] as number),
        m: benchM,
      });
      lastTurnM = benchM;
    }
    const n = nodes[i] as number;
    if ((g.adj[n]?.length ?? 0) < 3) continue; // not a junction
    const d = angleDiff(smoothBearing(g, nodes, i, -1), smoothBearing(g, nodes, i, 1));
    if (Math.abs(d) < TURN_DEG || m - lastTurnM < TURN_GAP_M) continue;
    const name = edgeName(g, n, nodes[i + 1] as number);
    if (d < 0)
      turns.push({
        kind: "left",
        text: fmt("loop.turn.left", { path: name ?? fmt("loop.path.unnamed"), m: nextBench(m) }),
        at: g.at(n),
        m,
      });
    else
      turns.push({
        kind: "right",
        text: fmt("loop.turn.right", { landmark: name ?? fmt("loop.landmark.corner"), m: nextBench(m) }),
        at: g.at(n),
        m,
      });
    lastTurnM = m;
  }

  // Restrooms and water within 30 m of the walk, each once, on the side you pass it.
  let restrooms = 0;
  let water = 0;
  const said = new Set<string>();
  const amen: Turn[] = [];
  for (let i = 1; i < nodes.length; i++) {
    const p = g.at(nodes[i] as number);
    for (const { place } of near(pack, p, new Set<Kind>(["toilets", "drinking_water"]), AMENITY_SIDE_M)) {
      if (said.has(place.osm_id) || !isUsable(place)) continue;
      said.add(place.osm_id);
      const heading = bearingDeg(g.at(nodes[i - 1] as number), p);
      const side = angleDiff(heading, bearingDeg(p, place)) < 0 ? "left" : "right";
      const s = fmt(side === "left" ? "loop.side.left" : "loop.side.right");
      if (place.kind === "toilets") restrooms++;
      else water++;
      amen.push({
        kind: place.kind === "toilets" ? "restroom" : "water",
        text: fmt(place.kind === "toilets" ? "loop.turn.restroom" : "loop.turn.water", { side: s }),
        at: p,
        m: cum[i] as number,
      });
    }
  }
  const all = [...turns, ...amen].sort((a, b) => a.m - b.m || (a.kind === "start" ? -1 : 0));
  all.push({ kind: "end", text: fmt("loop.turn.end", { place: placeName }), at: g.at(nodes[0] as number), m: total });
  return { turns: all, restrooms, water };
}

/** SRS-REST-6: read the turns aloud, one after another. Returns a stop function. */
export function speakTurns(
  turns: Turn[],
  synth: { speak(u: SpeechSynthesisUtterance): void; cancel(): void } = speechSynthesis,
  make: (t: string) => SpeechSynthesisUtterance = (t) => new SpeechSynthesisUtterance(t),
): () => void {
  synth.cancel();
  turns.forEach((t, i) => {
    const u = make(`${i + 1}. ${t.text}`);
    u.lang = "en-US";
    u.rate = 0.9;
    synth.speak(u);
  });
  return () => synth.cancel();
}
