// Fix the map tags job on the hub (asyncapi tagsJob, ICR-ML5, SRS-MAP-1): header plus photo
// frame in, ML's osm-tags prompt v1, enforceOsmTags() before anything leaves the hub.
import http from "node:http";
import type { AddressInfo } from "node:net";
import { OSM_PROMPT } from "@flare/shared";
import { afterEach, describe, expect, it } from "vitest";
import { WebSocketServer } from "ws";
import { startHub } from "../src/client.ts";

type Seen = { system: string; image: boolean };
let cleanup: (() => void)[] = [];
afterEach(() => {
  for (const c of cleanup) c();
  cleanup = [];
});

async function fakeOllama(seen: Seen[], answer: string) {
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      res.setHeader("content-type", "application/json");
      if (req.url === "/api/tags") return res.end(JSON.stringify({ models: [{ name: "fake-model" }] }));
      const j = JSON.parse(body);
      seen.push({ system: j.messages?.[0]?.content, image: Array.isArray(j.messages?.[1]?.images) });
      res.end(JSON.stringify({ message: { content: answer } }));
    });
  });
  await new Promise<void>((r) => server.listen(0, r));
  cleanup.push(() => server.close());
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

async function runTags(answer: string, seen: Seen[]) {
  const url = await fakeOllama(seen, answer);
  const wss = new WebSocketServer({ port: 0 });
  await new Promise((r) => wss.once("listening", r));
  const jpeg = Buffer.alloc(400, 7);
  jpeg[0] = 0xff;
  jpeg[1] = 0xd8;
  const result = new Promise<Record<string, unknown>>((resolve) => {
    wss.on("connection", (ws) => {
      ws.on("message", (d) => {
        const m = JSON.parse(String(d));
        if (m.type === "hello") {
          ws.send(
            JSON.stringify({
              type: "job",
              id: "55555555-2b7a-4d8e-9c3f-1a2b3c4d5e6f",
              kind: "tags-draft",
              bytes: 400,
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
    serverUrl: `ws://127.0.0.1:${(wss.address() as AddressInfo).port}`,
    secret: "s",
    ollama: { url, model: "fake-model", timeoutMs: 5000 },
  });
  cleanup.push(() => {
    hub.stop();
    wss.close();
  });
  return result;
}

describe("hub runs a tags job end to end", () => {
  it("photo in, only allow-listed tags out, with ML's osm-tags prompt", async () => {
    const seen: Seen[] = [];
    const r = await runTags(
      '{"tags":{"amenity":"bench","backrest":"yes","seats":3,"name":"Smith memorial","colour":"green"}}',
      seen,
    );
    expect(r).toMatchObject({ id: "55555555-2b7a-4d8e-9c3f-1a2b3c4d5e6f", ok: true });
    expect(r.tags).toEqual({ amenity: "bench", backrest: "yes", seats: "3" }); // name and colour dropped
    expect(r.draft).toBeUndefined();
    expect(seen).toEqual([{ system: OSM_PROMPT.system, image: true }]);
  });

  it("an empty draft is a valid answer, not a failure", async () => {
    const r = await runTags('{"tags":{}}', []);
    expect(r).toMatchObject({ ok: true, tags: {} });
  });

  it("a non-JSON answer is unusable_answer after one retry", async () => {
    const seen: Seen[] = [];
    const r = await runTags("I see a bench", seen);
    expect(r).toMatchObject({ ok: false, error: "unusable_answer" });
    expect(seen).toHaveLength(2);
  });
});
