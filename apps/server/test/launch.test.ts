// Since launch (Oct 11): six increment-only totals; test traffic never counts.
import { afterEach, describe, expect, it } from "vitest";
import { launchStats } from "../src/core/launch.ts";
import { harness, newMember } from "./api-helpers.ts";

let h: Awaited<ReturnType<typeof harness>> | null = null;
afterEach(async () => {
  await h?.close();
  h = null;
});

async function litFlare(hh: NonNullable<typeof h>, test: boolean) {
  const { groupId, host, members } = await hh.group(3);
  if (test) await hh.ctx.db?.query("update groups set is_test = true where id = $1", [groupId]);
  const { id } = await hh.flare(groupId, host, {});
  for (const m of members.slice(1))
    await hh.call("PUT", `/api/v1/gatherings/${id}/me`, { as: m, body: { answer: "yes" } });
  await hh.call("PUT", `/api/v1/gatherings/${id}/me`, { as: members[1], body: { answer: "yes" } }); // a repeat
}

describe("Since launch", () => {
  it("counts a real crew, Flare, yeses and lit; a test group adds nothing", async () => {
    h = await harness();
    const db = h.ctx.db;
    if (!db) throw new Error("no db");
    const zero = await launchStats(db);
    await litFlare(h, false);
    const one = await launchStats(db);
    expect(one.crews - zero.crews).toBe(1);
    expect(one.flares_sent - zero.flares_sent).toBe(1);
    expect(one.yeses - zero.yeses).toBe(2); // the repeat yes is not counted twice
    expect(one.lit - zero.lit).toBe(1);
    await litFlare(h, true);
    const two = await launchStats(db);
    expect({ ...two, crews: two.crews - 1 }).toEqual(one); // the test crew's own creation is the only change
  });

  it("the header x-flare-test: 1 marks the group as test at creation", async () => {
    h = await harness();
    const db = h.ctx.db;
    if (!db) throw new Error("no db");
    const before = await launchStats(db);
    const { randomUUID } = await import("node:crypto");
    const id = randomUUID();
    const m = newMember();
    const r = await h.call("POST", "/api/v1/groups", {
      headers: { "x-flare-test": "1" },
      body: { id, member: { id: m.id, name_ct: m.name_ct, write_token: m.token } },
    });
    expect(r.status).toBe(201);
    expect((await launchStats(db)).crews).toBe(before.crews);
    expect(
      (await db.query<{ is_test: boolean }>("select is_test from groups where id = $1", [id])).rows[0]?.is_test,
    ).toBe(true);
  });
});
