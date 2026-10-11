import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { navigationFallbacks, precacheList, routeFor, staleCaches } from "../../src/lib/push/cache-plan.ts";

const O = "https://flare.test";
const pre = new Set(["/", "/_app/immutable/a.js", "/maps/fairlane.json"]);
const r = (url: string, mode = "no-cors", method = "GET") => routeFor({ url: `${O}${url}`, mode, method }, O, pre);

describe("PW5 cache plan (ADR-0010, SRS-OFF-4)", () => {
  it("SRS-OFF-4: precaches build, static files and prerendered pages, minus splash and check", () => {
    const list = precacheList(
      ["/_app/immutable/a.js"],
      [
        "/favicon.svg",
        "/splash/iphone-13-portrait-light.png",
        "/check/index.html",
        "/maps/fairlane.json",
        "/icons/icon-1024.png",
      ],
      ["/", "/how/"],
    );
    expect(list).toEqual(["/_app/immutable/a.js", "/favicon.svg", "/maps/fairlane.json", "/", "/how/"]);
  });

  it("never handles the API, the hub, writes or other origins", () => {
    expect(r("/api/v1/gatherings/x")).toBe("skip");
    expect(r("/api/v1/gatherings/x/events")).toBe("skip");
    expect(r("/hub")).toBe("skip");
    expect(r("/api/v1/groups", "cors", "POST")).toBe("skip");
    expect(routeFor({ url: "https://other.test/x.js", mode: "no-cors", method: "GET" }, O, pre)).toBe("skip");
  });

  it("serves precached files from the cache and navigations network-first", () => {
    expect(r("/_app/immutable/a.js")).toBe("precache");
    expect(r("/maps/fairlane.json")).toBe("precache");
    expect(r("/g/123/", "navigate")).toBe("navigate");
    expect(r("/_app/immutable/new.js")).toBe("static");
    expect(r("/photo.jpg")).toBe("skip");
  });

  it("offline navigation falls back to the page, then the SPA shell", () => {
    expect(navigationFallbacks("/how")).toEqual(["/how", "/how/", "/200.html", "/404.html", "/"]);
    expect(navigationFallbacks("/g/abc/")).toEqual(["/g/abc/", "/g/abc", "/200.html", "/404.html", "/"]);
  });

  it("versioning: deletes only older flare caches", () => {
    expect(staleCaches(["flare-1", "flare-2", "other"], "flare-2")).toEqual(["flare-1"]);
  });

  it("manifest: standalone, start /app/, icons 192 and 512 with maskable, colours from the brand", () => {
    const m = JSON.parse(readFileSync(new URL("../../static/manifest.webmanifest", import.meta.url), "utf8"));
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBe("/app/");
    expect(m.background_color).toBe("#F6F1E7");
    const sizes = m.icons.map((i: { sizes: string; purpose: string }) => `${i.sizes} ${i.purpose}`);
    expect(sizes).toEqual(["192x192 any", "512x512 any", "192x192 maskable", "512x512 maskable"]);
    for (const i of m.icons) expect(() => readFileSync(new URL(`../../static${i.src}`, import.meta.url))).not.toThrow();
  });
});
