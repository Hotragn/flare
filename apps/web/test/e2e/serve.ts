// Serves the built app (apps/web/build) with the in-memory API from test/fakes on one origin,
// so Chrome can run the real screens with the real PWA modules (crypto, IndexedDB store,
// outbox, live SSE) end to end. Test code only. Usage:
//   npm run build && node apps/web/test/e2e/serve.ts [port]   (default 8861, frontend range)
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { GatheringView } from "../../src/lib/screens/flow/api-types.ts";
import { fakeServer } from "../fakes/index.ts";

const BUILD = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../build");
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".m4a": "audio/mp4",
  ".wav": "audio/wav",
  ".webmanifest": "application/manifest+json",
};

export function startServer(
  port = 8861,
): Promise<{ url: string; api: ReturnType<typeof fakeServer>; close: () => void }> {
  const api = fakeServer(() => Date.now());
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const p = url.pathname;
    if (p.startsWith("/api/v1/")) {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      const raw = Buffer.concat(chunks);
      const type = req.headers["content-type"] ?? "";
      const events = p.match(/^\/api\/v1\/gatherings\/([^/]+)\/events$/);
      if (events && req.method === "GET") return sse(res, events[1] ?? "");
      let r: Response;
      if (p.startsWith("/api/v1/drafts")) r = await api.fetch(p, { method: req.method ?? "GET" });
      else {
        const body =
          raw.length === 0 ? undefined : type.includes("json") ? JSON.parse(raw.toString("utf8")) : new Uint8Array(raw);
        const who = api.auth({ authorization: String(req.headers.authorization ?? "") });
        r = await api.handle(req.method ?? "GET", p, body, who);
      }
      res.writeHead(r.status, Object.fromEntries(r.headers));
      res.end(Buffer.from(await r.arrayBuffer()));
      return;
    }
    let file = path.join(BUILD, p);
    if (p.endsWith("/")) file = path.join(file, "index.html");
    if (!file.startsWith(BUILD) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      file = /^\/(app|g)\//.test(p) ? path.join(BUILD, "200.html") : path.join(BUILD, "404.html");
      if (!fs.existsSync(file)) file = path.join(BUILD, "200.html");
    }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });

  function sse(res: http.ServerResponse, id: string) {
    const g = api.gatherings.get(id);
    if (!g) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store" });
    const send = (v: GatheringView) => {
      if (v.state === "gone") {
        res.write(`event: gone\ndata: ${JSON.stringify({ ended: v.ended })}\n\n`);
        res.end();
        return;
      }
      res.write(`event: gathering\nid: ${v.version}\ndata: ${JSON.stringify(v)}\n\n`);
    };
    void api
      .handle("GET", `/api/v1/gatherings/${id}`, undefined, null)
      .then(async (r) => send((await r.json()) as GatheringView));
    const off = api.subscribe(id, send);
    res.on("close", off);
  }

  return new Promise((resolve) =>
    server.listen(port, "127.0.0.1", () =>
      resolve({ url: `http://127.0.0.1:${port}`, api, close: () => server.close() }),
    ),
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const s = await startServer(Number(process.argv[2] ?? 8861));
  console.info(`serving ${BUILD} with the fake API at ${s.url}`);
}
