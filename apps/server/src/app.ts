// HTTP app (docs/architecture/contracts/openapi.yaml). This scaffold implements the
// endpoints the end-to-end hello world needs: health and photo drafts. The rest of the
// contract is built by engineering against the same spec.
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  DraftResponse,
  type DraftResponseT,
  enforce,
  type HealthT,
  MAX_PHOTO_BYTES,
  TEMPLATE_INVITE,
} from "@flare/shared";
import { type Context, Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { Db } from "./db/db.ts";
import type { HubRelay } from "./hub/relay.ts";
import { log, routeTemplate } from "./log.ts";

export type Deps = { relay: HubRelay; db: Db | null; version: string; webBuildDir?: string };

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".txt": "text/plain",
};

export function createApp({ relay, db, version, webBuildDir }: Deps): Hono {
  const app = new Hono();

  app.use(
    secureHeaders({
      referrerPolicy: "no-referrer",
      permissionsPolicy: {
        camera: ["self"],
        geolocation: ["self"],
        microphone: ["self"],
        accelerometer: ["self"],
        gyroscope: ["self"],
        magnetometer: ["self"],
      },
    }),
  );
  // CSP (SRS-SEC-6): no inline script except SvelteKit's bootstrap, allowed by its hash.
  // HTML responses set their own policy with the hashes; everything else gets the base one.
  app.use("*", async (c, next) => {
    await next();
    if (!c.res.headers.has("content-security-policy")) c.res.headers.set("content-security-policy", csp([]));
  });

  app.use("*", async (c, next) => {
    const t = performance.now();
    await next();
    log.info(
      { m: c.req.method, r: routeTemplate(c.req.path), s: c.res.status, ms: Math.round(performance.now() - t) },
      "req",
    );
  });

  app.get("/api/v1/health", async (c) => {
    let dbState: HealthT["db"] = "not_configured";
    if (db)
      dbState = await db.query("select 1").then(
        () => "ok" as const,
        () => "down" as const,
      );
    const body: HealthT = { ok: true, version, hub: relay.status, db: dbState };
    return c.json(body);
  });

  app.post("/api/v1/drafts", async (c) => {
    if (c.req.header("content-type") !== "image/jpeg") return apiError(c, 415, "not_jpeg", "Send image/jpeg");
    const buf = Buffer.from(await c.req.arrayBuffer());
    try {
      if (buf.length === 0 || buf.length > MAX_PHOTO_BYTES) return apiError(c, 413, "too_large", "1.5 MB at most");
      if (buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) return apiError(c, 400, "not_jpeg", "Not a JPEG");
      const t = performance.now();
      const r = await relay.draft(buf);
      const guarded = r?.ok && r.draft ? enforce(JSON.stringify(r.draft)) : null;
      const body: DraftResponseT = guarded
        ? { invite: guarded.invite, alt: guarded.alt, tier: "hub", ms: Math.round(performance.now() - t) }
        : { invite: TEMPLATE_INVITE, alt: "", tier: "rules", ms: Math.round(performance.now() - t) };
      return c.json(DraftResponse.parse(body));
    } finally {
      buf.fill(0); // drop the photo bytes on every path; nothing is stored (ADR-0011)
    }
  });

  if (webBuildDir && fs.existsSync(webBuildDir)) {
    const root = path.resolve(webBuildDir);
    app.get("*", (c) => {
      const rel = decodeURIComponent(new URL(c.req.url).pathname);
      let file = path.resolve(root, `.${rel}`);
      if (file !== root && !file.startsWith(root + path.sep)) return c.notFound();
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
      let status: 200 | 404 = 200;
      if (!fs.existsSync(file)) {
        file = path.join(root, "404.html");
        status = 404;
      }
      if (!fs.existsSync(file)) return c.notFound();
      const ext = path.extname(file);
      const type = TYPES[ext] ?? "application/octet-stream";
      const immutable = rel.includes("/_app/immutable/");
      const data = fs.readFileSync(file);
      const headers: Record<string, string> = {
        "content-type": type,
        "cache-control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
      };
      if (ext === ".html") headers["content-security-policy"] = csp(inlineScriptHashes(data.toString("utf8")));
      return c.body(data, status, headers);
    });
  }
  return app;
}

/** Error body per the contract (openapi.yaml, schema Error). Never echoes the input. */
export function apiError(c: Context, status: ContentfulStatusCode, code: string, message: string) {
  return c.json({ code, message }, status);
}

/** The Content-Security-Policy, with the sha256 hashes of allowed inline scripts. */
export function csp(scriptHashes: string[]): string {
  return [
    "default-src 'self'",
    `script-src 'self'${scriptHashes.map((h) => ` '${h}'`).join("")}`,
    // Svelte sets inline style attributes (style:--tilt); styles cannot run code.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    // api.weather.gov: the host's phone asks for the Plan forecast near it (ADR-0007).
    "connect-src 'self' https://api.weather.gov",
    "media-src 'self'",
    "font-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

const hashCache = new Map<string, string[]>();
/** sha256 hashes of every inline <script> (no src) in an HTML document, cached by content. */
export function inlineScriptHashes(html: string): string[] {
  const key = createHash("sha256").update(html).digest("base64");
  const hit = hashCache.get(key);
  if (hit) return hit;
  const out: string[] = [];
  for (const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
    out.push(
      `sha256-${createHash("sha256")
        .update(m[1] ?? "")
        .digest("base64")}`,
    );
  }
  hashCache.set(key, out);
  return out;
}
