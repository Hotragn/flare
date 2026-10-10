import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { WebSocketServer } from "ws";
import { startHub } from "../src/client.ts";

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src");

describe("hub keeps photos in memory only (ADR-0011)", () => {
  it("imports no filesystem or child-process module", () => {
    for (const f of fs.readdirSync(SRC)) {
      const code = fs.readFileSync(path.join(SRC, f), "utf8");
      expect(code, f).not.toMatch(/from "node:(fs|fs\/promises|child_process)"|require\(["'](fs|child_process)/);
    }
  });

  it("runs a job end to end against a fake Ollama and writes no files", async () => {
    // Fake Ollama: answers /api/tags and /api/chat, and records whether it got an image.
    let sawImage = false;
    const ollama = http.createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        res.setHeader("content-type", "application/json");
        if (req.url === "/api/tags") return res.end(JSON.stringify({ models: [{ name: "fake-model" }] }));
        const j = JSON.parse(body);
        sawImage = Array.isArray(j.messages?.[1]?.images) && j.think === false;
        res.end(
          JSON.stringify({
            message: {
              content:
                '{"invite":"Bench by the pond","alt":"A wooden bench beside a calm pond with yellow trees behind it."}',
            },
          }),
        );
      });
    });
    await new Promise<void>((r) => ollama.listen(0, r));
    const ollamaUrl = `http://127.0.0.1:${(ollama.address() as AddressInfo).port}`;

    // Fake server: accepts the hub, sends one job, collects the result.
    const wss = new WebSocketServer({ port: 0 });
    await new Promise((r) => wss.once("listening", r));
    const serverUrl = `ws://127.0.0.1:${(wss.address() as AddressInfo).port}`;

    const tmpBefore = new Set(fs.readdirSync(os.tmpdir()));
    const result = new Promise<Record<string, unknown>>((resolve) => {
      wss.on("connection", (ws, req) => {
        expect(req.headers.authorization).toBe("Bearer s3cret");
        ws.on("message", (d) => {
          const m = JSON.parse(String(d));
          if (m.type === "hello") {
            const jpeg = Buffer.alloc(1000, 7);
            jpeg[0] = 0xff;
            jpeg[1] = 0xd8;
            ws.send(
              JSON.stringify({
                type: "job",
                id: "6f1d4c1e-2b7a-4d8e-9c3f-1a2b3c4d5e6f",
                kind: "photo-draft",
                bytes: jpeg.length,
                mime: "image/jpeg",
              }),
            );
            ws.send(jpeg, { binary: true });
          }
          if (m.type === "result") resolve(m);
        });
      });
    });
    const hub = startHub({
      serverUrl,
      secret: "s3cret",
      ollama: { url: ollamaUrl, model: "fake-model", timeoutMs: 5000 },
    });
    const r = await result;
    hub.stop();
    wss.close();
    ollama.close();
    expect(r).toMatchObject({ type: "result", ok: true, draft: { invite: "Bench by the pond" } });
    expect(sawImage).toBe(true);
    const created = fs.readdirSync(os.tmpdir()).filter((f) => !tmpBefore.has(f) && /flare|hub|jpe?g/i.test(f));
    expect(created).toEqual([]);
  });
});
