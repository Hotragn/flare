// Tiny static server for apps/web/build, used by the axe pass and Lighthouse. Serves
// prerendered pages, then the SPA fallback (200.html or 404.html) for app routes, like the
// real server does (url-map.md). Gzip on text, long cache on immutable assets.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

export const BUILD = fileURLToPath(new URL("../../build/", import.meta.url));

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
  ".webmanifest": "application/manifest+json",
  ".m4a": "audio/mp4",
};

function resolve(urlPath: string): string | null {
  const clean = decodeURIComponent(urlPath.split("?")[0]);
  const abs = path.join(BUILD, clean);
  if (!abs.startsWith(BUILD)) return null;
  for (const c of [abs, path.join(abs, "index.html"), `${abs}.html`]) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
}

export type Served = { url: string; close: () => Promise<void> };

/** `api` answers /api/v1/* so pages that call the server can be tested without one. */
export function serve(port: number, api?: (p: string) => { status: number; body: unknown } | null): Promise<Served> {
  const fallback = ["200.html", "404.html"].map((f) => path.join(BUILD, f)).find((f) => fs.existsSync(f));
  const server = http.createServer((req, res) => {
    const p = req.url ?? "/";
    if (p.startsWith("/api/")) {
      const out = api?.(p) ?? { status: 503, body: { code: "unavailable" } };
      res.writeHead(out.status, { "content-type": "application/json" });
      res.end(JSON.stringify(out.body));
      return;
    }
    const file = resolve(p) ?? fallback;
    if (!file) {
      res.writeHead(404);
      res.end();
      return;
    }
    const ext = path.extname(file);
    const headers: Record<string, string> = { "content-type": TYPES[ext] ?? "application/octet-stream" };
    headers["cache-control"] = p.includes("/_app/immutable/") ? "public, max-age=31536000, immutable" : "no-cache";
    let body = fs.readFileSync(file);
    if (
      /text|javascript|json|svg|xml/.test(headers["content-type"]) &&
      /gzip/.test(req.headers["accept-encoding"] ?? "")
    ) {
      body = zlib.gzipSync(body);
      headers["content-encoding"] = "gzip";
    }
    res.writeHead(200, headers);
    res.end(body);
  });
  return new Promise((ok) =>
    server.listen(port, "127.0.0.1", () =>
      ok({ url: `http://127.0.0.1:${port}`, close: () => new Promise<void>((done) => server.close(() => done())) }),
    ),
  );
}
