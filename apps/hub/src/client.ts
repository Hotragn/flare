// Hub side of the relay (ADR-0006, contracts/asyncapi.yaml). Opens one outbound
// WebSocket to the server, answers pings, runs one job at a time (photo, ladder or tags), reconnects
// with exponential backoff. Imports no filesystem module: photos never touch disk.
import { HUB_PROTOCOL, type JobResultT, type LadderJobT, ToHubV11 } from "@flare/shared";
import WebSocket from "ws";
import { draftFromPhoto, isModelReady, ladderFromAsk, type OllamaConfig, tagsFromPhoto } from "./ollama.ts";

export type HubOptions = {
  serverUrl: string;
  secret: string;
  ollama: OllamaConfig;
  onLog?: (e: Record<string, unknown>) => void;
  /** Drop the socket if the server sends nothing (not even a ping) for this long. Default 15 s (3 missed pings). */
  silenceMs?: number;
  /** Per-job budget, matching the server's wait (asyncapi: 6 s photo, 8 s ladder, 8 s tags). */
  budgetMs?: { photo?: number; ladder?: number; tags?: number };
};

/** asyncapi `result` (shared JobResult, ICR-BE-1): draft for photo jobs, ladder for ladder jobs. */
export type HubResult = JobResultT;

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
  let waitingFor: { id: string; bytes: number; kind: "photo-draft" | "tags-draft" } | null = null;
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

  // The server stops waiting after 6 s (photo) or 8 s (ladder) and answers with the template
  // (BR-AI-1). Past that, the hub's answer is useless and only delays the next job behind it,
  // so each job gets the rest of its budget, counted from when it arrived, and is dropped at 0.
  const budget = {
    photo: opts.budgetMs?.photo ?? 6000,
    ladder: opts.budgetMs?.ladder ?? 8000,
    tags: opts.budgetMs?.tags ?? 8000,
  };
  // Whole milliseconds: AbortSignal.timeout() rejects fractions.
  const remaining = (arrived: number, kind: "photo" | "ladder" | "tags") =>
    Math.floor(budget[kind] - (performance.now() - arrived));
  const isTimeout = (e: unknown) => ["TimeoutError", "AbortError"].includes((e as { name?: string }).name ?? "");

  // Photo jobs (invite words, or OSM tags for Fix the map): same frames, different prompt.
  const runPhoto = async (job: NonNullable<typeof waitingFor>, photo: Buffer, arrived: number) => {
    const t = performance.now();
    const tags = job.kind === "tags-draft";
    let result: HubResult;
    try {
      if (photo.length !== job.bytes || photo[0] !== 0xff || photo[1] !== 0xd8)
        throw Object.assign(new Error("bad image"), { code: "bad_image" });
      const left = remaining(arrived, tags ? "tags" : "photo");
      if (left <= 0) throw Object.assign(new Error("stale"), { name: "TimeoutError" });
      if (tags) {
        const d = await tagsFromPhoto(opts.ollama, photo, AbortSignal.timeout(left));
        result = d
          ? { ...base(job.id, t), ok: true, tags: d }
          : { ...base(job.id, t), ok: false, error: "unusable_answer" };
      } else {
        const d = await draftFromPhoto(opts.ollama, photo, AbortSignal.timeout(left));
        result = d
          ? { ...base(job.id, t), ok: true, draft: { invite: d.invite, alt: d.alt } }
          : { ...base(job.id, t), ok: false, error: "unusable_answer" };
      }
    } catch (e) {
      const code =
        (e as { code?: string }).code === "bad_image" ? "bad_image" : isTimeout(e) ? "timeout" : "model_unavailable";
      result = { ...base(job.id, t), ok: false, error: code };
    } finally {
      photo.fill(0); // clear the photo bytes as soon as the job ends
    }
    send(result, job.kind);
  };

  const runLadder = async (job: LadderJobT, arrived: number) => {
    const t = performance.now();
    let result: HubResult;
    try {
      const left = remaining(arrived, "ladder");
      if (left <= 0) throw Object.assign(new Error("stale"), { name: "TimeoutError" });
      const steps = await ladderFromAsk(opts.ollama, job, AbortSignal.timeout(left));
      result = steps
        ? { ...base(job.id, t), ok: true, ladder: steps }
        : { ...base(job.id, t), ok: false, error: "unusable_answer" };
    } catch (e) {
      result = { ...base(job.id, t), ok: false, error: isTimeout(e) ? "timeout" : "model_unavailable" };
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
        let raw: { type?: unknown; kind?: unknown; id?: unknown };
        try {
          raw = JSON.parse(String(data));
        } catch {
          return;
        }
        const m = ToHubV11.safeParse(raw); // ICR-BE-1, ICR-ML5: photo, ladder and tags jobs, pings
        if (!m.success) {
          // A ladder job we can't read still gets an answer, so the server needn't wait 8 s.
          if (raw?.kind === "ladder-draft" && typeof raw.id === "string")
            send({ ...base(raw.id, performance.now()), ok: false, error: "unusable_answer" }, "ladder-draft");
          return;
        }
        const msg = m.data;
        if (msg.type === "ping") ws?.send(JSON.stringify({ type: "pong", t: msg.t }));
        else if (msg.kind === "photo-draft" || msg.kind === "tags-draft")
          waitingFor = { id: msg.id, bytes: msg.bytes, kind: msg.kind };
        else {
          const arrived = performance.now();
          enqueue(() => runLadder(msg, arrived));
        }
        return;
      }
      if (!waitingFor) return;
      const job = waitingFor;
      waitingFor = null;
      const photo = data as Buffer;
      const arrived = performance.now();
      enqueue(() => runPhoto(job, photo, arrived));
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
