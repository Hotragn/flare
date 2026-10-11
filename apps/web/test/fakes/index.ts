// Fakes for the phone modules other work packages build, typed by the frozen ICDs
// (docs/engineering/02-interface-control.md section 4). Test code only, never shipped.
import type { Iso, Rule, State } from "@flare/shared/icd/engine";
import type { CapabilitiesIcd, ClientIcd, ConditionsIcd, MapIcd } from "@flare/shared/icd/index";
import type { GatheringView, Me } from "../../src/lib/screens/flow/api-types.ts";
import type { Deps, StoreExtras } from "../../src/lib/screens/flow/deps.ts";

const b64 = (b: Uint8Array) => Buffer.from(b).toString("base64url");
const unb64 = (s: string) => new Uint8Array(Buffer.from(s, "base64url"));

/** Pass-through sealing: base64url(aad ‖ 0x00 ‖ plain). Open checks the AAD and the key id. */
export function fakeCrypto(): ClientIcd.Crypto & { keyOf(fragment: string): CryptoKey } {
  const keys = new Map<string, CryptoKey>();
  const ids = new WeakMap<CryptoKey, string>();
  const make = (fragment: string) => {
    let k = keys.get(fragment);
    if (!k) {
      k = { type: "secret", algorithm: { name: "AES-GCM" }, extractable: false, usages: [] } as unknown as CryptoKey;
      keys.set(fragment, k);
      ids.set(k, fragment);
    }
    return k;
  };
  const seal = async (key: CryptoKey, aad: string, plain: Uint8Array) =>
    b64(new Uint8Array([...new TextEncoder().encode(`${ids.get(key)}|${aad}`), 0, ...plain]));
  const open = async (key: CryptoKey, aad: string, sealed: string) => {
    const all = unb64(sealed);
    const cut = all.indexOf(0);
    if (new TextDecoder().decode(all.slice(0, cut)) !== `${ids.get(key)}|${aad}`) throw new Error("open failed");
    return all.slice(cut + 1);
  };
  return {
    keyOf: make,
    async newGroupKey() {
      const fragment = b64(crypto.getRandomValues(new Uint8Array(32)));
      return { key: make(fragment), fragment };
    },
    async importFragment(fragment) {
      if (!/^[A-Za-z0-9_-]{43}$/.test(fragment)) throw new Error("missing key");
      return make(fragment);
    },
    seal,
    open,
    async sealJson(key, aad, value) {
      return seal(key, aad, new TextEncoder().encode(JSON.stringify(value)));
    },
    async openJson<T>(key: CryptoKey, aad: ClientIcd.Aad, sealed: string): Promise<T> {
      return JSON.parse(new TextDecoder().decode(await open(key, aad, sealed))) as T;
    },
    async placeHash(_key, placeKey) {
      return b64(new Uint8Array(32).map((_, i) => placeKey.charCodeAt(i % placeKey.length) ?? 0)).slice(0, 43);
    },
  };
}

export function fakeStore(): StoreExtras & {
  lits: Map<string, unknown>;
  groups: Map<string, ClientIcd.GroupRecord>;
  remembered: Map<string, string>;
} {
  const groups = new Map<string, ClientIcd.GroupRecord>();
  const lits = new Map<string, unknown>();
  const remembered = new Map<string, string>();
  let needs: unknown = null;
  return {
    groups,
    lits,
    remembered,
    async fragment(id) {
      return groups.has(id) ? `fragment-of-${id}` : null;
    },
    async rememberGathering(gid, groupId) {
      remembered.set(gid, groupId);
    },
    async group(id) {
      return groups.get(id) ?? null;
    },
    async saveGroup(g) {
      groups.set(g.groupId, g);
    },
    async forget(id) {
      groups.delete(id);
    },
    async saveLit(id, data) {
      lits.set(id, data);
    },
    async lit<T>(id: string) {
      return (lits.get(id) as T) ?? null;
    },
    async needs<T>() {
      return needs as T | null;
    },
    async saveNeeds(n) {
      needs = n;
    },
  };
}

type Ans = { member: string; rules: Rule[]; ember_only: boolean; answer: "yes" | "cant_make_it"; arrived: boolean };
type G = GatheringView & { host: string; answers: Map<string, Ans>; photo: Uint8Array | null; faded: Set<string> };

/**
 * In-memory server for the routes the app calls (openapi.yaml v1.0.0). The engine stand-in
 * lights at quorum with no rules, the fake the ICD lists for consumers.
 */
export function fakeServer(clock: () => number) {
  const groups = new Map<string, { members: Map<string, { id: string; name_ct: string; token: string }> }>();
  const gatherings = new Map<string, G>();
  const listeners = new Map<string, Set<(v: GatheringView) => void>>();
  let offline = false;
  const iso = (): Iso => new Date(clock()).toISOString();

  const viewOf = (g: G): GatheringView => {
    const { host: _h, answers: _a, photo: _p, faded: _f, ...v } = g;
    return { ...v, server_time: iso() };
  };
  const yesCount = (g: G) => [...g.answers.values()].filter((a) => a.answer === "yes").length;
  const bump = (g: G, state?: State) => {
    if (state && state !== g.state) {
      g.state = state;
      g.state_since = iso();
    }
    g.version += 1;
    g.need = Math.max(0, g.quorum - yesCount(g));
    if (g.state === "kindling" && g.need === 0) {
      g.state = "lit";
      g.state_since = iso();
      g.headcount = 0;
    }
    for (const f of listeners.get(g.id) ?? []) f(viewOf(g));
  };
  const auth = (h: Headers | Record<string, string> | undefined): { group: string; member: string } | null => {
    const v = h instanceof Headers ? h.get("authorization") : h?.authorization;
    const m = v?.match(/^Bearer ([^.]+)\.(.+)$/);
    if (!m) return null;
    for (const [gid, gr] of groups) {
      const mem = gr.members.get(m[1] ?? "");
      if (mem && mem.token === m[2]) return { group: gid, member: mem.id };
    }
    return null;
  };
  const json = (status: number, body: unknown) =>
    new Response(body === null ? null : JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  const err = (status: number, code: string) => json(status, { code, message: code });
  const meOf = (g: G, member: string): Me => {
    const a = g.answers.get(member);
    return {
      member_id: member,
      is_host: g.host === member,
      answer: a?.answer ?? "none",
      rules: a?.rules ?? [],
      ember_only: a?.ember_only ?? false,
      in_set: g.state === "kindling" ? null : a?.answer === "yes",
      arrived: a?.arrived ?? false,
      can_take_back: g.state === "kindling" && a?.answer === "yes" && g.host !== member,
      can_fade: g.kind === "plan" && g.state === "lit" && !g.faded.has(member),
      still_coming: false,
    };
  };

  async function handle(method: string, path: string, body: unknown, who: { group: string; member: string } | null) {
    if (offline) throw new TypeError("Failed to fetch");
    const p = path.replace(/^\/api\/v1/, "");
    let m: RegExpMatchArray | null;
    if (method === "POST" && p === "/groups") {
      const b = body as { id: string; member: { id: string; name_ct: string; write_token: string } };
      groups.set(b.id, { members: new Map([[b.member.id, { ...b.member, token: b.member.write_token }]]) });
      return json(201, { id: b.id, channel: "link", members: [], live: [] });
    }
    m = p.match(/^\/groups\/([^/]+)\/members$/);
    if (m && method === "POST") {
      const gr = groups.get(m[1] ?? "");
      if (!gr) return err(404, "not_found");
      if (gr.members.size >= 12) return err(409, "group_full");
      const b = body as { id: string; name_ct: string; write_token: string };
      gr.members.set(b.id, { id: b.id, name_ct: b.name_ct, token: b.write_token });
      return json(201, { id: b.id, name_ct: b.name_ct, joined_at: iso(), via: "link" });
    }
    m = p.match(/^\/groups\/([^/]+)$/);
    if (m && method === "GET") {
      const gr = groups.get(m[1] ?? "");
      if (!gr || who?.group !== m[1]) return err(401, "unauthorized");
      const members = [...gr.members.values()].map((x) => ({
        id: x.id,
        name_ct: x.name_ct,
        joined_at: iso(),
        via: "link",
      }));
      return json(200, { id: m[1], channel: "link", members, live: [] });
    }
    m = p.match(/^\/groups\/([^/]+)\/sparks$/);
    if (m && method === "POST") {
      if (!who || who.group !== m[1]) return err(401, "unauthorized");
      const b = body as { id: string; text_ct: string };
      return json(201, { id: b.id, text_ct: b.text_ct, created_on: iso().slice(0, 10) });
    }
    m = p.match(/^\/groups\/([^/]+)\/gatherings$/);
    if (m && method === "POST") {
      if (!who) return err(401, "unauthorized");
      const b = body as {
        id: string;
        kind: "flare" | "plan";
        quorum: number;
        sealed: string;
        notice_ct: string;
        plan?: GatheringView["plan"];
      };
      const g: G = {
        id: b.id,
        group_id: m[1] ?? "",
        kind: b.kind,
        state: "kindling",
        quorum: b.quorum,
        need: b.quorum - 1,
        short_code: "K7Q2M",
        version: 1,
        created_at: iso(),
        state_since: iso(),
        next_change_at: null,
        server_time: iso(),
        sealed: b.sealed,
        notice_ct: b.notice_ct,
        has_photo: false,
        headcount: null,
        ember_choice: null,
        plan: b.plan ? { ...b.plan, current_step: null } : null,
        ended: null,
        host: who.member,
        answers: new Map([
          [who.member, { member: who.member, rules: [], ember_only: false, answer: "yes", arrived: false }],
        ]),
        photo: null,
        faded: new Set(),
      };
      gatherings.set(g.id, g);
      return json(201, viewOf(g));
    }
    m = p.match(/^\/gatherings\/([^/]+)(\/.*)?$/);
    if (!m) return err(404, "not_found");
    const g = gatherings.get(m[1] ?? "");
    if (!g) return err(404, "not_found");
    const rest = m[2] ?? "";
    if (g.state === "gone" && rest !== "") return err(410, "gone");
    if (method === "GET" && rest === "") return json(200, viewOf(g));
    if (method === "GET" && rest === "/photo")
      return g.photo ? new Response(g.photo as Uint8Array<ArrayBuffer>, { status: 200 }) : err(404, "not_found");
    if (!who || who.group !== g.group_id) return err(401, "unauthorized");
    if (method === "PUT" && rest === "/photo") {
      g.photo = body as Uint8Array;
      g.has_photo = true;
      bump(g);
      return new Response(null, { status: 204 });
    }
    if (method === "GET" && rest === "/me") return json(200, meOf(g, who.member));
    if (method === "PUT" && rest === "/me") {
      const b = body as { answer: "yes" | "cant_make_it"; rules?: Rule[]; ember_only?: boolean };
      if (b.answer === "cant_make_it" && g.state === "kindling") return err(409, "wrong_state");
      if (b.answer === "yes" && g.state === "gone") return err(410, "gone");
      g.answers.set(who.member, {
        member: who.member,
        rules: b.rules ?? [],
        ember_only: b.ember_only ?? false,
        answer: b.answer,
        arrived: false,
      });
      bump(g);
      return json(200, meOf(g, who.member));
    }
    if (method === "DELETE" && rest === "/me") {
      if (g.state !== "kindling") return err(409, "wrong_state");
      g.answers.delete(who.member);
      bump(g);
      return json(200, meOf(g, who.member));
    }
    if (method === "POST" && rest === "/arrivals") {
      const a = g.answers.get(who.member);
      if (a) a.arrived = true;
      g.headcount = (g.headcount ?? 0) + 1;
      bump(g);
      return json(200, { gathering: viewOf(g), counted: true, spark_ticket: "tTtTtTtTtTtTtTtTtTtTtT" });
    }
    if (method === "POST" && rest === "/fade") {
      if (g.faded.has(who.member)) return err(409, "fade_used");
      g.faded.add(who.member);
      if (g.plan) g.plan.current_step = Math.min(4, (g.plan.current_step ?? 1) + 1) as 1 | 2 | 3 | 4;
      bump(g);
      return json(200, viewOf(g));
    }
    if (method === "POST" && rest === "/text-yes") {
      g.answers.set(`text-${g.answers.size}`, {
        member: "",
        rules: [],
        ember_only: false,
        answer: "yes",
        arrived: false,
      });
      bump(g);
      return json(200, viewOf(g));
    }
    if (method === "POST" && (rest === "/done" || rest === "/cancel")) {
      if (g.host !== who.member) return err(403, "not_host");
      g.ended = rest === "/done" ? "thanks_for_coming" : "not_this_time";
      bump(g, "gone");
      return json(200, viewOf(g));
    }
    return err(404, "not_found");
  }

  const fetchFn: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const path = new URL(url, "http://phone").pathname;
    const hdrs = init?.headers as Record<string, string> | undefined;
    return handle(init?.method ?? "GET", path, null, auth(hdrs));
  };

  return {
    groups,
    gatherings,
    fetch: fetchFn,
    setOffline(v: boolean) {
      offline = v;
    },
    /** Server-side events: someone else answers, the clock moves the state, the host ends it. */
    answerAs(gid: string, member: string) {
      const g = gatherings.get(gid);
      if (!g) throw new Error("no gathering");
      g.answers.set(member, { member, rules: [], ember_only: false, answer: "yes", arrived: false });
      bump(g);
    },
    setState(gid: string, state: State, patch: Partial<GatheringView> = {}) {
      const g = gatherings.get(gid);
      if (!g) throw new Error("no gathering");
      Object.assign(g, patch);
      bump(g, state);
    },
    subscribe(gid: string, f: (v: GatheringView) => void) {
      let set = listeners.get(gid);
      if (!set) {
        set = new Set();
        listeners.set(gid, set);
      }
      set.add(f);
      return () => set.delete(f);
    },
    handle,
    auth,
  };
}

export type FakeServer = ReturnType<typeof fakeServer>;

/** Outbox fake: sends at once through the fake server; queues when offline (returns null). */
export function fakeOutbox(server: FakeServer, store: ReturnType<typeof fakeStore>) {
  const queue: ClientIcd.OutboxItem[] = [];
  const sent: { method: string; path: string; body: unknown }[] = [];
  const authFor = (path: string): { group: string; member: string } | null => {
    // The real outbox finds the member record for the path's group; the fake signs as the last group saved.
    const gid =
      path.match(/\/groups\/([^/]+)/)?.[1] ??
      [...server.gatherings.values()].find((g) => path.includes(g.id))?.group_id;
    const rec = gid ? store.groups.get(gid) : [...store.groups.values()].at(-1);
    return rec ? server.auth({ authorization: `Bearer ${rec.memberId}.${rec.token}` }) : null;
  };
  const outbox: ClientIcd.Outbox & { sent: typeof sent; queue: typeof queue } = {
    sent,
    queue,
    async send<T>(item: Omit<ClientIcd.OutboxItem, "idemKey" | "recorded_at" | "attempts">): Promise<T | null> {
      sent.push({ method: item.method, path: item.path, body: item.body });
      let r: Response;
      try {
        r = await server.handle(item.method, item.path, item.body, authFor(item.path));
      } catch {
        queue.push({ ...item, idemKey: crypto.randomUUID(), recorded_at: new Date().toISOString(), attempts: 0 });
        return null;
      }
      const text = await r.text();
      const body = text ? JSON.parse(text) : null;
      if (!r.ok) throw Object.assign(new Error(body?.code ?? "http"), { status: r.status, code: body?.code });
      return body as T;
    },
    async flush() {
      let sentN = 0;
      while (queue.length) {
        const it = queue.shift();
        if (!it) break;
        await server.handle(it.method, it.path, it.body, authFor(it.path));
        sentN += 1;
      }
      return { sent: sentN, dropped: 0, left: 0 };
    },
    async size() {
      return queue.length;
    },
  };
  return outbox;
}

export function fakeLive(server: FakeServer): ClientIcd.Live<GatheringView> {
  return {
    follow(gid, onView) {
      return server.subscribe(gid, (v) => onView(v, 0));
    },
  };
}

/** Parser fake: "back by 5" gives one back_by rule; "kai" is not in the group; anything else fails. */
export const fakeConditions: ConditionsIcd.Conditions = {
  parse(text, ctx) {
    if (/kai/i.test(text)) return { ok: false, reason: "not_in_group", name: "Kai" };
    if (/back by 5/i.test(text)) {
      const at = new Date(ctx.now);
      at.setUTCHours(21, 0, 0, 0);
      return { ok: true, rules: [{ type: "back_by", at: at.toISOString() }], readBack: "Got it: back by 5 PM. Right?" };
    }
    return { ok: false, reason: "didnt_catch" };
  },
  readBack: () => "Got it: back by 5 PM. Right?",
};

/** Map fake: fixed places from the Fairlane area; needs fail when avoid_steps is set. */
export const fakeMaps: MapIcd.Maps = {
  async load(area) {
    return {
      v: 2,
      area,
      center: [42.3196, -83.2129],
      radius_m: 1500,
      osm_base: "2026-10-10T00:00:00Z",
      attribution: "© OpenStreetMap contributors",
      kinds: {},
      items: [],
    };
  },
  nameSpot: () => ({ name: "Ford Woods Park, by the pond", key: "way/1" }),
  emberCandidates: () => [],
  checkNeeds: (_pack, needs) => !needs.avoid_steps,
  walkMinutes: () => 9,
  accessLine: () => ({
    benches: { count: 2, nearest_m: 320 },
    restrooms: { count: 0, nearest_m: null },
    water: { count: 0, nearest_m: null },
    steps_mapped: true,
  }),
  natureLine: () => "Sunset 6:57 PM",
  sunset: () => new Date("2026-10-11T22:57:00Z"),
  placeWords: () => ["pond", "bench", "trees"],
};

export const fakeCaps: CapabilitiesIcd.CapabilityProbe = {
  detect: () => ({
    secureContext: true,
    standalone: false,
    camera: "live",
    offscreenCanvas: true,
    geolocation: true,
    orientation: "needs-permission",
    speech: true,
    vibrate: false,
    switchHaptic: true,
    webgl2: true,
    push: "needs-install",
    share: true,
    shareFiles: true,
    serviceWorker: true,
    storagePersisted: null,
  }),
  shaderOk: async () => true,
};

/** A full Deps set on one fake server, with a controllable clock. */
export function fakeDeps(start = Date.parse("2026-10-11T15:00:00.000Z")) {
  let now = start;
  const server = fakeServer(() => now);
  const crypto = fakeCrypto();
  const store = fakeStore();
  const outbox = fakeOutbox(server, store);
  const deps: Deps = {
    crypto,
    store,
    outbox,
    live: fakeLive(server),
    conditions: fakeConditions,
    maps: fakeMaps,
    caps: fakeCaps,
    fetch: server.fetch,
    now: () => now,
    tz: "America/Detroit",
  };
  return {
    deps,
    server,
    crypto,
    store,
    outbox,
    advance(ms: number) {
      now += ms;
    },
  };
}
