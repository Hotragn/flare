// ADR-0025: no identical retry at temperature 0. Default "none" (the template takes over);
// "corrective" retries once with the first answer and a
// correction, only when it fits before the deadline.
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { LADDER_CORRECTION, ladderFromAsk } from "../src/ollama.ts";

type Msg = { role: string; content: string };
let close: (() => void) | null = null;
afterEach(() => close?.());

async function fakeOllama(answers: string[], delayMs = 0) {
  const seen: Msg[][] = [];
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      seen.push(JSON.parse(body).messages);
      const content = answers[Math.min(seen.length - 1, answers.length - 1)];
      setTimeout(() => res.end(JSON.stringify({ message: { content } })), delayMs);
    });
  });
  await new Promise<void>((r) => server.listen(0, r));
  close = () => server.close();
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, seen };
}

const BAD =
  '{"labels": ["Walk to Paris", "Walk to Rome", "Walk to Oslo", "Walk to Bern"], "minutes": [60, 30, 15, 10]}';
const GOOD = '{"labels": ["Fairlane walk", "Short loop", "Quick lap", "Sit by water"], "minutes": [60, 30, 15, 10]}';
const job = { type: "job", id: "x", kind: "ladder-draft", ask: "Fairlane walk", total_minutes: 60 } as never;

describe("ladderFromAsk retry", () => {
  it("retries once with the first answer and a correction, not the same prompt", async () => {
    const o = await fakeOllama([BAD, GOOD]);
    const l = await ladderFromAsk({ url: o.url, model: "m", timeoutMs: 5000 }, job, undefined, { retry: "corrective" });
    expect(l?.[0]?.label).toBe("Fairlane walk");
    expect(o.seen).toHaveLength(2);
    expect(o.seen[1]?.slice(2)).toEqual([
      { role: "assistant", content: BAD },
      { role: "user", content: LADDER_CORRECTION },
    ]);
  });

  it("a good first answer needs one call", async () => {
    const o = await fakeOllama([GOOD]);
    await ladderFromAsk({ url: o.url, model: "m", timeoutMs: 5000 }, job);
    expect(o.seen).toHaveLength(1);
  });

  it("skips the retry when another call of the same length would pass the deadline", async () => {
    const o = await fakeOllama([BAD, GOOD], 150);
    const l = await ladderFromAsk({ url: o.url, model: "m", timeoutMs: 5000 }, job, undefined, {
      retry: "corrective",
      deadline: performance.now() + 250,
    });
    expect(l).toBeNull();
    expect(o.seen).toHaveLength(1);
  });

  it("retry none: the template takes over after one unusable answer", async () => {
    const o = await fakeOllama([BAD, GOOD]);
    const l = await ladderFromAsk({ url: o.url, model: "m", timeoutMs: 5000 }, job, undefined, { retry: "none" });
    expect(l).toBeNull();
    expect(o.seen).toHaveLength(1);
  });
});
