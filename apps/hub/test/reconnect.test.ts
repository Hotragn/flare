// The hub's side of spike E1: a silent server link is dropped and redialled.
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { WebSocketServer } from "ws";
import { startHub } from "../src/client.ts";

let cleanup: () => void = () => {};
afterEach(() => cleanup());

describe("hub reconnects", () => {
  it("terminates a socket that goes silent and dials again", async () => {
    let connections = 0;
    const wss = new WebSocketServer({ port: 0 });
    wss.on("connection", () => connections++); // never pings: a dead link from the hub's view
    await new Promise((r) => wss.once("listening", r));
    const port = (wss.address() as AddressInfo).port;
    const events: string[] = [];
    const hub = startHub({
      serverUrl: `ws://127.0.0.1:${port}`,
      secret: "x",
      ollama: { url: "http://127.0.0.1:9", model: "m", timeoutMs: 200 },
      silenceMs: 300,
      onLog: (e) => events.push(String(e.event)),
    });
    cleanup = () => {
      hub.stop();
      wss.close();
    };
    await new Promise((r) => setTimeout(r, 2500));
    expect(events).toContain("silent");
    expect(connections).toBeGreaterThanOrEqual(2);
  });
  it("redials quickly after the server closes the socket", async () => {
    const wss = new WebSocketServer({ port: 0 });
    const at: number[] = [];
    wss.on("connection", (ws) => {
      at.push(Date.now());
      if (at.length === 1) setTimeout(() => ws.terminate(), 50);
    });
    await new Promise((r) => wss.once("listening", r));
    const hub = startHub({
      serverUrl: `ws://127.0.0.1:${(wss.address() as AddressInfo).port}`,
      secret: "x",
      ollama: { url: "http://127.0.0.1:9", model: "m", timeoutMs: 200 },
    });
    cleanup = () => {
      hub.stop();
      wss.close();
    };
    await new Promise((r) => setTimeout(r, 1200));
    expect(at.length).toBeGreaterThanOrEqual(2);
    expect((at[1] ?? 0) - (at[0] ?? 0)).toBeLessThan(800); // 50 ms + 250 ms first retry
  });
});
