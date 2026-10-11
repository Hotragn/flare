// BR-AI-1 on the hub: a job past the server's wait is answered "timeout" and never reaches
// Ollama, so one slow answer can't push every later photo past 6 s (measured 2026-10-10).
import http from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import { WebSocketServer } from "ws";
import { startHub } from "../src/client.ts";

describe("hub job budget", () => {
  it("times out a slow job and drops the stale one queued behind it", async () => {
    let calls = 0;
    const ollama = http.createServer((req, res) => {
      req.resume();
      req.on("end", () => {
        res.setHeader("content-type", "application/json");
        if (req.url === "/api/tags") return res.end(JSON.stringify({ models: [{ name: "m" }] }));
        calls++;
        setTimeout(() => res.end(JSON.stringify({ message: { content: '{"invite":"Bench","alt":"A bench."}' } })), 400);
      });
    });
    await new Promise<void>((r) => ollama.listen(0, r));
    const wss = new WebSocketServer({ port: 0 });
    await new Promise((r) => wss.once("listening", r));
    const results: { id: string; ok: boolean; error?: string }[] = [];
    const done = new Promise<void>((resolve) => {
      wss.on("connection", (ws) => {
        ws.on("message", (d) => {
          const m = JSON.parse(String(d));
          if (m.type === "hello") {
            for (const id of ["aaaaaaaa-2b7a-4d8e-9c3f-1a2b3c4d5e6f", "bbbbbbbb-2b7a-4d8e-9c3f-1a2b3c4d5e6f"]) {
              const jpeg = Buffer.alloc(100, 1);
              jpeg[0] = 0xff;
              jpeg[1] = 0xd8;
              ws.send(JSON.stringify({ type: "job", id, kind: "photo-draft", bytes: 100, mime: "image/jpeg" }));
              ws.send(jpeg, { binary: true });
            }
          }
          if (m.type === "result") {
            results.push(m);
            if (results.length === 2) resolve();
          }
        });
      });
    });
    const hub = startHub({
      serverUrl: `ws://127.0.0.1:${(wss.address() as AddressInfo).port}`,
      secret: "s",
      ollama: { url: `http://127.0.0.1:${(ollama.address() as AddressInfo).port}`, model: "m", timeoutMs: 5000 },
      budgetMs: { photo: 250 },
    });
    await done;
    hub.stop();
    wss.close();
    ollama.close();
    expect(results.map((r) => r.error)).toEqual(["timeout", "timeout"]);
    expect(calls).toBe(1); // the second job was stale before it started
  });
});
