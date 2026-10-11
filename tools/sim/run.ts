// Virtual Fairlane: a SIMULATION of 30 to 60 made-up friends on the real Fairlane OSM data.
// They walk the real footways and say yes to Flares and Plans through the real Flare server
// (real engine, scheduler and sweeper, Postgres in memory) with a test clock. Embers, fades,
// Sparks and deletion all come from the engine; this script only plays the people.
// Writes apps/web/static/sim/replay-<seed>.json for the /sim/ page.
// Usage: npm run sim -- --seed 42 [--friends 48] [--minutes 200]
import { createHmac } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { LatLon, MapPack, Needs, Place } from "@flare/shared/icd/map";
import { createGuide, type Guide } from "../../apps/web/src/lib/compass/guide.ts";
import { bearingDeg, destination, distanceM } from "../../apps/web/src/lib/map/geo.ts";
import { places } from "../../apps/web/src/lib/map/pack.ts";
import { graph, type PathsPack } from "../../apps/web/src/lib/map/paths.ts";
import { checkNeeds, emberCandidates, nameSpot, SEAT_KINDS } from "../../apps/web/src/lib/map/places.ts";
import {
  type Personality,
  type Replay,
  type SimGathering,
  type SimState,
  type SimStats,
  STATUS,
  type Status,
} from "../../apps/web/src/lib/sim/replay.ts";
import { component, ct, type Member, ROOT, rng, route, Server, sleep, snap } from "./lib.ts";

// ---------- options ----------
const arg = (name: string, def: number) => {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? Number(process.argv[i + 1]) : def;
  if (!Number.isFinite(v)) throw new Error(`--${name} must be a number`);
  return v;
};
const SEED = arg("seed", 42);
const FRIENDS = Math.max(30, Math.min(60, arg("friends", 48)));
const MINUTES = Math.max(60, arg("minutes", 200));
const TICK_S = 15;
const SYNC_TICKS = 4; // let the server's 1 s scheduler run every simulated minute
const MIN = 60;
const R = rng(SEED);

// biome-ignore format: a compact list
const NAMES = [
  "Ada", "Ben", "Cleo", "Dev", "Esme", "Finn", "Gia", "Hugo", "Ines", "Jude", "Kai", "Lena",
  "Milo", "Nora", "Omar", "Pia", "Quin", "Rosa", "Sami", "Tess", "Umar", "Vera", "Wes", "Xena",
  "Yara", "Zed", "Abe", "Bea", "Cy", "Dina", "Eli", "Fay", "Gus", "Hana", "Ivo", "Jo",
  "Kit", "Lou", "Max", "Nia", "Otto", "Pam", "Ray", "Sia", "Tom", "Uma", "Viv", "Wren",
  "Yuki", "Zoe", "Ari", "Bo", "Cal", "Dot", "Ed", "Flo", "Gil", "Hal", "Ida", "Jem",
];
const GROUPS = ["A", "B", "C", "D", "E"];

// ---------- the real map ----------
const pack = JSON.parse(fs.readFileSync(path.join(ROOT, "apps/web/static/maps/fairlane.json"), "utf8")) as MapPack;
const pathsPack = JSON.parse(
  fs.readFileSync(path.join(ROOT, "apps/web/static/maps/fairlane-paths.json"), "utf8"),
) as PathsPack;
const G = graph(pathsPack);
const center: LatLon = { lat: pack.center[0], lon: pack.center[1] };
const NET = component(G, snap(G, new Set(G.adj.map((_, i) => i)), center));
const netNodes = [...NET].sort((a, b) => a - b);
const seats = places(pack).filter((p) => SEAT_KINDS.has(p.kind) && p.tags.access !== "private");
const BENCH_NEEDS: Needs = { avoid_steps: false, rest_gap_m: 200, restroom_300m: false };

const ll = (p: LatLon): [number, number] => [Math.round(p.lat * 1e5) / 1e5, Math.round(p.lon * 1e5) / 1e5];
const nameOf = (p: LatLon) => nameSpot(pack, p)?.name ?? "a bench";
const nearestSeats = (p: LatLon, minM: number, maxM: number) =>
  seats
    .map((s) => ({ s, m: distanceM(p, s) }))
    .filter((x) => x.m >= minM && x.m <= maxM)
    .sort((a, b) => a.m - b.m || (a.s.osm_id < b.s.osm_id ? -1 : 1));

// ---------- friends ----------
type Walk = { pts: LatLon[]; i: number; purpose: Status; gathering: Gath | null; rests: LatLon[] };
type Friend = {
  idx: number;
  key: string;
  name: string;
  type: Personality;
  group: string;
  m: Member;
  home: LatLon;
  pos: LatLon;
  speed: number;
  buddy: Friend | null;
  walk: Walk | null;
  restUntil: number;
  guide: Guide | null;
  busy: Gath | null;
  status: Status;
};

type Answer = { answer: "yes" | "cant_make_it"; ember_only?: boolean; rules?: unknown[] };
type Gath = {
  key: string;
  id: string;
  kind: "flare" | "plan";
  group: string;
  host: Friend;
  members: Friend[];
  spot: LatLon;
  quorum: number;
  createdT: number;
  cands: Place[];
  steps?: { step: number; minutes: number; at: LatLon; name: string }[];
  startT?: number;
  state: SimState;
  need: number;
  headcount: number | null;
  answers: Map<Friend, Answer>;
  looked: Set<Friend>;
  meet: LatLon | null;
  litT: number | null;
  wasEmber: boolean;
  doneSent: boolean;
  inSet: Friend[];
  arrived: Set<Friend>;
  tickets: Map<Friend, string>;
  sparks: number;
  rec: SimGathering;
};

const S = new Server();
const log: Replay["log"] = [];
const say = (t: number, text: string) => {
  log.push({ t, text });
  if (process.env.SIM_VERBOSE) console.info(`${String(Math.floor(t / 60)).padStart(3)} min  ${text}`);
};
const queue: { t: number; n: number; fn: () => Promise<void> | void }[] = [];
let qn = 0;
const at = (t: number, fn: () => Promise<void> | void) => {
  queue.push({ t, n: qn++, fn });
  queue.sort((a, b) => a.t - b.t || a.n - b.n);
};
let now = 0; // simulated seconds since start
let server0 = 0; // server clock (ms) at simulated 0
const serverIso = (t = now) => new Date(server0 + t * 1000).toISOString();

const friends: Friend[] = [];
const groups: { key: string; id: string; anchor: LatLon; members: Friend[] }[] = [];
const gathers: Gath[] = [];

function pickHome(anchor: LatLon, maxM: number): LatLon {
  for (let k = 0; k < 400; k++) {
    const n = R.pick(netNodes);
    const p = G.at(n);
    if (distanceM(p, anchor) <= maxM) return p;
  }
  return anchor;
}

function personalityMix(n: number): Personality[] {
  const base: Personality[] = ["planner", "lazy", "lazy", "conditional", "conditional", "bench", "bench", "lowvision"];
  const out = base.slice(0, Math.min(base.length, n));
  while (out.length < n) out.push("keen");
  return R.shuffle(out);
}

async function makeGroups() {
  const nGroups = Math.ceil(FRIENDS / 12);
  const per = Math.ceil(FRIENDS / nGroups);
  for (let gi = 0; gi < nGroups; gi++) {
    // Each group lives around a different bench cluster (Fairlane's seats are few and clustered).
    const taken = groups.map((x) => x.anchor);
    const free = R.shuffle(
      seats.filter((s) => distanceM(s, center) < 2200 && taken.every((a) => distanceM(a, s) > 700)),
    );
    const anchorGuess = free[0] ?? destination(center, (360 / nGroups) * gi, 800);
    const anchor = G.at(snap(G, NET, anchorGuess));
    const size = Math.min(per, FRIENDS - friends.length);
    const types = personalityMix(size);
    const key = GROUPS[gi] as string;
    const members: Friend[] = [];
    for (let k = 0; k < size; k++) {
      const idx = friends.length;
      const home = pickHome(anchor, 650);
      const type = types[k] as Personality;
      const f: Friend = {
        idx,
        key: `f${String(idx + 1).padStart(2, "0")}`,
        name: NAMES[idx % NAMES.length] as string,
        type,
        group: key,
        m: { id: R.uuid(), token: ct(16), name_ct: ct(24) },
        home,
        pos: home,
        speed: type === "lowvision" ? R.between(1.0, 1.1) : R.between(1.0, 1.4),
        buddy: null,
        walk: null,
        restUntil: 0,
        guide: null,
        busy: null,
        status: STATUS.home,
      };
      friends.push(f);
      members.push(f);
    }
    for (const f of members)
      if (f.type === "conditional") f.buddy = R.pick(members.filter((x) => x !== f && x.type !== "conditional"));
    const id = R.uuid();
    const host = members[0] as Friend;
    const r = await S.call("POST", "/api/v1/groups", {
      body: { id, member: { id: host.m.id, name_ct: host.m.name_ct, write_token: host.m.token } },
    });
    if (r.status !== 201 && r.status !== 200) throw new Error(`group create ${r.status} ${JSON.stringify(r.body)}`);
    for (const f of members.slice(1)) {
      const j = await S.call("POST", `/api/v1/groups/${id}/members`, {
        body: { id: f.m.id, name_ct: f.m.name_ct, write_token: f.m.token },
      });
      if (j.status >= 300) throw new Error(`join ${j.status} ${JSON.stringify(j.body)}`);
    }
    groups.push({ key, id, anchor, members });
    // Joining is limited per address per minute; let the window pass between groups.
    await S.advance(61_000);
  }
}

// ---------- walking ----------
function startWalk(f: Friend, to: LatLon, purpose: Status, gathering: Gath | null) {
  const pts = route(G, NET, f.pos, to);
  const rests: LatLon[] = [];
  if (f.type === "bench") {
    // Sit on benches on the way, about every 200 m (the "rest gap 200 m" need).
    let since = 0;
    for (let i = 1; i < pts.length; i++) {
      since += distanceM(pts[i - 1] as LatLon, pts[i] as LatLon);
      if (since < 180) continue;
      const s = seats.find((x) => distanceM(x, pts[i] as LatLon) < 25);
      if (s) {
        rests.push(pts[i] as LatLon);
        since = 0;
      }
    }
  }
  f.walk = { pts, i: 1, purpose, gathering, rests };
  f.status = purpose;
  f.guide = f.type === "lowvision" ? createGuide(pts[1] ?? to) : null;
}

const walkSeconds = (f: Friend, to: LatLon) => {
  const pts = route(G, NET, f.pos, to);
  let m = 0;
  for (let i = 1; i < pts.length; i++) m += distanceM(pts[i - 1] as LatLon, pts[i] as LatLon);
  return m / f.speed;
};

/** One tick of walking. Returns true when the walk ended this tick. */
function step(f: Friend, dt: number): boolean {
  const w = f.walk;
  if (!w) return false;
  if (now < f.restUntil) {
    f.status = STATUS.resting;
    return false;
  }
  f.status = w.purpose;
  if (f.guide) {
    // Low vision: follow the compass guide (real createGuide) one second at a time, toward the
    // next corner of the route; "near" means move on to the next corner.
    for (let s = 0; s < dt; s++) {
      const target = w.pts[w.i];
      if (!target) break;
      const tMs = (now + s) * 1000;
      const st = f.guide.position({ ...f.pos, t: tMs, accuracy: 4, speed: f.speed, course: bearingDeg(f.pos, target) });
      if (st.near || (st.distance_m ?? 0) < 1) {
        w.i++;
        const nextT = w.pts[w.i];
        if (!nextT) {
          f.pos = target;
          break;
        }
        f.guide.setTarget(nextT);
        continue;
      }
      const b = st.bearing_deg ?? bearingDeg(f.pos, target);
      f.pos = destination(f.pos, b + R.between(-6, 6), Math.min(f.speed, st.distance_m ?? f.speed));
    }
    if (w.i >= w.pts.length) {
      f.walk = null;
      return true;
    }
    return false;
  }
  let left = f.speed * dt;
  while (left > 0 && w.i < w.pts.length) {
    const target = w.pts[w.i] as LatLon;
    const d = distanceM(f.pos, target);
    if (d <= left) {
      f.pos = target;
      left -= d;
      w.i++;
      const r = w.rests.indexOf(target);
      if (r >= 0) {
        w.rests.splice(r, 1);
        f.restUntil = now + 60;
        f.status = STATUS.resting;
        break;
      }
    } else {
      f.pos = destination(f.pos, bearingDeg(f.pos, target), left);
      left = 0;
    }
  }
  if (w.i >= w.pts.length) {
    f.walk = null;
    return true;
  }
  return false;
}

// ---------- gatherings ----------
function record(
  g: Gath,
  view: { state: SimState; need: number; quorum: number; headcount?: number | null },
  note?: string,
) {
  const last = g.rec.events[g.rec.events.length - 1];
  const e = { t: now, state: view.state, need: view.need ?? 0, quorum: view.quorum, headcount: view.headcount ?? null };
  if (last && last.state === e.state && last.need === e.need && last.quorum === e.quorum && !note) return;
  g.rec.events.push(note ? { ...e, note } : e);
}

function newGath(kind: "flare" | "plan", host: Friend, spot: LatLon, quorum: number): Gath {
  const grp = groups.find((x) => x.key === host.group) as (typeof groups)[number];
  const key = `g${String(gathers.length + 1).padStart(2, "0")}`;
  const g: Gath = {
    key,
    id: R.uuid(),
    kind,
    group: host.group,
    host,
    members: grp.members.filter((f) => f !== host),
    spot,
    quorum,
    createdT: now,
    cands:
      kind === "flare"
        ? emberCandidates(pack, spot)
            .filter((p) => distanceM(p, spot) > 15)
            .slice(0, 3)
        : [],
    state: "kindling",
    need: quorum - 1,
    headcount: null,
    answers: new Map(),
    looked: new Set(),
    meet: null,
    litT: null,
    wasEmber: false,
    doneSent: false,
    inSet: [],
    arrived: new Set(),
    tickets: new Map(),
    sparks: 0,
    rec: {
      key,
      kind,
      group: host.group,
      host: host.key,
      spot: ll(spot),
      spot_name: nameOf(spot),
      quorum,
      created_t: now,
      ember_candidates: [],
      events: [],
      meet: null,
      outcome: "pending",
      lit_after_s: null,
      arrivals: 0,
      sparks: 0,
    },
  };
  g.rec.ember_candidates = g.cands.map(ll);
  return g;
}

/** A host walks to a bench near home, then sends a Flare from there. */
function planFlare(t: number, host: Friend, quorum: number) {
  at(t, () => {
    if (host.busy || host.walk) return;
    const options = nearestSeats(host.home, 120, 900);
    // No bench nearby: send it from a corner of the paths 200 to 400 m away, like a real Flare.
    const corner = () => {
      const near = G.within(host.home, 400).filter((v) => NET.has(v) && distanceM(G.at(v), host.home) > 200);
      return near.length ? G.at(R.pick(near.sort((a, b) => a - b))) : host.home;
    };
    const seat = options.length ? (options[R.int(0, Math.min(5, options.length - 1))] ?? options[0])?.s : corner();
    if (!seat) return;
    host.busy = {} as Gath; // reserved while walking to the spot
    say(now, `${host.name} (group ${host.group}) walks to ${nameOf(seat)} to send a Flare.`);
    startWalk(host, seat, STATUS.toSpot, null);
    pendingSpot.set(host, { quorum, seat });
  });
}
const pendingSpot = new Map<Friend, { quorum: number; seat: LatLon }>();

async function sendFlare(host: Friend, seat: LatLon, quorum: number) {
  const g = newGath("flare", host, seat, quorum);
  const grp = groups.find((x) => x.key === host.group) as (typeof groups)[number];
  const r = await S.call("POST", `/api/v1/groups/${grp.id}/gatherings`, {
    as: host.m,
    body: {
      id: g.id,
      kind: "flare",
      quorum,
      tz: "America/Detroit",
      sealed: ct(64),
      notice_ct: ct(32),
      ...(g.cands.length ? { ember_candidates: g.cands.map((_, i) => `c${i + 1}`) } : {}),
    },
  });
  if (r.status !== 201) {
    say(now, `${host.name}'s Flare was refused (${r.status} ${r.body?.code ?? ""}).`);
    host.busy = null;
    startWalk(host, host.home, STATUS.toHome, null);
    return;
  }
  host.busy = g;
  host.status = STATUS.there;
  gathers.push(g);
  record(g, r.body);
  say(now, `${host.name} sent a Flare at ${g.rec.spot_name}: needs ${quorum} including ${host.name}.`);
  // Some see it right away, some only after half an hour.
  // A third miss it (phone in a bag); some see it right away, some only after half an hour.
  for (const f of g.members) if (R.chance(0.67)) scheduleLook(g, f, now + R.between(1, 34) * MIN);
}

function planPlan(t: number, host: Friend) {
  at(t, async () => {
    if (host.busy) return;
    const grp = groups.find((x) => x.key === host.group) as (typeof groups)[number];
    // Step 1 is the big one far away, step 4 a short sit near home (smaller is closer).
    const wanted = [1100, 700, 350, 120];
    const used = new Set<string>();
    const steps = wanted.map((d, i) => {
      const list = nearestSeats(grp.anchor, d * 0.7, d * 1.5).filter((x) => !used.has(x.s.osm_id));
      const s = (list[0]?.s ?? nearestSeats(grp.anchor, 0, 3000)[i]?.s) as Place;
      used.add(s.osm_id);
      return { step: i + 1, minutes: [60, 30, 15, 10][i] as number, at: { lat: s.lat, lon: s.lon }, name: nameOf(s) };
    });
    const g = newGath("plan", host, (steps[0] as { at: LatLon }).at, 3);
    g.steps = steps;
    g.startT = now + 60 * MIN;
    g.rec.steps = steps.map((s) => ({ ...s, at: ll(s.at) }));
    const r = await S.call("POST", `/api/v1/groups/${grp.id}/gatherings`, {
      as: host.m,
      body: {
        id: g.id,
        kind: "plan",
        quorum: 3,
        tz: "America/Detroit",
        sealed: ct(64),
        notice_ct: ct(32),
        plan: {
          start_at: serverIso(now + 60 * MIN),
          deadline_at: serverIso(now + 30 * MIN),
          steps: steps.map((s) => ({ step: s.step, minutes: s.minutes, place: `step:${s.step}` })),
        },
      },
    });
    if (r.status !== 201) {
      say(now, `${host.name}'s Plan was refused (${r.status} ${r.body?.code ?? ""}).`);
      return;
    }
    host.busy = g;
    gathers.push(g);
    record(g, r.body);
    say(
      now,
      `${host.name} (planner, group ${host.group}) sent a Plan for an hour from now: ${steps[0]?.name} or smaller.`,
    );
    for (const f of g.members) scheduleLook(g, f, now + R.between(1, 15) * MIN);
  });
}

function scheduleLook(g: Gath, f: Friend, t: number) {
  at(t, () => look(g, f));
}

async function answer(g: Gath, f: Friend, a: Answer, why: string) {
  const r = await S.call("PUT", `/api/v1/gatherings/${g.id}/me`, {
    as: f.m,
    body: { answer: a.answer, ...(a.rules ? { rules: a.rules } : {}), ...(a.ember_only ? { ember_only: true } : {}) },
  });
  if (r.status !== 200) {
    say(now, `${f.name}'s answer to ${g.key} was refused (${r.status} ${r.body?.code ?? ""}, ${g.state}).`);
    return;
  }
  g.answers.set(f, a);
  if (a.answer === "yes" && !a.ember_only && g.kind === "flare") f.busy = g;
  say(now, `${f.name} (${f.type}) ${why}.`);
  await refresh(g);
}

/** A friend opens the notice and decides, by personality. Only the engine counts. */
async function look(g: Gath, f: Friend) {
  if ((["gone", "deleted"] as SimState[]).includes(g.state) || g.answers.has(f)) return;
  if (g.state === "lit" && g.kind === "flare") return; // too late, it's on without them
  g.looked.add(f);
  const target = g.kind === "plan" ? ((g.steps?.[1]?.at ?? g.spot) as LatLon) : g.spot;
  const walkMin = walkSeconds(f, target) / 60;
  // Before Lit there is no "no" (SRS-RES-6): people who can't come just let it pass.
  if (f.busy && f.busy !== g) return say(now, `${f.name} lets ${g.key} pass (already at another one).`);
  if (g.kind === "flare" && walkMin > 25)
    return say(now, `${f.name} lets ${g.key} pass (${Math.round(walkMin)} min walk).`);
  const v = (await S.call("GET", `/api/v1/gatherings/${g.id}`)).body;
  const inNow = (v?.quorum ?? g.quorum) - (v?.need ?? g.need);
  switch (f.type) {
    case "lazy": {
      if (inNow >= 3) return answer(g, f, { answer: "yes" }, `says yes: ${inNow} are already in`);
      if (now - g.createdT < 25 * MIN) scheduleLook(g, f, now + 4 * MIN);
      return;
    }
    case "conditional": {
      const b = f.buddy as Friend;
      return answer(
        g,
        f,
        { answer: "yes", rules: [{ type: "with", member_id: b.m.id }] },
        `says yes, only if ${b.name} goes`,
      );
    }
    case "bench": {
      if (g.kind === "plan") {
        const steps = g.steps ?? [];
        let max = 0;
        for (let s = steps.length; s >= 1; s--) {
          if (!checkNeeds(pack, BENCH_NEEDS, f.home, (steps[s - 1] as { at: LatLon }).at)) break;
          max = s;
        }
        if (!max) return say(now, `${f.name} lets ${g.key} pass (no bench near the small steps).`);
        return answer(
          g,
          f,
          { answer: "yes", rules: [{ type: "max_step", step: max }] },
          `says yes for step ${max} or smaller (needs a bench every 200 m)`,
        );
      }
      if (checkNeeds(pack, BENCH_NEEDS, f.home, g.spot))
        return answer(g, f, { answer: "yes" }, "says yes: there's a bench within 200 m");
      return answer(g, f, { answer: "yes", ember_only: true }, `says "count me in for a closer one" (no bench near)`);
    }
    case "lowvision": {
      if (R.chance(0.75))
        return answer(
          g,
          f,
          { answer: "yes", ...(g.kind === "plan" ? { rules: [{ type: "max_step", step: 3 }] } : {}) },
          "says yes (will follow the compass)",
        );
      return;
    }
    default: {
      // Farther is less likely; Plans give people time, so more say yes.
      const p = (g.kind === "plan" ? 0.6 : 0.4) - walkMin / 60;
      if (R.chance(p)) {
        const rules = g.kind === "plan" && R.chance(0.35) ? [{ type: "max_step", step: R.int(2, 4) }] : undefined;
        return answer(
          g,
          f,
          { answer: "yes", ...(rules ? { rules } : {}) },
          rules ? `says yes, step ${rules[0]?.step} or smaller` : "says yes",
        );
      }
      // The rest just don't answer, like real people.
    }
  }
}

/** Reads the gathering from the server and reacts to what the engine decided. */
async function refresh(g: Gath) {
  if (g.state === "deleted") return;
  const r = await S.call("GET", `/api/v1/gatherings/${g.id}`);
  if (r.status === 404) {
    g.state = "deleted";
    g.rec.events.push({ t: now, state: "deleted", need: 0, quorum: g.quorum, headcount: g.headcount });
    say(now, `${g.key} is deleted from the server.`);
    return;
  }
  if (r.status === 410) {
    if (g.state !== "gone") await onGone(g, "gone");
    return;
  }
  const v = r.body;
  const prev = g.state;
  g.need = v.need;
  g.headcount = v.headcount ?? null;
  g.state = v.state;
  record(g, v);
  if (prev !== "ember" && v.state === "ember") await onEmber(g, v);
  if (prev !== "lit" && v.state === "lit") await onLit(g, v);
  if (v.state === "gone" && prev !== "gone") await onGone(g, v.ended ?? "gone");
}

async function onEmber(g: Gath, v: { quorum: number }) {
  g.wasEmber = true;
  say(now, `${g.key} (${g.host.name}) didn't get enough yeses in 30 min: it's an Ember now, needs ${v.quorum}.`);
  // Everyone who's in reports the bench checks for c1..cN (BR-E-4 counts silence as a pass).
  const results = Object.fromEntries(g.cands.map((c, i) => [`c${i + 1}`, c.tags.backrest !== "no" && R.chance(0.85)]));
  for (const f of [g.host, ...g.answers.keys()]) {
    const a = g.answers.get(f);
    if (f !== g.host && a?.answer !== "yes") continue;
    await S.call("PUT", `/api/v1/gatherings/${g.id}/me/checks`, { as: f.m, body: { results } });
  }
  // A smaller, closer one: a couple of quiet friends look again.
  for (const f of g.members)
    if (!g.answers.has(f) && !f.busy && R.chance(0.5)) scheduleLook(g, f, now + R.between(1, 4) * MIN);
}

async function onLit(
  g: Gath,
  v: { ember_choice?: string | null; plan?: { current_step: number } | null; headcount?: number | null },
) {
  g.litT = now;
  g.rec.lit_after_s = now - g.createdT;
  g.rec.outcome = g.wasEmber ? "ember_lit" : "lit";
  let meet = g.spot;
  let where = g.rec.spot_name;
  if (g.kind === "flare" && v.ember_choice) {
    const i = Number(v.ember_choice.slice(1)) - 1;
    const c = g.cands[i];
    if (c) {
      meet = c;
      where = `the Ember bench ${v.ember_choice} (${nameOf(c)})`;
    }
  }
  if (g.kind === "plan" && v.plan) {
    const s = g.steps?.[v.plan.current_step - 1];
    if (s) {
      meet = s.at;
      where = `step ${s.step}, ${s.name} for ${s.minutes} min`;
    }
  }
  g.meet = meet;
  g.rec.meet = ll(meet);
  // Ask each person who said yes whether they're in the set (only ever about them).
  g.inSet = [g.host];
  for (const [f, a] of g.answers) {
    if (a.answer !== "yes") continue;
    const me = (await S.call("GET", `/api/v1/gatherings/${g.id}/me`, { as: f.m })).body;
    if (me?.in_set) g.inSet.push(f);
    else if (f.busy === g) f.busy = null;
  }
  say(now, `${g.key} is Lit after ${Math.round((now - g.createdT) / 60)} min: ${g.inSet.length} going to ${where}.`);
  for (const f of g.inSet) {
    f.busy = g;
    if (g.kind === "flare") startWalk(f, meet, STATUS.toGathering, g);
    else {
      const leave = Math.max(now, (g.startT as number) - walkSeconds(f, meet) - 2 * MIN);
      at(leave, () => startWalk(f, meet, STATUS.toGathering, g));
    }
  }
  // The host ends it: when everyone's there, or after a while.
  const stepMin = g.kind === "plan" ? (g.steps?.[(v.plan?.current_step ?? 1) - 1]?.minutes ?? 15) : 20;
  const end = g.kind === "plan" ? (g.startT as number) + stepMin * MIN : now + 45 * MIN;
  at(end, () => done(g));
}

async function arrive(f: Friend, g: Gath) {
  f.status = STATUS.there;
  if (g.state !== "lit") return;
  const r = await S.call("POST", `/api/v1/gatherings/${g.id}/arrivals`, {
    as: f.m,
    body: { for: "self", recorded_at: serverIso() },
  });
  if (r.body?.counted) {
    g.arrived.add(f);
    if (r.body.spark_ticket) g.tickets.set(f, r.body.spark_ticket);
    say(now, `${f.name} is here (${g.key}).`);
  }
  if (g.kind === "flare" && g.arrived.size >= g.inSet.length && g.arrived.size > 0)
    at(now + R.between(10, 20) * MIN, () => done(g));
}

async function done(g: Gath) {
  if (g.doneSent || g.state !== "lit") return;
  g.doneSent = true;
  const r = await S.call("POST", `/api/v1/gatherings/${g.id}/done`, { as: g.host.m });
  if (r.status === 200) say(now, `${g.host.name} tapped Done on ${g.key}: thanks for coming.`);
  await refresh(g);
}

async function onGone(g: Gath, ended: string) {
  g.state = "gone";
  if (!g.rec.events.some((e) => e.state === "gone"))
    g.rec.events.push({ t: now, state: "gone", need: 0, quorum: g.quorum, headcount: g.headcount, note: ended });
  if (g.litT === null) {
    g.rec.outcome = "faded_out";
    say(now, `${g.key} (${g.host.name}) is Gone without lighting.`);
  }
  // One Spark per ticket, after Done (BR-K-1). The place is a keyed hash, like the phone's.
  const grp = groups.find((x) => x.key === g.group) as (typeof groups)[number];
  for (const [f, ticket] of g.tickets) {
    if (!R.chance(0.6)) continue;
    const place = createHmac("sha256", grp.id)
      .update(`${ll(g.meet ?? g.spot).join(",")}`)
      .digest("base64url");
    const s = await S.call("POST", `/api/v1/groups/${grp.id}/sparks`, {
      as: f.m,
      body: { id: R.uuid(), ticket, place, text_ct: ct(80), delete_token: ct(16) },
    });
    if (s.status === 201) {
      g.sparks++;
      say(now, `${f.name} left a Spark at ${g.key}'s place.`);
    }
  }
  g.rec.arrivals = g.arrived.size;
  g.rec.sparks = g.sparks;
  for (const f of friends) {
    if (f.busy !== g) continue;
    f.busy = null;
    if (f.walk?.gathering === g || f.status === STATUS.there || f.status === STATUS.toGathering || f === g.host)
      startWalk(f, f.home, STATUS.toHome, null);
  }
}

// ---------- the run ----------
function scenario() {
  for (const [gi, grp] of groups.entries()) {
    const o = gi * 7 * MIN;
    const notPlanner = grp.members.filter((f) => f.type !== "planner" && f.type !== "lowvision");
    const hosts = R.shuffle([...notPlanner]);
    planFlare(o + 2 * MIN, hosts[0] as Friend, 3);
    const planner = grp.members.find((f) => f.type === "planner");
    if (planner) planPlan(o + 12 * MIN, planner);
    planFlare(o + 75 * MIN, hosts[1] as Friend, 4); // ambitious: likely an Ember
    planFlare(o + 120 * MIN, hosts[2] as Friend, 2);
  }
}

function frame(): { p: number[]; s: string } {
  const p: number[] = [];
  let s = "";
  for (const f of friends) {
    p.push(Math.round(f.pos.lat * 1e5), Math.round(f.pos.lon * 1e5));
    s += String(f.status);
  }
  return { p, s };
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const a = [...xs].sort((x, y) => x - y);
  const m = a.length >> 1;
  return a.length % 2 ? (a[m] as number) : ((a[m - 1] as number) + (a[m] as number)) / 2;
}

async function main() {
  const t0 = Date.now();
  await S.start();
  await makeGroups();
  server0 = await S.advance(0);
  scenario();
  const frames: Replay["frames"] = [];
  const ticks = Math.ceil((MINUTES * MIN) / TICK_S);
  for (let k = 0; k <= ticks; k++) {
    now = k * TICK_S;
    while (queue.length && (queue[0] as { t: number }).t <= now)
      await (queue.shift() as { fn: () => Promise<void> }).fn();
    for (const f of friends) {
      const purpose = f.walk?.purpose;
      const g = f.walk?.gathering ?? null;
      if (!step(f, TICK_S)) continue;
      if (purpose === STATUS.toHome) f.status = STATUS.home;
      else if (purpose === STATUS.toSpot) {
        const p = pendingSpot.get(f);
        pendingSpot.delete(f);
        if (p) await sendFlare(f, p.seat, p.quorum);
      } else if (purpose === STATUS.toGathering && g) await arrive(f, g);
    }
    frames.push(frame());
    if (k === ticks) break;
    await S.advance(TICK_S * 1000);
    if (k % SYNC_TICKS === SYNC_TICKS - 1) {
      await sleep(1200);
      for (const g of gathers) await refresh(g);
    }
    if (k % 80 === 0) process.stdout.write(`\r  simulated ${Math.round(now / 60)} of ${MINUTES} min`);
  }
  process.stdout.write("\n");

  // Fast-forward (no more frames) until the engine has deleted everything, then audit.
  let extra = 0;
  while (gathers.some((g) => g.state !== "deleted") && extra < 6 * 60) {
    now += 10 * MIN;
    extra += 10;
    await S.advance(10 * MIN * 1000);
    await sleep(1300);
    for (const g of gathers) await refresh(g);
  }
  const audit = (await S.call("GET", "/api/v1/audit")).body;
  const expired = (audit?.stores ?? [])
    .filter((s: { per_gathering: boolean }) => s.per_gathering)
    .reduce((n: number, s: { expired_rows: number }) => n + (s.expired_rows ?? 0), 0);
  say(now, `Deletion audit: ${audit?.pass ? "pass" : "FAIL"}, ${expired} expired rows left.`);

  const lit = gathers.filter((g) => g.litT !== null);
  const embers = gathers.filter((g) => g.wasEmber);
  const embersLit = embers.filter((g) => g.litT !== null);
  const stats: SimStats = {
    friends: friends.length,
    groups: groups.length,
    gatherings: gathers.length,
    flares: gathers.filter((g) => g.kind === "flare").length,
    plans: gathers.filter((g) => g.kind === "plan").length,
    lit: lit.length,
    light_rate: gathers.length ? Math.round((lit.length / gathers.length) * 1000) / 1000 : 0,
    embers: embers.length,
    embers_lit: embersLit.length,
    ember_save_rate: embers.length ? Math.round((embersLit.length / embers.length) * 1000) / 1000 : null,
    median_min_to_lit: median(lit.map((g) => ((g.litT as number) - g.createdT) / 60)),
    median_min_to_lit_flares: median(
      lit.filter((g) => g.kind === "flare").map((g) => ((g.litT as number) - g.createdT) / 60),
    ),
    headcount_total: lit.reduce((n, g) => n + (g.headcount ?? g.inSet.length), 0),
    arrivals: gathers.reduce((n, g) => n + g.arrived.size, 0),
    sparks: gathers.reduce((n, g) => n + g.sparks, 0),
    deleted: gathers.filter((g) => g.state === "deleted").length,
    audit_pass: audit?.pass === true,
    audit_expired_rows: expired,
  };
  for (const g of gathers) {
    g.rec.arrivals = g.arrived.size;
    g.rec.sparks = g.sparks;
  }
  const all = frames.flatMap((f) => f.p);
  const lats = all.filter((_, i) => i % 2 === 0);
  const lons = all.filter((_, i) => i % 2 === 1);
  const replay: Replay = {
    v: 1,
    label: "Simulation",
    seed: SEED,
    area: "fairlane",
    attribution: pack.attribution,
    center: pack.center,
    bounds: [
      [Math.min(...lats) / 1e5, Math.min(...lons) / 1e5],
      [Math.max(...lats) / 1e5, Math.max(...lons) / 1e5],
    ],
    tick_s: TICK_S,
    frames,
    friends: friends.map((f) => ({
      key: f.key,
      name: f.name,
      type: f.type,
      group: f.group,
      speed_mps: Math.round(f.speed * 100) / 100,
    })),
    gatherings: gathers.map((g) => g.rec),
    log,
    stats,
  };
  const out = path.join(ROOT, `apps/web/static/sim/replay-${SEED}.json`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(replay)}\n`);
  console.info(`Virtual Fairlane (simulation), seed ${SEED}: ${path.relative(ROOT, out)}`);
  console.info(JSON.stringify(stats, null, 2));
  console.info(`server calls: ${S.writes} writes, ${S.reads} reads; ${Math.round((Date.now() - t0) / 1000)} s`);
  if (!stats.audit_pass || stats.audit_expired_rows !== 0 || stats.deleted !== stats.gatherings) process.exitCode = 1;
}

main()
  .catch((e: unknown) => {
    console.error(`FAIL ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`);
    process.exitCode = 1;
  })
  .finally(() => S.stop());
