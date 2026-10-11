// ADR-0021: Sentry Agent Tracing sends AI-path timings and outcomes, and nothing personal.
// Runs the real AI routes with a fake hub, captures every Sentry envelope in memory, and
// checks the allow-listed attributes arrive while no photo, text, id or URL does.
import { HUB_PROTOCOL } from "@flare/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { ALLOWED, flushTracing, initTracing, scrubAttributes } from "../src/tracing.ts";
import { fakeJpeg, SECRET, startServer } from "./helpers.ts";

const sent: unknown[] = [];
const MARK_INVITE = "Zebracorn picnic by Marigold Lake";
const MARK_ASK = "Quokka walk near Hollyhock Lane";

beforeAll(() => {
  initTracing({ SENTRY_DSN: "https://public@o0.ingest.sentry.io/0" }, {
    transport: () => ({
      send: async (envelope: unknown) => {
        sent.push(envelope);
        return {};
      },
      flush: async () => true,
    }),
  } as never);
});
afterAll(async () => flushTracing());

const hubFor = (wsBase: string) =>
  new Promise<WebSocket>((resolve, reject) => {
    const ws = new WebSocket(`${wsBase}/hub`, { headers: { authorization: `Bearer ${SECRET}` } });
    let pending: string | null = null;
    ws.on("open", () => {
      ws.send(JSON.stringify({ type: "hello", protocol: HUB_PROTOCOL, model: "gemma4:e4b-it-q4_K_M", ready: true }));
      setTimeout(() => resolve(ws), 50);
    });
    ws.on("message", (d, bin) => {
      if (!bin) {
        const m = JSON.parse(String(d));
        if (m.type === "job" && m.kind === "ladder-draft")
          ws.send(
            JSON.stringify({
              type: "result",
              id: m.id,
              ok: true,
              ladder: [
                { step: 1, label: "Quokka lake loop", minutes: 60 },
                { step: 2, label: "Shorter lake loop", minutes: 30 },
                { step: 3, label: "Bench stop", minutes: 15 },
                { step: 4, label: "Quick hello", minutes: 10 },
              ],
              ms: 900,
              model: "gemma4:e4b-it-q4_K_M",
            }),
          );
        else if (m.type === "job") pending = m.id;
        return;
      }
      if (pending)
        ws.send(
          JSON.stringify({
            type: "result",
            id: pending,
            ok: true,
            draft: { invite: MARK_INVITE, alt: "A wooden bench beside Marigold Lake at sunset." },
            ms: 800,
            model: "gemma4:e4b-it-q4_K_M",
          }),
        );
      pending = null;
    });
    ws.on("error", reject);
  });

const serialize = (x: unknown) => JSON.stringify(x, (_k, v) => (v instanceof Uint8Array ? `<${v.length} bytes>` : v));

describe("Sentry agent tracing (ADR-0021)", () => {
  it("scrubAttributes keeps only allow-listed short tokens", () => {
    expect(
      scrubAttributes({ "flare.tier": "hub", "http.url": "/api/v1/gatherings/x", "flare.error": "a b c" }),
    ).toEqual({
      "flare.tier": "hub",
    });
    expect(ALLOWED.has("gen_ai.input.messages")).toBe(false);
  });

  it("traces photo and ladder jobs with tier and model, and sends nothing personal", async () => {
    const s = await startServer();
    const hub = await hubFor(s.ws);
    const photo = fakeJpeg(4096);
    const r1 = await (
      await fetch(`${s.base}/api/v1/drafts`, { method: "POST", headers: { "content-type": "image/jpeg" }, body: photo })
    ).json();
    const r2 = await (
      await fetch(`${s.base}/api/v1/drafts/ladder`, {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": "trace-test-key-0001" },
        body: JSON.stringify({ ask: MARK_ASK, total_minutes: 60 }),
      })
    ).json();
    expect(r1.tier).toBe("hub");
    expect(r2.tier).toBe("hub");
    hub.close();
    await s.close();
    await flushTracing(3000);

    const all = serialize(sent);
    // Arrived: the AI spans and their allow-listed outcome.
    expect(all).toContain("invoke_agent flare-photo");
    expect(all).toContain("invoke_agent flare-ladder");
    expect(all).toContain("chat gemma4:e4b-it-q4_K_M");
    expect(all).toContain("execute_tool enforce");
    expect(all).toContain('"flare.tier"');
    // Never: text, ask lines, photo bytes, URLs, headers, ids, IPs.
    for (const bad of [
      MARK_INVITE,
      "Zebracorn",
      "Marigold",
      MARK_ASK,
      "Quokka",
      "Hollyhock",
      "/api/v1",
      "authorization",
      "idempotency",
      "127.0.0.1",
      "user-agent",
    ])
      expect(all, bad).not.toContain(bad);
    expect(all).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/); // no UUIDs (ids)
    expect(all).not.toContain(`<${photo.length} bytes>`);
  });
});
