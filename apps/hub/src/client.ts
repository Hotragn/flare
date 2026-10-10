// Hub side of the relay (ADR-0006, contracts/asyncapi.yaml). Opens one outbound
// WebSocket to the server, answers pings, runs one photo job at a time, reconnects
// with exponential backoff. Imports no filesystem module: photos never touch disk.
import { HUB_PROTOCOL, JobHeader, type JobResultT, Ping, ToHub } from "@flare/shared";
import WebSocket from "ws";
import { draftFromPhoto, isModelReady, type OllamaConfig } from "./ollama.ts";

export type HubOptions = {
  serverUrl: string;
  secret: string;
  ollama: OllamaConfig;
  onLog?: (e: Record<string, unknown>) => void;
  /** Drop the socket if the server sends nothing (not even a ping) for this long. Default 15 s (3 missed pings). */
  silenceMs?: number;
};

const FIRST_RETRY_MS = 250;

export function startHub(opts: HubOptions): { stop: () => void } {
  const say = opts.onLog ?? (() => {});
  let ws: WebSocket | null = null;
  let stopped = false;
  let delay = FIRST_RETRY_MS;
  let lastHeard = Date.now();
  const silenceMs = opts.silenceMs ?? 15_000;
  // A Wi-Fi drop can leave a half-open socket that never closes (spike E1). The server pings
  // every 5 s, so 15 s of silence means the link is dead: terminate and reconnect.
  const watchdog = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN && Date.now() - lastHeard > silenceMs) {
      say({ event: "silent", ms: Date.now() - lastHeard });
      ws.terminate();
    }
  }, 1000);
  watchdog.unref();
  let waitingFor: { id: string; bytes: number } | null = null;

  const connect = () => {
    if (stopped) return;
    ws = new WebSocket(`${opts.serverUrl.replace(/\/$/, "")}/hub`, {
      headers: { authorization: `Bearer ${opts.secret}` },
    });
    ws.on("open", async () => {
      delay = FIRST_RETRY_MS;
      lastHeard = Date.now();
      const ready = await isModelReady(opts.ollama);
      ws?.send(JSON.stringify({ type: "hello", protocol: HUB_PROTOCOL, model: opts.ollama.model, ready }));
      say({ event: "connected", ready });
    });
    ws.on("message", async (data, isBinary) => {
      lastHeard = Date.now();
      if (!isBinary) {
        let raw: unknown;
        try {
          raw = JSON.parse(String(data));
        } catch {
          return;
        }
        const m = ToHub.safeParse(raw);
        if (!m.success) return;
        if (m.data.type === "ping") {
          const p = Ping.parse(m.data);
          ws?.send(JSON.stringify({ type: "pong", t: p.t }));
        } else {
          const h = JobHeader.parse(m.data);
          waitingFor = { id: h.id, bytes: h.bytes };
        }
        return;
      }
      if (!waitingFor) return;
      const job = waitingFor;
      waitingFor = null;
      const photo = data as Buffer;
      const t = performance.now();
      let result: JobResultT;
      try {
        if (photo.length !== job.bytes || photo[0] !== 0xff || photo[1] !== 0xd8)
          throw Object.assign(new Error("bad image"), { code: "bad_image" });
        const d = await draftFromPhoto(opts.ollama, photo);
        result = d
          ? {
              type: "result",
              id: job.id,
              ok: true,
              draft: { invite: d.invite, alt: d.alt },
              ms: Math.round(performance.now() - t),
              model: opts.ollama.model,
            }
          : {
              type: "result",
              id: job.id,
              ok: false,
              error: "unusable_answer",
              ms: Math.round(performance.now() - t),
              model: opts.ollama.model,
            };
      } catch (e) {
        const code = (e as { code?: string }).code === "bad_image" ? "bad_image" : "model_unavailable";
        result = {
          type: "result",
          id: job.id,
          ok: false,
          error: code,
          ms: Math.round(performance.now() - t),
          model: opts.ollama.model,
        };
      } finally {
        photo.fill(0); // clear the photo bytes as soon as the job ends
      }
      ws?.send(JSON.stringify(result));
      say({ event: "job", ok: result.ok, ms: result.ms });
    });
    ws.on("close", (code) => {
      say({ event: "closed", code });
      if (!stopped) setTimeout(connect, delay);
      delay = Math.min(delay * 2, 30_000);
    });
    ws.on("error", () => {}); // close follows; backoff handles it
  };
  connect();
  return {
    stop: () => {
      stopped = true;
      clearInterval(watchdog);
      ws?.close();
    },
  };
}
