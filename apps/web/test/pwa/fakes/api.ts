// Fake Flare API for PWA tests (ICD-2 idempotency, ICD-4 SSE). Test code only.
// Writes: the first response per `{auth}:{Idempotency-Key}` is kept and replayed with
// `Idempotent-Replay: true` (SRS-REL-2). `effects` counts writes that changed something.
// Faults: "drop" processes the write and then cuts the socket (lost response), "error" answers 503.
import http from "node:http";

export type Fault = "none" | "drop" | "error";

export type View = {
  id: string;
  group_id: string;
  state: string;
  need: number;
  version: number;
  server_time: string;
} & Record<string, unknown>;

export type FakeApi = {
  url: string;
  port: number;
  effects: { method: string; path: string; body: unknown; idem: string }[];
  replays: number;
  faults: Fault[];
  /** Applied to every request (ms). */
  delayMs: number;
  /** Server clock skew against the test's clock (ms). */
  skewMs: number;
  setView(v: View): void;
  /** Emits a view to every open SSE stream (and stores it). */
  push(v: View): void;
  gone(id: string, ended: "not_this_time" | "thanks_for_coming"): void;
  /** Closes all open SSE streams without a `gone` event (a dropped connection). */
  cutStreams(): void;
  sseConnects: { lastEventId: string | null }[];
  gets: number;
  close(): Promise<void>;
};

export async function startFakeApi(
  port = 0,
  extra?: (req: http.IncomingMessage, res: http.ServerResponse) => boolean,
): Promise<FakeApi> {
  const firstResponses = new Map<string, { status: number; body: string }>();
  const views = new Map<string, View>();
  const streams = new Set<{ id: string; res: http.ServerResponse }>();

  const api: FakeApi = {
    url: "",
    port: 0,
    effects: [],
    replays: 0,
    faults: [],
    delayMs: 0,
    skewMs: 0,
    sseConnects: [],
    gets: 0,
    setView(v) {
      views.set(v.id, v);
    },
    push(v) {
      views.set(v.id, v);
      for (const s of streams)
        if (s.id === v.id) s.res.write(`id: ${v.version}\nevent: gathering\ndata: ${JSON.stringify(v)}\n\n`);
    },
    gone(id, ended) {
      for (const s of [...streams]) {
        if (s.id !== id) continue;
        s.res.write(`event: gone\ndata: ${JSON.stringify({ id, ended })}\n\n`);
        s.res.end();
        streams.delete(s);
      }
    },
    cutStreams() {
      for (const s of streams) s.res.destroy();
      streams.clear();
    },
    close: () =>
      new Promise((resolve) => {
        api.cutStreams();
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };

  const now = () => new Date(Date.now() + api.skewMs).toISOString();

  const server = http.createServer((req, res) => {
    if (extra?.(req, res)) return;
    const url = new URL(req.url ?? "/", "http://x");
    let raw = "";
    req.on("data", (c) => {
      raw += c;
    });
    req.on("end", () => {
      setTimeout(() => handle(req, res, url, raw), api.delayMs);
    });
  });

  function handle(req: http.IncomingMessage, res: http.ServerResponse, url: URL, raw: string) {
    const ev = /^\/api\/v1\/gatherings\/([^/]+)\/events$/.exec(url.pathname);
    if (req.method === "GET" && ev?.[1]) {
      const id = ev[1];
      const lastEventId = (req.headers["last-event-id"] as string | undefined) ?? null;
      api.sseConnects.push({ lastEventId });
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store" });
      res.write(": hello\n\n");
      const v = views.get(id);
      if (v && String(v.version) !== lastEventId) {
        const sv = { ...v, server_time: now() };
        res.write(`id: ${v.version}\nevent: gathering\ndata: ${JSON.stringify(sv)}\n\n`);
      }
      const entry = { id, res };
      streams.add(entry);
      req.on("close", () => streams.delete(entry));
      return;
    }
    const g = /^\/api\/v1\/gatherings\/([^/]+)$/.exec(url.pathname);
    if (req.method === "GET" && g?.[1]) {
      api.gets++;
      const v = views.get(g[1]);
      if (!v) return json(res, 404, { code: "not_found", message: "no" });
      return json(res, 200, { ...v, server_time: now() });
    }
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method ?? "")) {
      const idem = req.headers["idempotency-key"];
      if (typeof idem !== "string" || !/^[A-Za-z0-9_-]{16,64}$/.test(idem)) {
        return json(res, 400, { code: "bad_request", message: "idempotency key" });
      }
      const fault = api.faults.shift() ?? "none";
      if (fault === "error") return json(res, 503, { code: "not_configured", message: "down" });
      const k = `${req.headers.authorization ?? ""}:${idem}`;
      const first = firstResponses.get(k);
      if (first) {
        api.replays++;
        res.writeHead(first.status, { "content-type": "application/json", "idempotent-replay": "true" });
        res.end(first.body);
        if (fault === "drop") res.destroy();
        return;
      }
      if (url.pathname.endsWith("/reject")) {
        const body = JSON.stringify({ code: "already_lit", message: "lit" });
        firstResponses.set(k, { status: 409, body });
        return fault === "drop" ? res.destroy() : json(res, 409, JSON.parse(body));
      }
      const body = raw ? JSON.parse(raw) : undefined;
      api.effects.push({ method: req.method ?? "", path: url.pathname, body, idem });
      const out = JSON.stringify({ ok: true, n: api.effects.length });
      firstResponses.set(k, { status: 200, body: out });
      if (fault === "drop") return res.destroy();
      return json(res, 200, JSON.parse(out));
    }
    json(res, 404, { code: "not_found", message: "no route" });
  }

  function json(res: http.ServerResponse, status: number, body: unknown) {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  }

  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", () => resolve()));
  const addr = server.address();
  api.port = typeof addr === "object" && addr ? addr.port : port;
  api.url = `http://127.0.0.1:${api.port}`;
  return api;
}
