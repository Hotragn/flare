// ICD-5 outbox (PW3, ADR-0010, 07-offline-sync-and-ai.md A3). Every write is stored in
// IndexedDB before it is sent, then sent in creation order, one at a time, with its
// Idempotency-Key, so a retry after a lost response changes nothing on the server
// (SRS-OFF-3, SRS-REL-2). Safari has no Background Sync: a closed app sends on next open.
import type { ClientIcd } from "@flare/shared/icd/index";
import { toBase64url } from "../crypto/index.ts";
import { DAY_MS, type FlareStore, type OutboxRecord } from "../store/index.ts";

type OutboxItem = ClientIcd.OutboxItem;
export type NewItem = Omit<OutboxItem, "idemKey" | "recorded_at" | "attempts">;

/** The server said no (4xx). The item is gone; show the copy deck string for `code`. */
export class OutboxRejected extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string) {
    super(`rejected ${status} ${code}`);
    this.name = "OutboxRejected";
    this.status = status;
    this.code = code;
  }
}

export type OutboxOptions = {
  store: FlareStore;
  fetch?: typeof fetch;
  /** Prefix for paths, "" in the app (same origin). */
  base?: string;
  now?: () => number;
  /** Called once per flush that dropped items older than 24 h ("Some taps didn't send."). */
  onDropped?: (count: number) => void;
  /** Called for every 4xx, including items whose sender is no longer waiting. */
  onRejected?: (item: OutboxItem, error: OutboxRejected) => void;
  /** Called with the response of every accepted item (tickets, for example). */
  onSent?: (item: OutboxItem, data: unknown) => void;
};

export type FlareOutbox = ClientIcd.Outbox & {
  /** Starts the A3 triggers: online, pageshow, visible, and every 15 s while visible. */
  start(target?: EventTarget & { document?: Document }): () => void;
};

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const GROUP_PATH = new RegExp(`^/api/v1/groups/(${UUID})(/|$)`, "i");
const GATHERING_PATH = new RegExp(`^/api/v1/gatherings/(${UUID})(/|$)`, "i");
export const FLUSH_EVERY_MS = 15_000;

/** 408 and 429 mean "later", not "no": keep them like a 5xx. */
const retryable = (status: number) => status >= 500 || status === 408 || status === 429;

export function newIdemKey(): string {
  return toBase64url(crypto.getRandomValues(new Uint8Array(16)));
}

let lastSeq = 0;
function nextSeq(now: number): number {
  lastSeq = Math.max(lastSeq + 1, now * 1000);
  return lastSeq;
}

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export function createOutbox(opts: OutboxOptions): FlareOutbox {
  const { store, base = "", now = Date.now } = opts;
  const doFetch = opts.fetch ?? ((input, init) => fetch(input, init));
  const waiting = new Map<string, { resolve: (v: unknown) => void; reject: (e: unknown) => void }>();
  let running: Promise<{ sent: number; dropped: number; left: number }> | null = null;

  async function authFor(path: string): Promise<{ auth: string | null; groupId: string | null }> {
    const g = GROUP_PATH.exec(path);
    const group = g?.[1] ? await store.group(g[1]) : null;
    const m = GATHERING_PATH.exec(path);
    const viaGathering = !group && m?.[1] ? await store.groupOf(m[1]) : null;
    const rec = group ?? viaGathering;
    return rec
      ? { auth: `Bearer ${rec.memberId}.${rec.token}`, groupId: rec.groupId }
      : { auth: null, groupId: g?.[1] ?? null };
  }

  /** Sends one item. "kept" means try again later; stop the flush so order holds. */
  async function sendOne(r: OutboxRecord): Promise<"done" | "kept"> {
    const headers: Record<string, string> = { "Idempotency-Key": r.idemKey };
    if (r.auth) headers.Authorization = r.auth;
    if (r.body !== undefined) headers["Content-Type"] = "application/json";
    let res: Response;
    try {
      res = await doFetch(base + r.path, {
        method: r.method,
        headers,
        body: r.body === undefined ? null : JSON.stringify(r.body),
        credentials: "omit",
      });
    } catch {
      await store.outboxPut({ ...r, attempts: r.attempts + 1 });
      return "kept";
    }
    if (retryable(res.status)) {
      await res.body?.cancel().catch(() => undefined);
      await store.outboxPut({ ...r, attempts: r.attempts + 1 });
      return "kept";
    }
    const data = await readBody(res);
    await store.outboxDelete(r.idemKey);
    const item = publicItem(r);
    const w = waiting.get(r.idemKey);
    waiting.delete(r.idemKey);
    if (res.ok) {
      opts.onSent?.(item, data);
      w?.resolve(data);
    } else {
      const code =
        typeof (data as { code?: unknown }).code === "string" ? (data as { code: string }).code : "bad_request";
      const err = new OutboxRejected(res.status, code);
      opts.onRejected?.(item, err);
      w?.reject(err);
    }
    return "done";
  }

  async function flushOnce(): Promise<{ sent: number; dropped: number; left: number }> {
    let sent = 0;
    let dropped = 0;
    const items = await store.outboxAll();
    let i = 0;
    for (; i < items.length; i++) {
      const r = items[i] as OutboxRecord;
      if (now() - Date.parse(r.recorded_at) > DAY_MS) {
        await store.outboxDelete(r.idemKey);
        waiting.get(r.idemKey)?.resolve(null);
        waiting.delete(r.idemKey);
        dropped++;
        continue;
      }
      if ((await sendOne(r)) === "kept") break;
      sent++;
    }
    if (dropped > 0) opts.onDropped?.(dropped);
    return { sent, dropped, left: items.length - i };
  }

  function flush(): Promise<{ sent: number; dropped: number; left: number }> {
    if (running) return running.catch(() => undefined).then(() => flush());
    const locks = (globalThis.navigator as Navigator | undefined)?.locks;
    const work = locks ? locks.request("flare-outbox", () => flushOnce()) : flushOnce();
    running = work.finally(() => {
      running = null;
    });
    return running;
  }

  async function send<T>(input: NewItem): Promise<T | null> {
    const t = now();
    const { auth, groupId } = await authFor(input.path);
    const r: OutboxRecord = {
      idemKey: newIdemKey(),
      method: input.method,
      path: input.path,
      body: input.body,
      recorded_at: new Date(t).toISOString(),
      attempts: 0,
      seq: nextSeq(t),
      auth,
      groupId,
    };
    await store.outboxPut(r); // stored before any request (A3 step 1)
    const result = new Promise<unknown>((resolve, reject) => waiting.set(r.idemKey, { resolve, reject }));
    await flush();
    if (!waiting.has(r.idemKey)) return (await result) as T | null;
    // Still queued: a later flush may settle it, but this caller gets null now.
    waiting.delete(r.idemKey);
    void result.catch(() => undefined);
    return null;
  }

  function start(target: EventTarget & { document?: Document } = globalThis as unknown as EventTarget): () => void {
    const doc = target.document ?? (globalThis.document as Document | undefined);
    const kick = () => {
      void flush().catch(() => undefined);
    };
    const onVisible = () => {
      if (!doc || doc.visibilityState === "visible") kick();
    };
    target.addEventListener("online", kick);
    target.addEventListener("pageshow", kick);
    doc?.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(onVisible, FLUSH_EVERY_MS);
    kick();
    return () => {
      target.removeEventListener("online", kick);
      target.removeEventListener("pageshow", kick);
      doc?.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }

  return { send, flush, size: async () => (await store.outboxAll()).length, start };
}

function publicItem(r: OutboxRecord): OutboxItem {
  return {
    idemKey: r.idemKey,
    method: r.method,
    path: r.path,
    body: r.body,
    recorded_at: r.recorded_at,
    attempts: r.attempts,
  };
}
