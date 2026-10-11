import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { fetchAudit } from "../../src/routes/(site)/audit.ts";
import { ldJson, ORIGIN, PAGES, softwareApplication } from "../../src/routes/(site)/seo.ts";

const ok =
  (v: unknown, status = 200) =>
  async () =>
    new Response(JSON.stringify(v), { status });
const store = (store: string, per_gathering: boolean, expired_rows: number) => ({
  store,
  table: `t_${store}`,
  per_gathering,
  total_rows: 10,
  expired_rows,
});

describe("SRS-WEB-2 live deletion audit", () => {
  it("passes with 0 leftover in per-gathering stores", async () => {
    const v = await fetchAudit(
      ok({ at: "2026-10-11T19:00:00Z", pass: true, stores: [store("DS1", true, 0), store("DS10", false, 0)] }),
    );
    expect(v).toMatchObject({ s: "ok", pass: true, leftover: 0 });
  });
  it("shows leftovers as they are", async () => {
    const v = await fetchAudit(
      ok({ at: "2026-10-11T19:00:00Z", pass: false, stores: [store("DS1", true, 3), store("DS10", false, 9)] }),
    );
    expect(v).toMatchObject({ s: "ok", pass: false, leftover: 3 });
  });
  it("fails soft on network error, bad status, bad shape and a slow server", async () => {
    expect(await fetchAudit(async () => Promise.reject(new TypeError("offline")))).toEqual({ s: "down" });
    expect(await fetchAudit(ok({}, 503))).toEqual({ s: "down" });
    expect(await fetchAudit(ok({ at: "x", pass: "yes", stores: [] }))).toEqual({ s: "down" });
    expect(await fetchAudit(ok({ at: "not a date", pass: true, stores: [] }))).toEqual({ s: "down" });
    const slow = (_u: string, i?: RequestInit) =>
      new Promise<Response>((_ok, fail) => i?.signal?.addEventListener("abort", () => fail(new Error("aborted"))));
    expect(await fetchAudit(slow, 20)).toEqual({ s: "down" });
  });
});

describe("SEO", () => {
  it("SRS-WEB-1: the five pages, each with a title and a description", () => {
    expect(PAGES.map((p) => p.path)).toEqual(["/", "/how/", "/privacy/", "/accessibility/", "/run/"]);
    for (const p of PAGES) {
      expect(p.title.length).toBeGreaterThan(5);
      expect(p.desc.length).toBeGreaterThan(50);
      expect(p.desc.length).toBeLessThanOrEqual(160);
    }
  });
  it("sitemap.xml lists exactly the five pages on the production origin", () => {
    const xml = fs.readFileSync(new URL("../../static/sitemap.xml", import.meta.url), "utf8");
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs).toEqual(PAGES.map((p) => `${ORIGIN}${p.path}`));
    const robots = fs.readFileSync(new URL("../../static/robots.txt", import.meta.url), "utf8");
    expect(robots).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
  });
  it("JSON-LD is a free SoftwareApplication and can't close its script tag", () => {
    const ld = softwareApplication();
    expect(ld["@type"]).toBe("SoftwareApplication");
    expect(ld.offers).toMatchObject({ price: "0" });
    expect(ldJson({ x: "</script><b>" })).not.toContain("<");
  });
});
