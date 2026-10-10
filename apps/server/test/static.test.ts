// Static web build serving: CSP hashes, 404s, path traversal, error bodies.
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp, csp, inlineScriptHashes } from "../src/app.ts";
import { HubRelay } from "../src/hub/relay.ts";

const BOOT = "window.__boot = 1;";
let dir = "";
let app: ReturnType<typeof createApp>;
let relay: HubRelay;

beforeAll(() => {
  // Not in os.tmpdir(): the hub test watches that folder to prove the hub writes no files.
  const cache = path.resolve(import.meta.dirname, "../../../node_modules/.cache");
  fs.mkdirSync(cache, { recursive: true });
  dir = fs.mkdtempSync(path.join(cache, "flare-web-"));
  fs.mkdirSync(path.join(dir, "hello"));
  fs.writeFileSync(
    path.join(dir, "hello/index.html"),
    `<html><script>${BOOT}</script><script src="/a.js"></script></html>`,
  );
  fs.writeFileSync(path.join(dir, "404.html"), "<html>not here</html>");
  fs.writeFileSync(path.join(dir, "..", `${path.basename(dir)}-secret.txt`), "outside");
  relay = new HubRelay(10);
  app = createApp({ relay, db: null, version: "t", webBuildDir: dir });
});
afterAll(() => {
  relay.close();
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(path.join(dir, "..", `${path.basename(dir)}-secret.txt`), { force: true });
});

describe("static serving", () => {
  it("allows the inline bootstrap by hash and no other inline script", async () => {
    const r = await app.request("/hello/");
    const policy = r.headers.get("content-security-policy") ?? "";
    const hash = createHash("sha256").update(BOOT).digest("base64");
    expect(policy).toContain(`script-src 'self' 'sha256-${hash}'`);
    expect(policy).not.toMatch(/script-src[^;]*unsafe-inline/);
  });
  it("hashes only scripts without src", () => {
    expect(inlineScriptHashes('<script src="x.js"></script><script type="module">a()</script>')).toHaveLength(1);
  });
  it("gives API responses the base policy", async () => {
    const r = await app.request("/api/v1/health");
    expect(r.headers.get("content-security-policy")).toBe(csp([]));
    expect(r.headers.get("strict-transport-security")).toContain("max-age=");
  });
  it("answers unknown pages with 404 and the 404 page", async () => {
    const r = await app.request("/nope");
    expect(r.status).toBe(404);
    expect(await r.text()).toContain("not here");
  });
  it("refuses paths outside the build, including sibling folders with the same prefix", async () => {
    const sibling = `/../${path.basename(dir)}-secret.txt`;
    const r = await app.request(sibling.replace("..", "%2e%2e"));
    expect(await r.text()).not.toContain("outside");
  });
  it("returns errors in the contract shape", async () => {
    const r = await app.request("/api/v1/drafts", {
      method: "POST",
      headers: { "content-type": "image/png" },
      body: "x",
    });
    expect(r.status).toBe(415);
    expect(await r.json()).toEqual({ code: "not_jpeg", message: "Send image/jpeg" });
  });
});
