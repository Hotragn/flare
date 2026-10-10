// Privacy-safe logging (docs/architecture/08-security-privacy.md, BR-D-6).
// We log method, route template, status, latency and coarse events. We never log
// bodies, photos, names, places, coordinates, conditions, link fragments, tokens or IPs.
import pino from "pino";

export const log = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: undefined,
  redact: {
    paths: [
      "req.headers",
      "headers",
      "authorization",
      "body",
      "photo",
      "draft",
      "invite",
      "alt",
      "name",
      "spot",
      "lat",
      "lon",
      "ip",
      "token",
      "secret",
    ],
    censor: "[redacted]",
  },
  formatters: { level: (label) => ({ level: label }) },
});

/** Replace ids and codes in a path with a template so logs never hold gathering ids. */
export const routeTemplate = (p: string): string =>
  p
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id")
    .replace(/\/[A-Za-z0-9_-]{20,}/g, "/:id");
