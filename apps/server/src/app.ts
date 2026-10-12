// HTTP app (docs/architecture/contracts/openapi.yaml). Every route in the contract except the
// Telegram ones and the /g/{id} preview, which INT mounts through `deps.mounts`.
// Composition: docs/backend/01-service-design.md.
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { type Context, Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { type Deps as BaseDeps, type Ctx, systemClock } from "./core/deps.ts";
import { EventBus } from "./core/events.ts";
import { ApiError } from "./http/errors.ts";
import { RateLimiter } from "./http/middleware.ts";
import { log, routeTemplate } from "./log.ts";
import { mountAi } from "./routes/ai.ts";
import { mountGatherings } from "./routes/gatherings.ts";
import { mountGroups } from "./routes/groups.ts";
import { mountPlaces } from "./routes/places.ts";
import { mountRemember } from "./routes/remember.ts";
import { mountSystem } from "./routes/system.ts";
import { mountVoice } from "./routes/voice.ts";
import { captureServerError, routeSpan } from "./tracing.ts";

/** INT's mountTelegram / mountPreview have this shape (url-map.md). */
export type Mount = (app: Hono, ctx: Ctx) => void;
export type Deps = BaseDeps & { mounts?: Mount[]; rateLimiter?: RateLimiter };

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
  ".mp3": "audio/mpeg", // warm-voice clips (ADR-0027)
  ".txt": "text/plain",
};

/** Resolves optional deps into the context every route and INT module gets. */
export function buildCtx(d: BaseDeps): Ctx {
  return {
    relay: d.relay,
    db: d.db,
    engine: d.engine ?? null,
    events: d.events ?? new EventBus(),
    clock: d.clock ?? systemClock,
    config: {
      version: d.version,
      publicBaseUrl: d.config?.publicBaseUrl ?? "http://localhost:8787",
      vapidPublicKey: d.config?.vapidPublicKey ?? null,
      telegramBotUsername: d.config?.telegramBotUsername ?? null,
    },
    effects: d.effects ?? {},
    ladderTimeoutMs: d.ladderTimeoutMs ?? 8000,
    ladderAgent: d.ladderAgent ?? false,
    cloud: d.cloud ?? null,
    voice: d.voice ?? null,
    rememberThis: d.rememberThis ?? false,
  };
}

/** SPA routes served from 200.html (url-map.md). */
export const isSpaPath = (p: string) => p === "/app" || p.startsWith("/app/") || p.startsWith("/g/");

export function createApp(deps: Deps, ctx: Ctx = buildCtx(deps)): Hono {
  const { webBuildDir } = deps;
  const app = new Hono();
  const rl = deps.rateLimiter ?? new RateLimiter(() => ctx.clock.now().getTime());

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
    await routeSpan(c.req.method, c.req.path, next, () => c.res.status); // sampled; method and area only
    log.info(
      { m: c.req.method, r: routeTemplate(c.req.path), s: c.res.status, ms: Math.round(performance.now() - t) },
      "req",
    );
  });

  app.onError((err, c) => {
    if (err instanceof ApiError) {
      for (const [k, v] of Object.entries(err.headers)) c.header(k, v);
      return c.json({ ...err.extra, code: err.code, message: err.message }, err.status);
    }
    // Never log the error text: it can hold SQL parameters. The class name is enough to grep.
    log.error({ event: "error", r: routeTemplate(c.req.path), kind: err.name }, "unhandled error");
    captureServerError(err, c.req.method, c.req.path); // the class and route token only
    return c.json({ code: "bad_request", message: "Something went wrong" }, 500);
  });
  app.notFound((c) =>
    c.req.path.startsWith("/api/")
      ? c.json({ code: "not_found", message: "No such route" }, 404)
      : c.text("Not found", 404),
  );

  mountSystem(app, ctx, rl);
  mountGroups(app, ctx, rl);
  mountGatherings(app, ctx, rl);
  mountPlaces(app, ctx, rl);
  mountAi(app, ctx, rl);
  mountVoice(app, ctx, rl);
  mountRemember(app, ctx, rl);
  for (const m of deps.mounts ?? []) m(app, ctx);

  if (webBuildDir && fs.existsSync(webBuildDir)) {
    const root = path.resolve(webBuildDir);
    app.get("*", (c) => {
      const rel = decodeURIComponent(new URL(c.req.url).pathname);
      let file = path.resolve(root, `.${rel}`);
      if (file !== root && !file.startsWith(root + path.sep)) return c.notFound();
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
      let status: 200 | 404 = 200;
      if (!fs.existsSync(file) && isSpaPath(rel) && fs.existsSync(path.join(root, "200.html")))
        file = path.join(root, "200.html"); // SPA shell for /app/* and /g/* (url-map.md)
      else if (!fs.existsSync(file)) {
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
    // /sim/ map tiles (OSM raster, Simulation page only); weather for Plans and Home.
    "connect-src 'self' https://api.weather.gov https://tile.openstreetmap.org",
    "media-src 'self' blob:", // ADR-0027: warm-voice clips play from this phone's cache as blob: URLs
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
