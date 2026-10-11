// In-process API harness: PGlite with every migration, the fake engine, a hand-driven clock,
// and app.request() (no network). Each call gets a fresh Idempotency-Key unless one is given.
import { randomBytes, randomUUID } from "node:crypto";
import { buildCtx, createApp } from "../src/app.ts";
import type { Ctx, EffectSink } from "../src/core/deps.ts";
import { runDue } from "../src/core/scheduler.ts";
import { type Db, memoryDb, migrate } from "../src/db/db.ts";
import { HubRelay } from "../src/hub/relay.ts";
import { fakeEngine } from "./fakes/engine.ts";

export type TestMember = { id: string; token: string; name_ct: string };
export const ct = (n = 24) => randomBytes(n).toString("base64url");
export const idem = () => randomBytes(12).toString("base64url");
export const newMember = (): TestMember => ({
  id: randomUUID(),
  token: randomBytes(16).toString("base64url"),
  name_ct: ct(),
});

export class TestClock {
  t: number;
  constructor(iso = "2026-10-11T15:00:00.000Z") {
    this.t = Date.parse(iso);
  }
  now = () => new Date(this.t);
  advance(ms: number) {
    this.t += ms;
  }
}

export type Sent = { kind: "push" | "telegram" | "created"; what: string; to?: string[] };

export async function harness(opts: { db?: Db; clock?: TestClock; failEffects?: boolean } = {}) {
  const db = opts.db ?? (await memoryDb());
  if (!opts.db) await migrate(db);
  const clock = opts.clock ?? new TestClock();
  const relay = new HubRelay(200, { pingMs: 60_000 });
  const sent: Sent[] = [];
  const boom = async () => {
    if (opts.failEffects) throw new Error("telegram down");
  };
  const effects: EffectSink = {
    push: async (e, to) => {
      sent.push({ kind: "push", what: e.event, to });
      await boom();
    },
    telegram: async (e) => {
      sent.push({ kind: "telegram", what: e.action });
      await boom();
    },
    created: async () => {
      sent.push({ kind: "created", what: "post" });
      await boom();
    },
  };
  const deps = { relay, db, version: "test", engine: fakeEngine, clock, effects, ladderTimeoutMs: 200 };
  const ctx: Ctx = buildCtx(deps);
  const app = createApp(deps, ctx);

  async function call(
    method: string,
    path: string,
    o: {
      as?: TestMember;
      body?: unknown;
      raw?: BodyInit;
      type?: string;
      key?: string | null;
      headers?: Record<string, string>;
    } = {},
  ) {
    const headers: Record<string, string> = { ...(o.headers ?? {}) };
    if (o.as) headers.authorization = `Bearer ${o.as.id}.${o.as.token}`;
    if (method !== "GET" && o.key !== null) headers["idempotency-key"] = o.key ?? idem();
    let body: BodyInit | undefined;
    if (o.raw !== undefined) {
      body = o.raw;
      headers["content-type"] = o.type ?? "application/octet-stream";
    } else if (o.body !== undefined) {
      body = JSON.stringify(o.body);
      headers["content-type"] = "application/json";
    }
    const res = await app.request(path, { method, headers, body });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }
    // biome-ignore lint/suspicious/noExplicitAny: test convenience
    return { status: res.status, body: json as any, headers: res.headers };
  }

  async function group(n = 3) {
    const members = Array.from({ length: n }, newMember);
    const host = members[0] as TestMember;
    const groupId = randomUUID();
    const r = await call("POST", "/api/v1/groups", {
      body: { id: groupId, member: { id: host.id, name_ct: host.name_ct, write_token: host.token } },
    });
    if (r.status !== 201) throw new Error(`group ${r.status}`);
    for (const m of members.slice(1)) {
      const j = await call("POST", `/api/v1/groups/${groupId}/members`, {
        body: { id: m.id, name_ct: m.name_ct, write_token: m.token },
      });
      if (j.status !== 201) throw new Error(`join ${j.status}`);
    }
    return { groupId, host, members };
  }

  async function flare(groupId: string, host: TestMember, extra: Record<string, unknown> = {}) {
    const id = randomUUID();
    const r = await call("POST", `/api/v1/groups/${groupId}/gatherings`, {
      as: host,
      body: { id, kind: "flare", quorum: 3, tz: "America/Detroit", sealed: ct(64), notice_ct: ct(32), ...extra },
    });
    return { id, r };
  }

  function planBody(over: Record<string, unknown> = {}) {
    const now = clock.t;
    return {
      id: randomUUID(),
      kind: "plan",
      quorum: 3,
      tz: "America/Detroit",
      sealed: ct(64),
      notice_ct: ct(32),
      plan: {
        start_at: new Date(now + 120 * 60_000).toISOString(),
        deadline_at: new Date(now + 60 * 60_000).toISOString(),
        steps: [
          { step: 1, minutes: 120, place: "step:1" },
          { step: 2, minutes: 60, place: "step:2" },
          { step: 3, minutes: 30, place: "step:3" },
          { step: 4, minutes: 15, place: "step:4" },
        ],
      },
      ...over,
    };
  }

  return {
    db,
    clock,
    ctx,
    app,
    relay,
    sent,
    call,
    group,
    flare,
    planBody,
    tick: () => runDue(ctx, clock.now()),
    close: async () => {
      relay.close();
      if (!opts.db) await db.close();
    },
  };
}
