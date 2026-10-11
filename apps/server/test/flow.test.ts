// Full flows from creation to deletion (brief 6c "Done"): group, Flare, answers, Lit,
// arrivals, Done, Spark, delete job, sweep, audit shows 0. Plus Ember, Plan and restart paths.
import { randomBytes, randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { auditGathering, audit as runAudit, sweep } from "../src/core/sweep.ts";
import { ct, harness } from "./api-helpers.ts";

const MIN = 60_000;
let h: Awaited<ReturnType<typeof harness>> | null = null;
afterEach(async () => {
  await h?.close();
  h = null;
});

describe("Flare full flow (BR-D-1, BR-D-7)", () => {
  it("create, answers, Lit, arrivals, Done, Spark, delete, sweep, audit 0", async () => {
    h = await harness();
    const { groupId, host, members } = await h.group(3);
    const [, b, c] = members as [typeof host, typeof host, typeof host];
    const { id, r } = await h.flare(groupId, host, { ember_candidates: ["c1", "c2"] });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ id, state: "kindling", need: 2, quorum: 3, version: 1, has_photo: false });
    expect(r.body.short_code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{5}$/);
    // No member ids or names in the shared view (BR-Q-5).
    expect(JSON.stringify(r.body)).not.toContain(host.id);

    // Photo (sealed) then answers.
    expect((await h.call("PUT", `/api/v1/gatherings/${id}/photo`, { as: host, raw: randomBytes(5000) })).status).toBe(
      204,
    );
    expect((await h.call("GET", `/api/v1/gatherings/${id}`)).body.has_photo).toBe(true);

    const yesB = await h.call("PUT", `/api/v1/gatherings/${id}/me`, { as: b, body: { answer: "yes" } });
    expect(yesB.status).toBe(200);
    expect(yesB.body).toMatchObject({ answer: "yes", in_set: null, can_take_back: true });
    expect((await h.call("GET", `/api/v1/gatherings/${id}`)).body.need).toBe(1);

    await h.call("PUT", `/api/v1/gatherings/${id}/me`, { as: c, body: { answer: "yes" } });
    const lit = await h.call("GET", `/api/v1/gatherings/${id}`);
    expect(lit.body).toMatchObject({ state: "lit", need: 0, headcount: 1 });
    expect(h.sent.some((s) => s.kind === "push" && s.what === "lit")).toBe(true);
    // Take-back after Lit is refused (F12).
    expect((await h.call("DELETE", `/api/v1/gatherings/${id}/me`, { as: b })).body.code).toBe("already_lit");

    // Live location for the set.
    expect(
      (await h.call("PUT", `/api/v1/gatherings/${id}/live-location`, { as: host, body: { location_ct: ct(40) } }))
        .status,
    ).toBe(204);
    expect((await h.call("GET", `/api/v1/gatherings/${id}/live-location`, { as: b })).status).toBe(200);

    // Arrivals: B taps I'm here; host adds +1 for someone else.
    const arr = await h.call("POST", `/api/v1/gatherings/${id}/arrivals`, {
      as: b,
      body: { for: "self", recorded_at: h.clock.now().toISOString() },
    });
    expect(arr.status).toBe(200);
    expect(arr.body.counted).toBe(true);
    expect(arr.body.spark_ticket).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(arr.body.gathering.headcount).toBe(2);
    const plus = await h.call("POST", `/api/v1/gatherings/${id}/arrivals`, {
      as: host,
      body: { for: "someone_else", recorded_at: h.clock.now().toISOString() },
    });
    expect(plus.body.gathering.headcount).toBe(3);

    h.clock.advance(40 * MIN);
    const done = await h.call("POST", `/api/v1/gatherings/${id}/done`, { as: host });
    expect(done.status).toBe(200);
    expect(done.body).toMatchObject({ state: "gone", ended: "thanks_for_coming" });
    // Live location and photo go at Gone (BR-D-1).
    const after = await auditGathering(h.db, id);
    expect(after.find((t) => t.table === "live_locations")?.rows).toBe(0);
    expect(after.find((t) => t.table === "photos")?.rows).toBe(0);
    const gone = await h.call("GET", `/api/v1/gatherings/${id}`);
    expect(gone.status).toBe(410);
    expect(gone.body).toMatchObject({ code: "gone", ended: "thanks_for_coming" });

    // The delete job runs 60 s later.
    h.clock.advance(61_000);
    await h.tick();
    expect((await auditGathering(h.db, id)).every((t) => t.rows === 0)).toBe(true);
    expect((await h.call("GET", `/api/v1/gatherings/${id}`)).status).toBe(404);

    // The Spark ticket outlives the gathering.
    const spark = {
      id: randomUUID(),
      ticket: arr.body.spark_ticket,
      place: randomBytes(32).toString("base64url"),
      text_ct: ct(60),
      delete_token: randomBytes(16).toString("base64url"),
    };
    const s1 = await h.call("POST", `/api/v1/groups/${groupId}/sparks`, { as: b, body: spark });
    expect(s1.status).toBe(201);
    expect(s1.body.created_on).toBe("2026-10-11");
    const s2 = await h.call("POST", `/api/v1/groups/${groupId}/sparks`, {
      as: b,
      body: { ...spark, id: randomUUID() },
    });
    expect(s2.body.code).toBe("not_arrived");
    const list = await h.call("GET", `/api/v1/groups/${groupId}/sparks?place=${spark.place}`, { as: c });
    expect(list.body.sparks).toHaveLength(1);

    // Counters survive (BR-D-4).
    const counters = (
      await h.db.query<{ name: string; value: string }>("select name, value::text from counters where group_id = $1", [
        groupId,
      ])
    ).rows;
    const byName = Object.fromEntries(counters.map((x) => [x.name, Number(x.value)]));
    expect(byName).toMatchObject({ flares_created: 1, headcount_sum: 3, headcount_max: 3, sparks_left: 1 });

    await sweep(h.db, h.clock.now());
    const a = await runAudit(h.db, h.clock.now());
    expect(a.pass).toBe(true);
    expect(a.stores.filter((s) => s.per_gathering).every((s) => s.total_rows === 0 && s.expired_rows === 0)).toBe(true);
    const api = await h.call("GET", "/api/v1/audit");
    expect(api.body.pass).toBe(true);
  });
});

describe("Ember path (F4 to F7)", () => {
  it("goes to Ember at 30 min, lights at 2, and is Gone at 60 min when it does not", async () => {
    h = await harness();
    const { groupId, host, members } = await h.group(3);
    const b = members[1] as typeof host;
    const { id } = await h.flare(groupId, host, { ember_candidates: ["c1"] });
    h.clock.advance(30 * MIN + 1);
    await h.tick();
    let v = (await h.call("GET", `/api/v1/gatherings/${id}`)).body;
    expect(v).toMatchObject({ state: "ember", quorum: 2, need: 1 });
    h.clock.advance(61_000);
    await h.tick();
    expect((await h.call("GET", `/api/v1/gatherings/${id}`)).body.ember_choice).toBe("c1");
    await h.call("PUT", `/api/v1/gatherings/${id}/me`, { as: b, body: { answer: "yes", ember_only: true } });
    v = (await h.call("GET", `/api/v1/gatherings/${id}`)).body;
    expect(v.state).toBe("lit");

    // A second Flare that never lights is Gone at t0 + 60 min with "Not this time."
    const two = await h.flare(groupId, host);
    h.clock.advance(30 * MIN + 1);
    await h.tick();
    h.clock.advance(30 * MIN);
    await h.tick();
    const g = await h.call("GET", `/api/v1/gatherings/${two.id}`);
    expect(g.body).toMatchObject({ code: "gone", ended: "not_this_time" });
  });

  it("an answer received at t0+30:00.000 wins over the ember timer (BR-F-2)", async () => {
    h = await harness();
    const { groupId, host, members } = await h.group(3);
    const { id } = await h.flare(groupId, host, { quorum: 2 });
    h.clock.advance(30 * MIN);
    await h.call("PUT", `/api/v1/gatherings/${id}/me`, { as: members[1], body: { answer: "yes" } });
    await h.tick();
    expect((await h.call("GET", `/api/v1/gatherings/${id}`)).body.state).toBe("lit");
  });
});

describe("Plan path (P1 to P10)", () => {
  it("lights at the deadline, fades one step, ends, and is deleted", async () => {
    h = await harness();
    const { groupId, host, members } = await h.group(3);
    const body = h.planBody();
    const r = await h.call("POST", `/api/v1/groups/${groupId}/gatherings`, { as: host, body });
    expect(r.status).toBe(201);
    expect(r.body.plan.steps).toHaveLength(4);
    for (const m of members.slice(1))
      await h.call("PUT", `/api/v1/gatherings/${body.id}/me`, { as: m, body: { answer: "yes" } });
    expect((await h.call("GET", `/api/v1/gatherings/${body.id}`)).body.state).toBe("lit");
    const me = await h.call("GET", `/api/v1/gatherings/${body.id}/me`, { as: members[1] });
    expect(me.body).toMatchObject({ in_set: true, can_fade: true });
    const f = await h.call("POST", `/api/v1/gatherings/${body.id}/fade`, { as: members[1] });
    expect(f.status).toBe(200);
    expect(f.body.plan.current_step).toBe(2);
    expect((await h.call("POST", `/api/v1/gatherings/${body.id}/fade`, { as: members[1] })).body.code).toBe(
      "fade_used",
    );
    // gone job at S + step 2 minutes + 60 min
    h.clock.advance((120 + 60 + 60) * MIN + 1);
    await h.tick();
    expect((await h.call("GET", `/api/v1/gatherings/${body.id}`)).status).toBe(410);
    h.clock.advance(61_000);
    await h.tick();
    expect((await auditGathering(h.db, body.id)).every((t) => t.rows === 0)).toBe(true);
  });
});

describe("restart and failure paths (03-deletion.md)", () => {
  it("jobs survive a server restart: a new app on the same database runs overdue jobs", async () => {
    h = await harness();
    const { groupId, host } = await h.group(2);
    const { id } = await h.flare(groupId, host);
    await h.call("POST", `/api/v1/gatherings/${id}/cancel`, { as: host });
    // "Crash": throw the first app away and boot a second one on the same rows.
    const h2 = await harness({ db: h.db, clock: h.clock });
    h.clock.advance(10 * MIN);
    expect(await h2.tick()).toBe(1);
    expect((await auditGathering(h.db, id)).every((t) => t.rows === 0)).toBe(true);
    await h2.close();
  });

  it("a lost delete job is covered by the sweeper (Gone over 5 min)", async () => {
    h = await harness();
    const { groupId, host } = await h.group(2);
    const { id } = await h.flare(groupId, host);
    await h.call("POST", `/api/v1/gatherings/${id}/cancel`, { as: host });
    await h.db.query("delete from jobs where gathering_id = $1", [id]);
    h.clock.advance(4 * MIN);
    expect((await sweep(h.db, h.clock.now())).gatherings).toBe(0);
    h.clock.advance(2 * MIN);
    expect((await sweep(h.db, h.clock.now())).gatherings).toBe(1);
    expect((await auditGathering(h.db, id)).every((t) => t.rows === 0)).toBe(true);
  });

  it("storage expiry deletes a gathering whose jobs never ran (BR-D-2: t0 + 5 h)", async () => {
    h = await harness();
    const { groupId, host } = await h.group(2);
    const { id } = await h.flare(groupId, host);
    await h.db.query("delete from jobs where gathering_id = $1", [id]);
    h.clock.advance(5 * 60 * MIN + 1);
    const before = await runAudit(h.db, h.clock.now());
    expect(before.pass).toBe(false);
    await sweep(h.db, h.clock.now());
    expect((await runAudit(h.db, h.clock.now())).pass).toBe(true);
  });

  it("a failing Telegram or push call never blocks the state change or deletion", async () => {
    h = await harness({ failEffects: true });
    const { groupId, host, members } = await h.group(2);
    const { id } = await h.flare(groupId, host, { quorum: 2 });
    const r = await h.call("PUT", `/api/v1/gatherings/${id}/me`, { as: members[1], body: { answer: "yes" } });
    expect(r.status).toBe(200);
    await h.call("POST", `/api/v1/gatherings/${id}/done`, { as: host });
    h.clock.advance(61_000);
    await h.tick();
    expect((await auditGathering(h.db, id)).every((t) => t.rows === 0)).toBe(true);
  });
});
