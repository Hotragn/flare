import { HUB_PROTOCOL } from "@flare/shared";
import { afterEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { fakeJpeg, SECRET, startServer } from "./helpers.ts";

let close: (() => Promise<void>) | null = null;
afterEach(async () => {
  await close?.();
  close = null;
});

const connectFakeHub = (wsBase: string, reply: (id: string) => object | null) =>
  new Promise<WebSocket>((resolve, reject) => {
    const ws = new WebSocket(`${wsBase}/hub`, { headers: { authorization: `Bearer ${SECRET}` } });
    let pending: string | null = null;
    ws.on("open", () => {
      ws.send(JSON.stringify({ type: "hello", protocol: HUB_PROTOCOL, model: "fake", ready: true }));
      setTimeout(() => resolve(ws), 50);
    });
    ws.on("message", (d, bin) => {
      if (!bin) {
        const m = JSON.parse(String(d));
        if (m.type === "job") pending = m.id;
        return;
      }
      if (pending) {
        const r = reply(pending);
        if (r) ws.send(JSON.stringify(r));
        pending = null;
      }
    });
    ws.on("error", reject);
  });

describe("health", () => {
  it("reports hub absent and db not configured", async () => {
    const s = await startServer();
    close = s.close;
    const h = await (await fetch(`${s.base}/api/v1/health`)).json();
    expect(h).toEqual({ ok: true, version: "test", hub: "absent", db: "not_configured" });
  });
  it("sends security headers", async () => {
    const s = await startServer();
    close = s.close;
    const r = await fetch(`${s.base}/api/v1/health`);
    expect(r.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(r.headers.get("referrer-policy")).toBe("no-referrer");
  });
});

describe("drafts", () => {
  it("falls back to the template when no hub is connected", async () => {
    const s = await startServer();
    close = s.close;
    const r = await fetch(`${s.base}/api/v1/drafts`, {
      method: "POST",
      headers: { "content-type": "image/jpeg" },
      body: fakeJpeg(),
    });
    const d = await r.json();
    expect(r.status).toBe(200);
    expect(d.tier).toBe("rules");
    expect(d.invite).toBe("Outside right now. Come?");
  });
  it("returns the hub's guarded draft", async () => {
    const s = await startServer();
    const hub = await connectFakeHub(s.ws, (id) => ({
      type: "result",
      id,
      ok: true,
      draft: {
        invite: "Golden pond, come sit with me now",
        alt: "A pond with yellow trees and an empty wooden bench by the path.",
      },
      ms: 900,
      model: "fake",
    }));
    close = async () => {
      hub.close();
      await s.close();
    };
    const d = await (
      await fetch(`${s.base}/api/v1/drafts`, {
        method: "POST",
        headers: { "content-type": "image/jpeg" },
        body: fakeJpeg(),
      })
    ).json();
    expect(d.tier).toBe("hub");
    expect(d.invite).toBe("Golden pond, come sit with me"); // 7 words clipped to 6 by enforce()
  });
  it("times out to the template if the hub never answers", async () => {
    const s = await startServer(null, 300);
    const hub = await connectFakeHub(s.ws, () => null);
    close = async () => {
      hub.close();
      await s.close();
    };
    const d = await (
      await fetch(`${s.base}/api/v1/drafts`, {
        method: "POST",
        headers: { "content-type": "image/jpeg" },
        body: fakeJpeg(),
      })
    ).json();
    expect(d.tier).toBe("rules");
  });
  it("rejects non-JPEG and oversized bodies", async () => {
    const s = await startServer();
    close = s.close;
    expect(
      (await fetch(`${s.base}/api/v1/drafts`, { method: "POST", headers: { "content-type": "image/png" }, body: "x" }))
        .status,
    ).toBe(415);
    expect(
      (
        await fetch(`${s.base}/api/v1/drafts`, {
          method: "POST",
          headers: { "content-type": "image/jpeg" },
          body: Buffer.from("hello"),
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await fetch(`${s.base}/api/v1/drafts`, {
          method: "POST",
          headers: { "content-type": "image/jpeg" },
          body: fakeJpeg(1_600_000),
        })
      ).status,
    ).toBe(413);
  });
});

describe("hub relay auth", () => {
  it("refuses a wrong secret", async () => {
    const s = await startServer();
    close = s.close;
    const code = await new Promise((resolve) => {
      const ws = new WebSocket(`${s.ws}/hub`, { headers: { authorization: "Bearer nope" } });
      ws.on("unexpected-response", (_q, res) => resolve(res.statusCode));
      ws.on("error", () => {});
    });
    expect(code).toBe(401);
  });
});
