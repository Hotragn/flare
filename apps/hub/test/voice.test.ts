// Voice Flare job on the hub (asyncapi voiceJob, ADR-0028): header plus one WAV frame in, voice
// prompt v1 with the audio in Ollama's images field, enforce() before anything leaves the hub.
import http from "node:http";
import type { AddressInfo } from "node:net";
import { VOICE_SYSTEM_PROMPT } from "@flare/shared";
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

async function runVoice(answer: string, seen: Seen[], frame?: Buffer) {
  const url = await fakeOllama(seen, answer);
  const wss = new WebSocketServer({ port: 0 });
  await new Promise((r) => wss.once("listening", r));
  const wav = frame ?? Buffer.alloc(400, 7);
  if (!frame) {
    wav.write("RIFF", 0, "latin1");
    wav.write("WAVE", 8, "latin1");
  }
  const result = new Promise<Record<string, unknown>>((resolve) => {
    wss.on("connection", (ws) => {
      ws.on("message", (d) => {
        const m = JSON.parse(String(d));
        if (m.type === "hello") {
          ws.send(
            JSON.stringify({
              type: "job",
              id: "66666666-2b7a-4d8e-9c3f-1a2b3c4d5e6f",
              kind: "voice-draft",
              bytes: wav.length,
              mime: "audio/wav",
            }),
          );
          ws.send(wav, { binary: true });
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

describe("hub runs a voice job end to end (ADR-0028)", () => {
  it("audio in, a guarded invite out, with the voice prompt and the audio as media", async () => {
    const seen: Seen[] = [];
    const r = await runVoice(
      '{"invite": "Meet at the pond bench", "alt": "A pond in a park with a bench in warm evening light."}',
      seen,
    );
    expect(r).toMatchObject({ id: "66666666-2b7a-4d8e-9c3f-1a2b3c4d5e6f", ok: true });
    expect(r.draft).toEqual({
      invite: "Meet at the pond bench",
      alt: "A pond in a park with a bench in warm evening light.",
    });
    expect(seen).toEqual([{ system: VOICE_SYSTEM_PROMPT, image: true }]);
  });
  it("no place heard: unusable_answer, so the phone asks the host to type", async () => {
    const r = await runVoice('{"invite": "", "alt": ""}', []);
    expect(r).toMatchObject({ ok: false, error: "unusable_answer" });
  });
  it("a frame that is not WAV is bad_audio and never reaches the model", async () => {
    const seen: Seen[] = [];
    const r = await runVoice("{}", seen, Buffer.alloc(300, 1));
    expect(r).toMatchObject({ ok: false, error: "bad_audio" });
    expect(seen).toHaveLength(0);
  });
});
