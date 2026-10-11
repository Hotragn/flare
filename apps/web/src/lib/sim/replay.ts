// Virtual Fairlane replay format (a simulation, not real people). Written by tools/sim/run.ts
// into static/sim/replay-<seed>.json and played by the /sim/ page. No imports: the page and
// the Node script both read it.

export type Personality = "keen" | "lazy" | "conditional" | "bench" | "lowvision" | "planner";

/** What a simulated friend is doing in one tick (one digit per friend in `Frame.s`). */
export const STATUS = {
  home: 0,
  toSpot: 1, // host walking to the spot before sending a Flare
  toGathering: 2,
  there: 3,
  resting: 4, // needs-a-bench friend sitting on a bench on the way
  toHome: 5,
} as const;
export type Status = (typeof STATUS)[keyof typeof STATUS];

export type SimFriend = { key: string; name: string; type: Personality; group: string; speed_mps: number };

export type SimState = "kindling" | "lit" | "ember" | "gone" | "deleted";

export type SimGathering = {
  key: string;
  kind: "flare" | "plan";
  group: string;
  host: string;
  /** Where it was sent from (Flare) or step 1's place (Plan). */
  spot: [number, number];
  spot_name: string;
  quorum: number;
  created_t: number;
  /** Ember benches c1..cN, nearest first. */
  ember_candidates: [number, number][];
  /** Plan steps, 1 = biggest. */
  steps?: { step: number; minutes: number; at: [number, number]; name: string }[];
  /** Seconds from the start of the run; state as the real server reported it. */
  events: { t: number; state: SimState; need: number; quorum: number; headcount: number | null; note?: string }[];
  /** Where people actually went (spot, Ember bench or Plan step). */
  meet: [number, number] | null;
  outcome: "lit" | "ember_lit" | "faded_out" | "pending";
  lit_after_s: number | null;
  arrivals: number;
  sparks: number;
};

export type SimStats = {
  friends: number;
  groups: number;
  gatherings: number;
  flares: number;
  plans: number;
  lit: number;
  light_rate: number;
  embers: number;
  embers_lit: number;
  ember_save_rate: number | null;
  median_min_to_lit: number | null;
  median_min_to_lit_flares: number | null;
  headcount_total: number;
  arrivals: number;
  sparks: number;
  deleted: number;
  audit_pass: boolean;
  audit_expired_rows: number;
};

export type Replay = {
  v: 1;
  label: "Simulation";
  seed: number;
  area: string;
  attribution: string;
  center: [number, number];
  bounds: [[number, number], [number, number]];
  tick_s: number;
  /** Friends' positions per tick: [lat*1e5, lon*1e5, ...] in friend order, and one status digit each. */
  frames: { p: number[]; s: string }[];
  friends: SimFriend[];
  gatherings: SimGathering[];
  log: { t: number; text: string }[];
  stats: SimStats;
};

/** Gathering state at time t (seconds), from its events. */
export function stateAt(g: SimGathering, t: number): SimGathering["events"][number] | null {
  let cur: SimGathering["events"][number] | null = null;
  for (const e of g.events) if (e.t <= t) cur = e;
  return cur;
}

/** Friend i's position at a fractional tick, linearly between frames. */
export function positionAt(r: Replay, i: number, tick: number): [number, number] {
  const k = Math.max(0, Math.min(r.frames.length - 1, Math.floor(tick)));
  const k2 = Math.min(r.frames.length - 1, k + 1);
  const f = tick - k;
  const a = r.frames[k]?.p ?? [];
  const b = r.frames[k2]?.p ?? a;
  const lat = ((a[2 * i] ?? 0) * (1 - f) + (b[2 * i] ?? 0) * f) / 1e5;
  const lon = ((a[2 * i + 1] ?? 0) * (1 - f) + (b[2 * i + 1] ?? 0) * f) / 1e5;
  return [lat, lon];
}

export function clock(t: number): string {
  const m = Math.floor(t / 60);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}
