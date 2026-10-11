// Sentry Agent Tracing for the AI path only (ADR-0021, supersedes the no-telemetry part of
// ADR-0020). Server side only: phones and the link page load no Sentry (SRS-PRIV-7).
//
// What leaves: span names, timings, and the attributes in ALLOWED below (tier, model, ok,
// error class, fallback). What never leaves: photos, invite or scene text, ask lines, names,
// places, coordinates, group, gathering or member ids, request URLs, headers, bodies, IPs.
// Enforced three ways: no default integrations (nothing auto-records HTTP), dataCollection
// for gen_ai inputs and outputs off, and an allow-list scrub on every span and event.
import * as Sentry from "@sentry/node";

/** Attribute keys that may leave the server. Everything else is dropped before sending. */
export const ALLOWED = new Set([
  "gen_ai.operation.name",
  "gen_ai.agent.name",
  "gen_ai.provider.name",
  "gen_ai.request.model",
  "gen_ai.response.model",
  "gen_ai.tool.name",
  "flare.job", // "photo" | "ladder"
  "flare.tier", // "hub" | "rules" | "cloud"
  "flare.ok", // boolean
  "flare.error", // error class name or contract error code, never a message
  "flare.fallback", // why the template ran: "hub_absent" | "timeout" | "invalid" | "hub_error"
  "flare.valid", // enforce() result
  "flare.repaired", // count of repaired fields, a number
  "sentry.op",
  "sentry.origin",
  "sentry.source",
  "sentry.sample_rate",
  "sentry.status",
]);

export const scrubAttributes = (data: Record<string, unknown> | undefined): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data ?? {})) {
    if (!ALLOWED.has(k)) continue;
    if (typeof v === "number" || typeof v === "boolean") out[k] = v;
    else if (typeof v === "string" && /^[A-Za-z0-9_.:-]{1,64}$/.test(v)) out[k] = v; // short tokens only
  }
  return out;
};

let enabled = false;
export const tracingEnabled = () => enabled;

type Options = Parameters<typeof Sentry.init>[0];

/** Starts Sentry when SENTRY_DSN is set. Tests pass a transport to capture envelopes. */
export function initTracing(env: NodeJS.ProcessEnv = process.env, extra: Partial<Options> = {}): boolean {
  const dsn = env.SENTRY_DSN;
  if (!dsn) return false;
  Sentry.init({
    dsn,
    environment: env.SENTRY_ENVIRONMENT ?? (env.RENDER ? "production" : "development"),
    release: env.RENDER_GIT_COMMIT?.slice(0, 12),
    sendDefaultPii: false,
    defaultIntegrations: false,
    integrations: [],
    tracesSampleRate: 1,
    serverName: "flare",
    dataCollection: { genAI: { inputs: false, outputs: false } },
    beforeSendSpan(span: { attributes?: Record<string, unknown>; data?: Record<string, unknown> }) {
      // Streamed spans (SDK 11) carry `attributes`; spans inside a transaction carry `data`.
      if (span.attributes) span.attributes = scrubAttributes(span.attributes);
      if (span.data) span.data = scrubAttributes(span.data);
      return span;
    },
    beforeSendTransaction(event) {
      return scrubEvent(event);
    },
    beforeSend(event) {
      return scrubEvent(event);
    },
    ...extra,
  } as Options);
  enabled = true;
  return true;
}

function scrubEvent<T extends Sentry.Event>(event: T): T {
  delete event.request;
  delete event.user;
  delete event.extra;
  delete event.breadcrumbs;
  delete event.server_name;
  event.tags = {};
  if (event.contexts) event.contexts = { trace: event.contexts.trace } as T["contexts"];
  const trace = event.contexts?.trace as { data?: Record<string, unknown> } | undefined;
  if (trace?.data) trace.data = scrubAttributes(trace.data);
  for (const s of event.spans ?? []) s.data = scrubAttributes(s.data as Record<string, unknown>) as typeof s.data;
  if (event.exception?.values)
    for (const v of event.exception.values) {
      v.value = undefined; // the message can hold data; the class (type) is enough
      if (v.stacktrace?.frames) for (const f of v.stacktrace.frames) f.vars = undefined;
    }
  return event;
}

type Attrs = Record<string, string | number | boolean>;
export type SpanHandle = { set(attrs: Attrs): void };
const noop: SpanHandle = { set() {} };

/** An AI job as a Sentry `invoke_agent` span. Runs fn directly when tracing is off. */
export function aiJob<T>(job: "photo" | "ladder", fn: (span: SpanHandle) => Promise<T>): Promise<T> {
  if (!enabled) return fn(noop);
  return Sentry.startSpan(
    {
      op: "gen_ai.invoke_agent",
      name: `invoke_agent flare-${job}`,
      forceTransaction: true,
      attributes: { "gen_ai.operation.name": "invoke_agent", "gen_ai.agent.name": `flare-${job}`, "flare.job": job },
    },
    (s) => fn({ set: (a) => s.setAttributes(a) }),
  );
}

/** The hub round trip as a `chat` span (relay to the Mac, Ollama, back). */
export function hubChat<T>(model: string, fn: (span: SpanHandle) => Promise<T>): Promise<T> {
  if (!enabled) return fn(noop);
  return Sentry.startSpan(
    {
      op: "gen_ai.chat",
      name: `chat ${model}`,
      attributes: { "gen_ai.operation.name": "chat", "gen_ai.provider.name": "ollama", "gen_ai.request.model": model },
    },
    (s) => fn({ set: (a) => s.setAttributes(a) }),
  );
}

/** enforce() and other guards as an `execute_tool` span. */
export function guardSpan<T>(tool: string, fn: (span: SpanHandle) => T): T {
  if (!enabled) return fn(noop);
  return Sentry.startSpan(
    {
      op: "gen_ai.execute_tool",
      name: `execute_tool ${tool}`,
      attributes: { "gen_ai.operation.name": "execute_tool", "gen_ai.tool.name": tool },
    },
    (s) => fn({ set: (a) => s.setAttributes(a) }),
  );
}

export const flushTracing = (ms = 2000) => (enabled ? Sentry.flush(ms) : Promise.resolve(true));
