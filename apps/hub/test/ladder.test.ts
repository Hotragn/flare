// Ladder job on the hub (asyncapi ladderJob, ICR-BE-1 ToHubV11, SRS-PLAN-2) with ML's prompt v2
// and enforceLadder() (their guard tests live in packages/shared/test). Also the image warm-up.
import http from "node:http";
import type { AddressInfo } from "node:net";
import { LADDER_PROMPT, SYSTEM_PROMPT } from "@flare/shared";
import { afterEach, describe, expect, it } from "vitest";
import { WebSocketServer } from "ws";
import { startHub } from "../src/client.ts";
import { warm } from "../src/ollama.ts";

const ANSWER = JSON.stringify({
  labels: ["Fairlane loop", "Pond walk", "Bench stop", "Porch sit"],
  minutes: [60, 30, 15, 10],
});
const PHOTO = '{"invite":"Bench by the pond","alt":"A wooden bench beside a calm pond."}';

type Seen = { system: string; image: boolean; numPredict: number };
let cleanup: (() => void)[] = [];
afterEach(() => {
  for (const c of cleanup) c();
  cleanup = [];
});

async function fakeOllama(seen: Seen[], answerLadder = ANSWER) {
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      res.setHeader("content-type", "application/json");
      if (req.url === "/api/tags") return res.end(JSON.stringify({ models: [{ name: "fake-model" }] }));
      const j = JSON.parse(body);
      const image = Array.isArray(j.messages?.[1]?.images);
      seen.push({ system: j.messages?.[0]?.content, image, numPredict: j.options?.num_predict });
      res.end(JSON.stringify({ message: { content: image ? PHOTO : answerLadder } }));
    });
  });
  await new Promise<void>((r) => server.listen(0, r));
  cleanup.push(() => server.close());
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

async function hubWith(ollamaUrl: string, send: (ws: import("ws").WebSocket) => void, want: number) {
  const wss = new WebSocketServer({ port: 0 });
  await new Promise((r) => wss.once("listening", r));
  const results: Record<string, unknown>[] = [];
  const done = new Promise<void>((resolve) => {
    wss.on("connection", (ws) => {
      ws.on("message", (d) => {
        const m = JSON.parse(String(d));
        if (m.type === "hello") send(ws);
        if (m.type === "result") {
          results.push(m);
          if (results.length === want) resolve();
        }
      });
    });
  });
  const hub = startHub({
    serverUrl: `ws://127.0.0.1:${(wss.address() as AddressInfo).port}`,
    secret: "s",
    ollama: { url: ollamaUrl, model: "fake-model", timeoutMs: 5000 },
  });
  cleanup.push(() => {
    hub.stop();
    wss.close();
  });
  await done;
  return results;
}

const ladderJob = (id: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ type: "job", id, kind: "ladder-draft", ask: "Fairlane walk at 11?", total_minutes: 60, ...extra });

describe("hub runs a ladder job end to end", () => {
  it("text job in, four steps out with ML's prompt, photo jobs still work after it", async () => {
    const seen: Seen[] = [];
    const url = await fakeOllama(seen);
    const results = await hubWith(
      url,
      (ws) => {
        ws.send(ladderJob("11111111-2b7a-4d8e-9c3f-1a2b3c4d5e6f"));
        const jpeg = Buffer.alloc(500, 1);
        jpeg[0] = 0xff;
        jpeg[1] = 0xd8;
        ws.send(
          JSON.stringify({
            type: "job",
            id: "22222222-2b7a-4d8e-9c3f-1a2b3c4d5e6f",
            kind: "photo-draft",
            bytes: 500,
            mime: "image/jpeg",
          }),
        );
        ws.send(jpeg, { binary: true });
      },
      2,
    );
    expect(results[0]).toMatchObject({ id: "11111111-2b7a-4d8e-9c3f-1a2b3c4d5e6f", ok: true });
    expect(results[0]?.ladder).toEqual([
      { step: 1, label: "Fairlane loop", minutes: 60 },
      { step: 2, label: "Pond walk", minutes: 30 },
      { step: 3, label: "Bench stop", minutes: 15 },
      { step: 4, label: "Porch sit", minutes: 10 },
    ]);
    expect(results[1]).toMatchObject({ ok: true, draft: { invite: "Bench by the pond" } });
    expect(seen.map((s) => s.image)).toEqual([false, true]); // sequential, one call each
    expect(seen[0]?.system).toBe(LADDER_PROMPT.system);
    expect(seen[0]?.numPredict).toBe(LADDER_PROMPT.numPredict);
  });

  it("a ladder job that fails ToHubV11 is answered at once, not left to the 8 s timeout", async () => {
    const seen: Seen[] = [];
    const url = await fakeOllama(seen);
    const results = await hubWith(
      url,
      (ws) => ws.send(ladderJob("33333333-2b7a-4d8e-9c3f-1a2b3c4d5e6f", { total_minutes: 5 })),
      1,
    );
    expect(results[0]).toMatchObject({
      id: "33333333-2b7a-4d8e-9c3f-1a2b3c4d5e6f",
      ok: false,
      error: "unusable_answer",
    });
    expect(seen).toHaveLength(0);
  });

  it("an unusable model answer is unusable_answer at once: no retry by default (ADR-0025)", async () => {
    const seen: Seen[] = [];
    const url = await fakeOllama(seen, "no json here");
    const results = await hubWith(url, (ws) => ws.send(ladderJob("44444444-2b7a-4d8e-9c3f-1a2b3c4d5e6f")), 1);
    expect(results[0]).toMatchObject({ ok: false, error: "unusable_answer" });
    expect(seen).toHaveLength(1);
  });
});

describe("warm-up (ML failure F16)", () => {
  it("warms with the real photo system prompt plus an image, 4 tokens", async () => {
    const seen: Seen[] = [];
    const url = await fakeOllama(seen);
    await warm({ url, model: "fake-model", timeoutMs: 5000 });
    expect(seen).toEqual([{ system: SYSTEM_PROMPT, image: true, numPredict: 4 }]);
  });
});
