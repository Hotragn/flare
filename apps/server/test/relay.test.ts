// Heartbeat and fail-fast behaviour found by spike E1 (docs/engineering/spikes/E1-relay-faults.md).
import { afterEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { fakeJpeg, SECRET, startServer } from "./helpers.ts";

let close: () => Promise<void> = async () => {};
afterEach(async () => close());

const hubSocket = (url: string) =>
  new Promise<WebSocket>((resolve, reject) => {
    const ws = new WebSocket(`${url}/hub`, { headers: { authorization: `Bearer ${SECRET}` } });
    ws.on("open", () => {
      ws.send(JSON.stringify({ type: "hello", protocol: "flare-hub.v1", model: "m", ready: true }));
      setTimeout(() => resolve(ws), 50);
    });
    ws.on("error", reject);
  });

describe("relay heartbeat", () => {
  it("drops a hub that stops answering, so health stops claiming it", async () => {
    const s = await startServer(null, 3000, 100); // ping every 100 ms, dead after 250 ms
    close = s.close;
    const ws = await hubSocket(s.ws);
    ws.pause(); // a silent half-open link: we stop reading and never answer
    expect(s.relay.status).toBe("connected");
    await new Promise((r) => setTimeout(r, 600));
    expect(s.relay.status).toBe("absent");
  });
  it("keeps a hub that answers pings", async () => {
    const s = await startServer(null, 3000, 100);
    close = s.close;
    const ws = await hubSocket(s.ws);
    ws.on("message", (d) => {
      const m = JSON.parse(String(d));
      if (m.type === "ping") ws.send(JSON.stringify({ type: "pong", t: m.t }));
    });
    await new Promise((r) => setTimeout(r, 600));
    expect(s.relay.status).toBe("connected");
  });
  it("answers jobs in flight at once when the hub socket closes, not after the budget", async () => {
    const s = await startServer(null, 5000, 1000);
    close = s.close;
    const ws = await hubSocket(s.ws);
    ws.on("message", (_d, isBinary) => {
      if (isBinary) ws.terminate(); // hub vanishes mid-job
    });
    const t = performance.now();
    const r = await fetch(`${s.base}/api/v1/drafts`, {
      method: "POST",
      headers: { "content-type": "image/jpeg" },
      body: fakeJpeg(),
    });
    const ms = performance.now() - t;
    expect((await r.json()).tier).toBe("rules");
    expect(ms).toBeLessThan(1000);
  });
});
