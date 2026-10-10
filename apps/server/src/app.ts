// HTTP app (docs/architecture/contracts/openapi.yaml). This scaffold implements the
// endpoints the end-to-end hello world needs: health and photo drafts. The rest of the
// contract is built by engineering against the same spec.
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
import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
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
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".txt": "text/plain",
};

export function createApp({ relay, db, version, webBuildDir }: Deps): Hono {
  const app = new Hono();

  app.use(
    secureHeaders({
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],
        mediaSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
      },
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
    if (c.req.header("content-type") !== "image/jpeg") return c.json({ error: "unsupported_media_type" }, 415);
    const buf = Buffer.from(await c.req.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_PHOTO_BYTES) return c.json({ error: "payload_size" }, 413);
    if (buf[0] !== 0xff || buf[1] !== 0xd8) return c.json({ error: "not_jpeg" }, 400);
    const t = performance.now();
    const r = await relay.draft(buf);
    buf.fill(0); // drop the photo bytes now; nothing is stored (ADR-0011)
    const guarded = r?.ok && r.draft ? enforce(JSON.stringify(r.draft)) : null;
    const body: DraftResponseT = guarded
      ? { invite: guarded.invite, alt: guarded.alt, tier: "hub", ms: Math.round(performance.now() - t) }
      : { invite: TEMPLATE_INVITE, alt: "", tier: "rules", ms: Math.round(performance.now() - t) };
    return c.json(DraftResponse.parse(body));
  });

  if (webBuildDir && fs.existsSync(webBuildDir)) {
    const root = path.resolve(webBuildDir);
    app.get("*", (c) => {
      const rel = decodeURIComponent(new URL(c.req.url).pathname);
      let file = path.resolve(root, `.${rel}`);
      if (!file.startsWith(root)) return c.notFound();
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
      if (!fs.existsSync(file)) file = path.join(root, "404.html");
      if (!fs.existsSync(file)) return c.notFound();
      const type = TYPES[path.extname(file)] ?? "application/octet-stream";
      const immutable = rel.includes("/_app/immutable/");
      return c.body(fs.readFileSync(file), 200, {
        "content-type": type,
        "cache-control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
      });
    });
  }
  return app;
}
