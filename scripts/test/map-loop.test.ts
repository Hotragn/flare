import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { LatLon } from "@flare/shared/icd/map";
import { describe, expect, it } from "vitest";
import { CARD_COLORS, cardLines, cardPdf, contrast, SIZE, textWidth, wrap } from "../../apps/web/src/lib/map/card.ts";
import { destination, distanceM } from "../../apps/web/src/lib/map/geo.ts";
import { buildLoop, LOOP_M_PER_MIN, type Loop, speakTurns } from "../../apps/web/src/lib/map/loop.ts";
import { buildPaths, decodeNodes, graph, type PathsPack, validatePaths } from "../../apps/web/src/lib/map/paths.ts";
import { fairlane, ORIGIN, POINTS, tinyPack } from "./map-fixtures.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const pack = fairlane();
const paths = validatePaths(
  JSON.parse(fs.readFileSync(path.join(ROOT, "apps/web/static/maps/fairlane-paths.json"), "utf8")),
);

/** Walk the loop and return the metres between consecutive rests (start counts as one). */
function gapsAlong(loop: Loop): number[] {
  const restPts = loop.rests.map((r) => r.at);
  const gaps: number[] = [];
  let since = 0;
  let k = 0;
  for (let i = 1; i < loop.path.length; i++) {
    since += distanceM(loop.path[i - 1] as LatLon, loop.path[i] as LatLon);
    const r = restPts[k];
    if (r && distanceM(loop.path[i] as LatLon, r) < 0.5) {
      gaps.push(since);
      since = 0;
      k++;
    }
  }
  return gaps;
}

function isWalkable(p: PathsPack, loop: Loop): boolean {
  const g = graph(p);
  const xy = decodeNodes(p);
  const idOf = new Map<string, number>();
  for (let i = 0; i < xy.length / 2; i++) idOf.set(`${xy[2 * i]},${xy[2 * i + 1]}`, i);
  for (let i = 1; i < loop.path.length; i++) {
    const a = idOf.get(`${loop.path[i - 1]?.lat},${loop.path[i - 1]?.lon}`);
    const b = idOf.get(`${loop.path[i]?.lat},${loop.path[i]?.lon}`);
    if (a === undefined || b === undefined || !g.adj[a]?.some((e) => e.to === b)) return false;
  }
  return true;
}

describe("SRS-REST-2, -3 loops on the Fairlane pack", () => {
  const spot = POINTS.green;
  for (const [minutes, gap] of [
    [20, 200],
    [20, 400],
    [40, 400],
  ] as const) {
    it(`${minutes} min with benches every ${gap} m`, () => {
      const r = buildLoop(pack, paths, spot, { minutes, rest_gap_m: gap, avoid_steps: true }, "Village Green");
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const { loop } = r;
      // Starts and ends at the spot.
      expect(distanceM(loop.path[0] as LatLon, spot)).toBeLessThan(60);
      expect(loop.path[0]).toEqual(loop.path[loop.path.length - 1]);
      // Only mapped walkable paths (private and no-access ways are not in the paths pack).
      expect(isWalkable(paths, loop)).toBe(true);
      // Never more than the gap between consecutive rests.
      const gaps = gapsAlong(loop);
      expect(gaps).toHaveLength(loop.rests.length);
      for (const g of gaps) expect(g).toBeLessThanOrEqual(gap + 0.5);
      // 3 km/h within ±20%.
      const walk = loop.length_m / LOOP_M_PER_MIN;
      expect(Math.abs(walk - minutes) / minutes).toBeLessThanOrEqual(0.2);
      // Turn list from the copy deck.
      expect(loop.turns[0]?.text).toBe("Start at Village Green.");
      expect(loop.turns.at(-1)?.text).toBe("Back at Village Green. That's the loop.");
      for (const t of loop.turns.slice(1, -1))
        expect(t.text).toMatch(
          /^(Left on .+\. Bench in \d+ m\.|Right at .+\. Bench in \d+ m\.|Straight past .+\. Bench in \d+ m\.|(Restroom|Water) on your (left|right)\.)$/,
        );
    });
  }
  it("SRS-REST-4: offers the next limit when no loop fits", () => {
    const r = buildLoop(
      pack,
      paths,
      POINTS.resid,
      { minutes: 30, rest_gap_m: 200, avoid_steps: false },
      "Rotunda Drive",
    );
    expect(r).toEqual({ ok: false, message: "No loop keeps benches that close. Try 400 m?", next_gap_m: 400 });
    const r2 = buildLoop(
      pack,
      paths,
      POINTS.resid,
      { minutes: 30, rest_gap_m: 400, avoid_steps: false },
      "Rotunda Drive",
    );
    expect(r2).toEqual({ ok: false, message: "No loop keeps benches that close.", next_gap_m: null });
  });
});

/** A 4 × 4 grid of 125 m blocks around ORIGIN, as Overpass would return it. */
function gridResult(opts: { steps?: boolean; privateWay?: boolean } = {}) {
  const els: {
    type: "node" | "way";
    id: number;
    lat?: number;
    lon?: number;
    nodes?: number[];
    tags?: Record<string, string>;
  }[] = [];
  const id = (i: number, j: number) => 1000 + i * 10 + j;
  for (let i = 0; i <= 4; i++)
    for (let j = 0; j <= 4; j++) {
      const p = destination(destination(ORIGIN, 0, (i - 2) * 125), 90, (j - 2) * 125);
      els.push({ type: "node", id: id(i, j), lat: p.lat, lon: p.lon });
    }
  let w = 1;
  for (let i = 0; i <= 4; i++) {
    els.push({
      type: "way",
      id: w++,
      nodes: [0, 1, 2, 3, 4].map((j) => id(i, j)),
      tags: { highway: "footway", name: `Row ${i}` },
    });
    els.push({
      type: "way",
      id: w++,
      nodes: [0, 1, 2, 3, 4].map((j) => id(j, i)),
      tags: { highway: "footway", name: `Col ${i}` },
    });
  }
  if (opts.steps) for (const e of els) if (e.type === "way") e.tags = { ...e.tags, highway: "steps" };
  return { osm3s: { timestamp_osm_base: new Date().toISOString() }, elements: els };
}

describe("loop builder on a synthetic grid", () => {
  const p = buildPaths({ area: "grid", center: [ORIGIN.lat, ORIGIN.lon], radius_m: 1000, result: gridResult() });
  // A bench at every grid node except the centre.
  const seats = tinyPack(
    [0, 1, 2, 3, 4].flatMap((i) =>
      [0, 1, 2, 3, 4]
        .filter((j) => !(i === 2 && j === 2))
        .map((j) => ({
          kind: "bench" as const,
          p: destination(destination(ORIGIN, 0, (i - 2) * 125), 90, (j - 2) * 125),
        })),
    ),
  );
  it("finds a loop of the asked length with no retracing", () => {
    const r = buildLoop(seats, p, ORIGIN, { minutes: 20, rest_gap_m: 200, avoid_steps: false }, "the square");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.loop.length_m).toBeGreaterThanOrEqual(800);
    expect(r.loop.length_m).toBeLessThanOrEqual(1200);
    const legs = new Set<string>();
    for (let i = 1; i < r.loop.path.length; i++) {
      const k = [r.loop.path[i - 1], r.loop.path[i]]
        .map((q) => `${q?.lat},${q?.lon}`)
        .sort()
        .join("|");
      expect(legs.has(k)).toBe(false);
      legs.add(k);
    }
  });
  it("fails at a 100 m gap when benches are 125 m apart", () => {
    const r = buildLoop(seats, p, ORIGIN, { minutes: 20, rest_gap_m: 100, avoid_steps: false }, "the square");
    expect(r.ok).toBe(false);
  });
  it("avoids steps when asked", () => {
    const sp = buildPaths({
      area: "grid",
      center: [ORIGIN.lat, ORIGIN.lon],
      radius_m: 1000,
      result: gridResult({ steps: true }),
    });
    expect(buildLoop(seats, sp, ORIGIN, { minutes: 20, rest_gap_m: 200, avoid_steps: true }, "x").ok).toBe(false);
    expect(buildLoop(seats, sp, ORIGIN, { minutes: 20, rest_gap_m: 200, avoid_steps: false }, "x").ok).toBe(true);
  });
  it("drops parking aisles from the network", () => {
    const res = gridResult();
    for (const e of res.elements) if (e.type === "way") e.tags = { highway: "service", service: "parking_aisle" };
    expect(buildPaths({ area: "g", center: [ORIGIN.lat, ORIGIN.lon], radius_m: 1000, result: res }).ways).toHaveLength(
      0,
    );
  });
});

describe("SRS-REST-6 spoken turns", () => {
  it("queues every turn, numbered, and can stop", () => {
    const said: string[] = [];
    let cancelled = 0;
    const synth = { speak: (u: { text: string }) => said.push(u.text), cancel: () => cancelled++ };
    const make = (t: string) => ({ text: t, lang: "", rate: 1 }) as unknown as SpeechSynthesisUtterance;
    const turns = [
      { kind: "start" as const, text: "Start at X.", at: ORIGIN, m: 0 },
      { kind: "end" as const, text: "Back at X. That's the loop.", at: ORIGIN, m: 900 },
    ];
    const stop = speakTurns(turns, synth as never, make);
    expect(said).toEqual(["1. Start at X.", "2. Back at X. That's the loop."]);
    stop();
    expect(cancelled).toBe(2);
  });
});

describe("SRS-REST-5 large-print card", () => {
  const r = buildLoop(pack, paths, POINTS.green, { minutes: 40, rest_gap_m: 400, avoid_steps: true }, "Village Green");
  if (!r.ok) throw new Error("fixture loop missing");
  const bytes = cardPdf(r.loop, "Village Green");
  const text = Buffer.from(bytes).toString("latin1");
  it("is a well-formed PDF with a correct xref", () => {
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
    const xrefAt = Number(text.match(/startxref\n(\d+)/)?.[1]);
    expect(text.slice(xrefAt, xrefAt + 4)).toBe("xref");
    const offsets = [...text.slice(xrefAt).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    offsets.forEach((o, i) => {
      expect(text.slice(o, o + 12)).toMatch(new RegExp(`^${i + 1} 0 obj`));
    });
  });
  it("sets every text run at 18 pt or more, black on white (contrast ≥ 7:1)", () => {
    const sizes = [...text.matchAll(/\/F[12] (\d+) Tf/g)].map((m) => Number(m[1]));
    expect(sizes.length).toBeGreaterThan(10);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(18);
    expect(text).not.toMatch(/ (0?\.\d+) (0?\.\d+) (0?\.\d+) rg/); // no grey text
    expect(contrast(CARD_COLORS.text, CARD_COLORS.page)).toBeGreaterThanOrEqual(7);
    expect(SIZE.body).toBeGreaterThanOrEqual(18);
  });
  it("has numbered turns, bench distances, the warning and attribution", () => {
    const lines = cardLines(r.loop, "Village Green").map((l) => l.text);
    expect(lines[0]).toBe(`${r.loop.minutes} min loop from Village Green`);
    expect(lines.filter((l) => /^\d+\. /.test(l))).toHaveLength(r.loop.turns.length);
    expect(lines.some((l) => /Bench in \d+ m\./.test(l))).toBe(true);
    expect(lines).toContain("Check the path. Map data can be wrong.");
    expect(text).toContain("(Check the path. Map data can be wrong.) Tj");
    expect(text).toContain("Map data \\251 OpenStreetMap contributors.");
  });
  it("wraps to the page width", () => {
    const max = 612 - 108;
    for (const l of wrap("Left on Southfield Freeway Service Drive North. Bench in 380 m.", 20, max))
      expect(textWidth(l, 20)).toBeLessThanOrEqual(max);
  });
});
