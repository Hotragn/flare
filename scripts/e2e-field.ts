// Field-test scenarios end to end on the real stack: the real server process (real engine,
// scheduler and sweeper, Postgres in memory) driven over the HTTP contract, with a test clock to
// jump to deadlines, Ember and deletion. One scenario per Sunday run that the browser e2e
// (apps/web/test/e2e/flow.ts real) doesn't already cover.
// Usage: node scripts/e2e-field.ts
import { type ChildProcess, spawn } from "node:child_process";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 8866;
const BASE = `http://localhost:${PORT}`;
const MIN = 60_000;
const ct = (n = 32) => randomBytes(n).toString("base64url");
type M = { id: string; token: string; name_ct: string };
const member = (): M => ({ id: randomUUID(), token: randomBytes(16).toString("base64url"), name_ct: ct(24) });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let server: ChildProcess | null = null;
let failed = 0;
let passed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  ok ? passed++ : failed++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
};

async function call(method: string, p: string, o: { as?: M; body?: unknown; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { ...(o.headers ?? {}) };
  if (o.as) headers.authorization = `Bearer ${o.as.id}.${o.as.token}`;
  if (method !== "GET") headers["idempotency-key"] = ct(12);
  if (o.body !== undefined) headers["content-type"] = "application/json";
  const r = await fetch(`${BASE}${p}`, {
    method,
    headers,
    body: o.body === undefined ? undefined : JSON.stringify(o.body),
  });
  const text = await r.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  // biome-ignore lint/suspicious/noExplicitAny: script convenience
  return { status: r.status, body: body as any };
}
/** Moves the server clock forward, then waits for the 1 s scheduler tick to run due jobs. */
async function advance(ms: number) {
  await fetch(`${BASE}/__e2e/clock`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ advance_ms: ms }),
  });
  await sleep(1600);
}
async function serverNow(): Promise<number> {
  const r = await fetch(`${BASE}/__e2e/clock`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  return Date.parse(((await r.json()) as { now: string }).now);
}
async function group(n: number) {
  const ms = Array.from({ length: n }, member);
  const host = ms[0] as M;
  const groupId = randomUUID();
  await call("POST", "/api/v1/groups", {
    body: { id: groupId, member: { id: host.id, name_ct: host.name_ct, write_token: host.token } },
  });
  for (const m of ms.slice(1))
    await call("POST", `/api/v1/groups/${groupId}/members`, {
      body: { id: m.id, name_ct: m.name_ct, write_token: m.token },
    });
  return { groupId, host, ms };
}
const view = async (id: string) => (await call("GET", `/api/v1/gatherings/${id}`)).body;

async function main() {
  server = spawn(process.execPath, ["apps/server/src/main.ts"], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(PORT),
      DATABASE_URL: "pglite:memory",
      FLARE_E2E_CLOCK: "1",
      LOG_LEVEL: "warn",
      SENTRY_DSN: "",
      PUBLIC_BASE_URL: BASE,
    },
    stdio: ["ignore", "ignore", "inherit"],
  });
  for (let i = 0; i < 80; i++) {
    if (
      await fetch(`${BASE}/api/v1/health`).then(
        (r) => r.ok,
        () => false,
      )
    )
      break;
    await sleep(250);
  }

  // 1. A Plan, "Fairlane walk at 11?", with a deadline, conditions and a fade (E15-S1 to S4).
  {
    const { groupId, host, ms } = await group(4);
    const [, a, b, c] = ms as [M, M, M, M];
    const now = await serverNow();
    const id = randomUUID();
    const created = await call("POST", `/api/v1/groups/${groupId}/gatherings`, {
      as: host,
      body: {
        id,
        kind: "plan",
        quorum: 3,
        tz: "America/Detroit",
        sealed: ct(64),
        notice_ct: ct(32),
        plan: {
          start_at: new Date(now + 60 * MIN).toISOString(),
          deadline_at: new Date(now + 30 * MIN).toISOString(),
          steps: [
            { step: 1, minutes: 60, place: "step:1" },
            { step: 2, minutes: 30, place: "step:2" },
            { step: 3, minutes: 15, place: "step:3" },
            { step: 4, minutes: 10, place: "step:4" },
          ],
        },
      },
    });
    check(
      "plan: created with 4 steps",
      created.status === 201 && created.body.plan?.steps?.length === 4,
      `${created.status}`,
    );
    await call("PUT", `/api/v1/gatherings/${id}/me`, { as: a, body: { answer: "yes" } });
    // "Step 3 or smaller" from the phone's parser (max_step 3), and "Short one only" (max_step 4).
    const rb = await call("PUT", `/api/v1/gatherings/${id}/me`, {
      as: b,
      body: { answer: "yes", rules: [{ type: "max_step", step: 3 }] },
    });
    await call("PUT", `/api/v1/gatherings/${id}/me`, {
      as: c,
      body: { answer: "yes", rules: [{ type: "max_step", step: 4 }] },
    });
    check("plan: conditions saved as rules only", rb.status === 200 && rb.body.rules?.[0]?.type === "max_step");
    const before = await view(id);
    check("plan: stays Kindling until the deadline (BR-P-2)", before.state === "kindling", before.state);
    await advance(31 * MIN);
    const lit = await view(id);
    // Step 4 fits all four (host, a, b with max 3, c with max 4): most people wins (BR-S-1).
    check(
      "plan: lights at the deadline at the step with the most people",
      lit.state === "lit" && lit.plan?.current_step === 4,
      `${lit.state} step ${lit.plan?.current_step}`,
    );
    const meA = await call("GET", `/api/v1/gatherings/${id}/me`, { as: a });
    check("plan: a member sees only their own place in the set", meA.body.in_set === true && !("chosen_set" in lit));
    const fade = await call("POST", `/api/v1/gatherings/${id}/fade`, { as: a });
    check(
      "plan: a fade at step 4 is recorded and stays at step 4 (BR-P-6)",
      fade.status === 200 && fade.body.plan?.current_step === 4,
      `${fade.status}`,
    );
    const again = await call("POST", `/api/v1/gatherings/${id}/fade`, { as: a });
    check("plan: one fade per person (BR-P-5)", again.body.code === "fade_used", again.body.code);
    await advance((30 + 10 + 60) * MIN + 1000); // S + step minutes + 60 min (BR-P-8)
    const gone = await call("GET", `/api/v1/gatherings/${id}`);
    check("plan: Gone after S + step + 60 min", gone.status === 410, `${gone.status}`);
  }

  // 1b. A Plan where the condition decides the step, then a fade moves it (BR-S-1, BR-P-6).
  {
    const { groupId, host, ms } = await group(3);
    const [, a, b] = ms as [M, M, M];
    const now = await serverNow();
    const id = randomUUID();
    await call("POST", `/api/v1/groups/${groupId}/gatherings`, {
      as: host,
      body: {
        id,
        kind: "plan",
        quorum: 3,
        tz: "America/Detroit",
        sealed: ct(64),
        notice_ct: ct(32),
        plan: {
          start_at: new Date(now + 60 * MIN).toISOString(),
          deadline_at: new Date(now + 30 * MIN).toISOString(),
          steps: [
            { step: 1, minutes: 60, place: "step:1" },
            { step: 2, minutes: 30, place: "step:2" },
            { step: 3, minutes: 15, place: "step:3" },
            { step: 4, minutes: 10, place: "step:4" },
          ],
        },
      },
    });
    await call("PUT", `/api/v1/gatherings/${id}/me`, { as: a, body: { answer: "yes" } });
    await call("PUT", `/api/v1/gatherings/${id}/me`, {
      as: b,
      body: { answer: "yes", rules: [{ type: "max_step", step: 2 }] },
    });
    await advance(31 * MIN);
    const lit = await view(id);
    check(
      "plan 1b: the condition picks step 2, the biggest step all three can do",
      lit.plan?.current_step === 2,
      `step ${lit.plan?.current_step}`,
    );
    const f = await call("POST", `/api/v1/gatherings/${id}/fade`, { as: a });
    check(
      "plan 1b: I'm fading makes it one step smaller, nobody removed",
      f.body.plan?.current_step === 3 && f.body.need === 0,
      `step ${f.body.plan?.current_step}`,
    );
  }

  // 2. An ambitious Flare that shrinks to an Ember (BR-F-3, BR-E-1 to E-6).
  {
    const { groupId, host, ms } = await group(3);
    const [, a] = ms as [M, M];
    const id = randomUUID();
    await call("POST", `/api/v1/groups/${groupId}/gatherings`, {
      as: host,
      body: {
        id,
        kind: "flare",
        quorum: 4,
        tz: "America/Detroit",
        sealed: ct(64),
        notice_ct: ct(32),
        ember_candidates: ["c1", "c2", "c3"],
      },
    });
    await call("PUT", `/api/v1/gatherings/${id}/me`, {
      as: a,
      body: { answer: "yes", checks: { results: { spot: true } } },
    });
    check("ember: Kindling with need 2 at quorum 4", (await view(id)).need === 2);
    await advance(30 * MIN + 1000);
    const em = await view(id);
    check(
      "ember: at 30 min it shrinks to Ember with quorum 2 (BR-F-3)",
      em.state === "ember" && em.quorum === 2,
      `${em.state} q${em.quorum}`,
    );
    await call("PUT", `/api/v1/gatherings/${id}/me/checks`, {
      as: a,
      body: { results: { c1: false, c2: true, c3: true } },
    });
    await advance(61_000); // BR-E-4: missing reports count as pass after 60 s
    const picked = await view(id);
    check(
      "ember: the nearest bench that passed every check is chosen (c2)",
      picked.ember_choice === "c2",
      String(picked.ember_choice),
    );
    check("ember: host + one yes lights the Ember", picked.state === "lit", picked.state);
  }

  // 3. The plain-text reply: a friend texts "IN K7Q2M", the host enters it (SRS-CH-6, BR-ID-6).
  {
    const { groupId, host } = await group(2);
    const id = randomUUID();
    const r = await call("POST", `/api/v1/groups/${groupId}/gatherings`, {
      as: host,
      body: { id, kind: "flare", quorum: 3, tz: "America/Detroit", sealed: ct(64), notice_ct: ct(32) },
    });
    const code = r.body.short_code as string;
    const wrong = await call("POST", `/api/v1/gatherings/${id}/text-yes`, {
      as: host,
      body: { code: code === "AAAAA" ? "BBBBB" : "AAAAA" },
    });
    check("text: a wrong code is refused", wrong.body.code === "code_mismatch", wrong.body.code);
    const ok = await call("POST", `/api/v1/gatherings/${id}/text-yes`, { as: host, body: { code } });
    check(
      "text: the reply code counts as one anonymous yes",
      ok.status === 200 && ok.body.need === 1,
      `need ${ok.body.need}`,
    );
  }

  // 4. Sparks, "met here N times" and Hot spots (BR-K-1 to K-6), then deletion at T+62 (BR-D-1, BR-D-7).
  {
    const { groupId, host, ms } = await group(2);
    const [, a] = ms as [M, M];
    const id = randomUUID();
    await call("POST", `/api/v1/groups/${groupId}/gatherings`, {
      as: host,
      body: { id, kind: "flare", quorum: 2, tz: "America/Detroit", sealed: ct(64), notice_ct: ct(32) },
    });
    await call("PUT", `/api/v1/gatherings/${id}/me`, { as: a, body: { answer: "yes" } });
    check("sparks: lit with host + one yes", (await view(id)).state === "lit");
    const now = await serverNow();
    const arr = await call("POST", `/api/v1/gatherings/${id}/arrivals`, {
      as: a,
      body: { for: "self", recorded_at: new Date(now).toISOString() },
    });
    const ticket = arr.body.spark_ticket as string;
    check(
      "sparks: I'm here counts and hands back a Spark ticket",
      arr.body.counted === true && /^[A-Za-z0-9_-]{22}$/.test(ticket ?? ""),
    );
    const done = await call("POST", `/api/v1/gatherings/${id}/done`, { as: host });
    check(
      "sparks: Done ends it as Thanks for coming",
      done.body.state === "gone" && done.body.ended === "thanks_for_coming",
      done.body.ended,
    );
    const place = createHmac("sha256", randomBytes(32)).update("way/1086505648").digest("base64url");
    const spark = await call("POST", `/api/v1/groups/${groupId}/sparks`, {
      as: a,
      body: { id: randomUUID(), ticket, place, text_ct: ct(80), delete_token: randomBytes(16).toString("base64url") },
    });
    check("sparks: a Spark is saved after Done with the ticket", spark.status === 201, `${spark.status}`);
    const twice = await call("POST", `/api/v1/groups/${groupId}/sparks`, {
      as: a,
      body: { id: randomUUID(), ticket, place, text_ct: ct(80), delete_token: randomBytes(16).toString("base64url") },
    });
    check("sparks: one Spark per ticket", twice.status !== 201, `${twice.status} ${twice.body?.code}`);
    const list = await call("GET", `/api/v1/groups/${groupId}/sparks?place=${place}&limit=5`, { as: host });
    check(
      "sparks: the group reads the newest Spark at that place (met here)",
      list.body.sparks?.length === 1,
      `${list.body.sparks?.length}`,
    );
    const hs1 = await call("GET", `/api/v1/groups/${groupId}/hotspots`, { as: host });
    const put = await call("PUT", `/api/v1/groups/${groupId}/hotspots`, {
      as: host,
      body: { blob_ct: ct(200) },
      headers: { "if-match": hs1.status === 200 ? String(hs1.body.version) : "0" },
    });
    check("hot spots: the sealed blob is saved", put.status === 200, `${put.status} ${put.body?.code ?? ""}`);
    const stale = await call("PUT", `/api/v1/groups/${groupId}/hotspots`, {
      as: a,
      body: { blob_ct: ct(200) },
      headers: { "if-match": "0" },
    });
    check("hot spots: a stale version is refused (merge by max, BR-K-6)", stale.status === 412, `${stale.status}`);
    await advance(62 * MIN);
    const goneView = await call("GET", `/api/v1/gatherings/${id}`);
    check(
      "deletion: at T+62 the gathering is gone from storage",
      goneView.status === 404 || goneView.status === 410,
      `${goneView.status}`,
    );
    const audit = await call("GET", "/api/v1/audit");
    const expired = (audit.body.stores ?? []).filter(
      (s: { per_gathering: boolean; expired_rows: number }) => s.per_gathering && s.expired_rows > 0,
    );
    check(
      "deletion: audit passes, 0 expired per-gathering rows (BR-D-7)",
      audit.body.pass === true && expired.length === 0,
      JSON.stringify(expired),
    );
    const after = await call("GET", `/api/v1/groups/${groupId}/sparks?place=${place}`, { as: host });
    check("sparks survive Gone (BR-D-4)", after.body.sparks?.length === 1);
  }
}

main()
  .catch((e: unknown) => {
    failed++;
    console.error(`FAIL ${e instanceof Error ? e.message : String(e)}`);
  })
  .finally(() => {
    server?.kill("SIGTERM");
    console.log(`\nfield e2e (real server, real engine, Postgres in memory): ${passed} passed, ${failed} failed`);
    process.exit(failed ? 1 : 0);
  });
