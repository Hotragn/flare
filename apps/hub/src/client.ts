// Hub side of the relay (ADR-0006, contracts/asyncapi.yaml). Opens one outbound
// WebSocket to the server, answers pings, runs one job at a time (photo or ladder), reconnects
// with exponential backoff. Imports no filesystem module: photos never touch disk.
import { HUB_PROTOCOL, JobHeader, Ping } from "@flare/shared";
import WebSocket from "ws";
import { LadderJob, type LadderStep } from "./ladder.ts";
import { draftFromPhoto, isModelReady, ladderFromAsk, type OllamaConfig } from "./ollama.ts";

export type HubOptions = {
  serverUrl: string;
  secret: string;
  ollama: OllamaConfig;
  onLog?: (e: Record<string, unknown>) => void;
  /** Drop the socket if the server sends nothing (not even a ping) for this long. Default 15 s (3 missed pings). */
  silenceMs?: number;
};

/** asyncapi `result`: draft for photo jobs, ladder for ladder jobs. */
export type HubResult = {
  type: "result";
  id: string;
  ok: boolean;
  draft?: { invite: string; alt: string };
  ladder?: LadderStep[];
  error?: "model_unavailable" | "unusable_answer" | "timeout" | "bad_image";
  ms: number;
  model: string;
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
  // One model call at a time: Ollama is shared on this Mac, and order keeps results simple.
  let queue: Promise<void> = Promise.resolve();
  const enqueue = (fn: () => Promise<void>) => {
    queue = queue.then(fn).catch(() => {});
  };
  const send = (r: HubResult, kind: string) => {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(r));
    say({ event: "job", kind, ok: r.ok, ms: r.ms });
  };
  const base = (id: string, t: number) => ({
    type: "result" as const,
    id,
    ms: Math.round(performance.now() - t),
    model: opts.ollama.model,
  });

  const runPhoto = async (job: { id: string; bytes: number }, photo: Buffer) => {
    const t = performance.now();
    let result: HubResult;
    try {
      if (photo.length !== job.bytes || photo[0] !== 0xff || photo[1] !== 0xd8)
        throw Object.assign(new Error("bad image"), { code: "bad_image" });
      const d = await draftFromPhoto(opts.ollama, photo);
      result = d
        ? { ...base(job.id, t), ok: true, draft: { invite: d.invite, alt: d.alt } }
        : { ...base(job.id, t), ok: false, error: "unusable_answer" };
    } catch (e) {
      const code = (e as { code?: string }).code === "bad_image" ? "bad_image" : "model_unavailable";
      result = { ...base(job.id, t), ok: false, error: code };
    } finally {
      photo.fill(0); // clear the photo bytes as soon as the job ends
    }
    send(result, "photo-draft");
  };

  const runLadder = async (raw: unknown) => {
    const t = performance.now();
    const job = LadderJob.safeParse(raw);
    const id = (raw as { id?: unknown }).id;
    if (!job.success) {
      if (typeof id === "string") send({ ...base(id, t), ok: false, error: "unusable_answer" }, "ladder-draft");
      return;
    }
    let result: HubResult;
    try {
      const steps = await ladderFromAsk(opts.ollama, job.data);
      result = steps
        ? { ...base(job.data.id, t), ok: true, ladder: steps }
        : { ...base(job.data.id, t), ok: false, error: "unusable_answer" };
    } catch {
      result = { ...base(job.data.id, t), ok: false, error: "model_unavailable" };
    }
    send(result, "ladder-draft");
  };

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
    ws.on("message", (data, isBinary) => {
      lastHeard = Date.now();
      if (!isBinary) {
        let raw: { type?: unknown; kind?: unknown };
        try {
          raw = JSON.parse(String(data));
        } catch {
          return;
        }
        if (raw?.type === "ping") {
          const p = Ping.safeParse(raw);
          if (p.success) ws?.send(JSON.stringify({ type: "pong", t: p.data.t }));
        } else if (raw?.type === "job" && raw.kind === "photo-draft") {
          const h = JobHeader.safeParse(raw);
          if (h.success) waitingFor = { id: h.data.id, bytes: h.data.bytes };
        } else if (raw?.type === "job" && raw.kind === "ladder-draft") {
          enqueue(() => runLadder(raw));
        }
        return;
      }
      if (!waitingFor) return;
      const job = waitingFor;
      waitingFor = null;
      const photo = data as Buffer;
      enqueue(() => runPhoto(job, photo));
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
