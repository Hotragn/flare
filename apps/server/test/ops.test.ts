// Idempotency, privacy-safe logs, the KPI and log-audit reports, and the SPA shell.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import { counterTotals, kpis, scanLog } from "../src/core/report.ts";
import { HubRelay } from "../src/hub/relay.ts";
import { routeTemplate } from "../src/log.ts";
import { harness, idem } from "./api-helpers.ts";

let h: Awaited<ReturnType<typeof harness>>;
beforeAll(async () => {
  h = await harness();
}, 60_000);
afterAll(async () => h.close());

describe("idempotency (SRS-IF-1, SRS-REL-2)", () => {
  it("a repeated answer with the same key returns the first response and changes nothing", async () => {
    const g = await h.group(3);
    const { id } = await h.flare(g.groupId, g.host);
    const key = idem();
    const a = await h.call("PUT", `/api/v1/gatherings/${id}/me`, { as: g.members[1], body: { answer: "yes" }, key });
    const v1 = (await h.call("GET", `/api/v1/gatherings/${id}`)).body.version;
    const b = await h.call("PUT", `/api/v1/gatherings/${id}/me`, { as: g.members[1], body: { answer: "yes" }, key });
    expect(b.body).toEqual(a.body);
    expect((await h.call("GET", `/api/v1/gatherings/${id}`)).body.version).toBe(v1);
  });
  it("the same key from two members does not collide", async () => {
    const g = await h.group(3);
    const { id } = await h.flare(g.groupId, g.host, { quorum: 4 });
    const key = idem();
    await h.call("PUT", `/api/v1/gatherings/${id}/me`, { as: g.members[1], body: { answer: "yes" }, key });
    await h.call("PUT", `/api/v1/gatherings/${id}/me`, { as: g.members[2], body: { answer: "yes" }, key });
    expect((await h.call("GET", `/api/v1/gatherings/${id}`)).body.need).toBe(1);
  });
  it("a refused write is not stored, so a retry can succeed later", async () => {
    const g = await h.group(2);
    const { id } = await h.flare(g.groupId, g.host, { quorum: 2 });
    const key = idem();
    const early = await h.call("POST", `/api/v1/gatherings/${id}/done`, { as: g.host, key });
    expect(early.status).toBe(409);
    await h.call("PUT", `/api/v1/gatherings/${id}/me`, { as: g.members[1], body: { answer: "yes" } });
    expect((await h.call("POST", `/api/v1/gatherings/${id}/done`, { as: g.host, key })).status).toBe(200);
  });
  it("idempotency rows expire after 24 h and the sweeper removes them", async () => {
    const n = (
      await h.db.query<{ n: number }>("select count(*)::int as n from idempotency where expires_at > $1", [
        h.clock.now(),
      ])
    ).rows[0]?.n;
    expect(n).toBeGreaterThan(0);
  });
});

describe("privacy-safe logs (BR-D-6, 09-observability.md)", () => {
  it("route templates hide gathering ids and tokens", () => {
    expect(routeTemplate("/api/v1/gatherings/3f2b8c1e-1d2a-4b3c-8d4e-5f6a7b8c9d0e/me")).toBe(
      "/api/v1/gatherings/:id/me",
    );
    expect(scanLog(routeTemplate("/api/v1/groups/3f2b8c1e-1d2a-4b3c-8d4e-5f6a7b8c9d0e/sparks")).uuids).toBe(0);
  });
  it("scanLog finds UUIDs and short codes and passes a clean log", () => {
    const bad = '{"r":"/api/v1/gatherings/3f2b8c1e-1d2a-4b3c-8d4e-5f6a7b8c9d0e"}\n{"code":"K7Q2M"}';
    expect(scanLog(bad)).toMatchObject({ uuids: 1, codes: 1, at: [1, 2] });
    const good = '{"level":"info","m":"GET","r":"/api/v1/gatherings/:id","s":200,"ms":3,"msg":"req"}';
    expect(scanLog(good)).toMatchObject({ uuids: 0, codes: 0 });
  });
});

describe("npm run kpi (07-kpis.md)", () => {
  it("computes the light rate and headcount from counters", async () => {
    const g = await h.group(2);
    const { id } = await h.flare(g.groupId, g.host, { quorum: 2 });
    await h.call("PUT", `/api/v1/gatherings/${id}/me`, { as: g.members[1], body: { answer: "yes" } });
    await h.call("POST", `/api/v1/gatherings/${id}/done`, { as: g.host });
    const k = kpis((await counterTotals(h.db)).totals);
    expect(k.flares_created).toBeGreaterThan(0);
    expect(k.headcount.lit_flares).toBeGreaterThan(0);
    expect(k.light_rate.value).toBeGreaterThan(0);
    expect(kpis({}).light_rate.value).toBeNull();
  });
});

describe("SPA shell for /app/* and /g/* (url-map.md)", () => {
  it("serves 200.html with its CSP for deep links and 404.html elsewhere", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "flare-web-"));
    fs.writeFileSync(path.join(dir, "200.html"), "<html><script>boot()</script>shell</html>");
    fs.writeFileSync(path.join(dir, "404.html"), "<html>missing</html>");
    const relay = new HubRelay(10);
    const app = createApp({ relay, db: null, version: "t", webBuildDir: dir });
    const g = await app.request("/g/3f2b8c1e-1d2a-4b3c-8d4e-5f6a7b8c9d0e/");
    expect(g.status).toBe(200);
    expect(await g.text()).toContain("shell");
    expect(g.headers.get("content-security-policy")).toContain("'sha256-");
    expect((await app.request("/app/settings")).status).toBe(200);
    expect((await app.request("/nope")).status).toBe(404);
    expect((await app.request("/api/v1/groups/x")).status).toBe(503);
    relay.close();
    fs.rmSync(dir, { recursive: true });
  });
  it("answers 503 not_configured for data routes when there is no database", async () => {
    const relay = new HubRelay(10);
    const app = createApp({ relay, db: null, version: "t" });
    const r = await app.request("/api/v1/gatherings/3f2b8c1e-1d2a-4b3c-8d4e-5f6a7b8c9d0e");
    expect(r.status).toBe(503);
    expect((await r.json()).code).toBe("not_configured");
    relay.close();
  });
});
