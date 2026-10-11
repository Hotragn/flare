// ICD-5 live view (PW4, ADR-0014, 07-offline-sync-and-ai.md A4). Server-Sent Events read
// with fetch (so every connect, not just the browser's own retries, carries Last-Event-ID),
// plus a 30 s poll while visible, a version guard, and a server-time offset smoothed over
// the last 5 views (BR-TIME-3, SRS-SOL-3, SRS-TIME-1). Phones never decide transitions.
import type { ClientIcd } from "@flare/shared/icd/index";
import type { FlareStore } from "../store/index.ts";

/** The fields of the Gathering schema the live module reads (asyncapi gatheringView). */
export type LiveView = {
  id: string;
  group_id?: string;
  state: "kindling" | "lit" | "ember" | "gone";
  need: number;
  version: number;
  server_time: string;
  ended?: "not_this_time" | "thanks_for_coming" | null;
};

export type LiveStatus = {
  /** false once the stream has been down 10 s and the last poll failed ("Offline. Saved at {time}."). */
  online: boolean;
  /** Server time of the last view we got, for "Saved at {time}". */
  savedAt: string | null;
};

export type LiveOptions = {
  store: FlareStore;
  base?: string;
  fetch?: typeof fetch;
  now?: () => number;
  pollMs?: number;
  offlineAfterMs?: number;
  /** Visibility source; defaults to globalThis.document. */
  document?: Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener">;
  /** Receives `online` events; defaults to globalThis. */
  events?: EventTarget;
  onGone?: (gatheringId: string, ended: string | null) => void;
  onStatus?: (gatheringId: string, s: LiveStatus) => void;
};

export const POLL_MS = 30_000;
export const OFFLINE_AFTER_MS = 10_000;
const OFFSET_SAMPLES = 5;
const RETRY_MS = [1000, 2000, 4000, 8000, 15000];

/** Mean of the last five offsets (A4). Exported for tests. */
export class OffsetTracker {
  private samples: number[] = [];
  add(serverTimeIso: string, localMs: number): number {
    const t = Date.parse(serverTimeIso);
    if (Number.isFinite(t)) {
      this.samples.push(t - localMs);
      if (this.samples.length > OFFSET_SAMPLES) this.samples.shift();
    }
    return this.value;
  }
  get value(): number {
    if (this.samples.length === 0) return 0;
    return Math.round(this.samples.reduce((a, b) => a + b, 0) / this.samples.length);
  }
}

type SseEvent = { id: string | null; event: string; data: string };

/** Incremental text/event-stream parser (WHATWG HTML 9.2.6, the parts the contract uses). */
export function sseParser(onEvent: (e: SseEvent) => void): (chunk: string) => void {
  let buf = "";
  let data: string[] = [];
  let event = "";
  let id: string | null = null;
  return (chunk) => {
    buf += chunk;
    const lines = buf.split(/\r\n|\r|\n/);
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (line === "") {
        if (data.length > 0) onEvent({ id, event: event || "message", data: data.join("\n") });
        data = [];
        event = "";
        continue;
      }
      if (line.startsWith(":")) continue;
      const i = line.indexOf(":");
      const field = i === -1 ? line : line.slice(0, i);
      const value = i === -1 ? "" : line.slice(i + 1).replace(/^ /, "");
      if (field === "data") data.push(value);
      else if (field === "event") event = value;
      else if (field === "id" && !value.includes("\0")) id = value;
    }
  };
}

export type FlareLive = ClientIcd.Live<LiveView> & {
  offset(gatheringId: string): number;
};

export function createLive(opts: LiveOptions): FlareLive {
  const { store, base = "" } = opts;
  const now = opts.now ?? Date.now;
  const doFetch = opts.fetch ?? ((input, init) => fetch(input, init));
  const pollMs = opts.pollMs ?? POLL_MS;
  const offlineAfterMs = opts.offlineAfterMs ?? OFFLINE_AFTER_MS;
  const offsets = new Map<string, OffsetTracker>();

  function follow(gatheringId: string, onView: (v: LiveView, offsetMs: number) => void): () => void {
    const doc = opts.document ?? (globalThis.document as LiveOptions["document"]);
    const events = opts.events ?? (globalThis as unknown as EventTarget);
    const tracker = offsets.get(gatheringId) ?? new OffsetTracker();
    offsets.set(gatheringId, tracker);
    let stopped = false;
    let gone = false;
    let delivered = 0;
    let stream: AbortController | null = null;
    let streamUp = false;
    let streamDownSince: number | null = now();
    let lastPollOk = true;
    let savedAt: string | null = null;
    let online = true;
    let retry = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let statusTimer: ReturnType<typeof setTimeout> | null = null;
    const viewUrl = `${base}/api/v1/gatherings/${gatheringId}`;

    const status = () => {
      const down = !streamUp && streamDownSince !== null && now() - streamDownSince >= offlineAfterMs;
      const next = !(down && !lastPollOk);
      if (next !== online) {
        online = next;
        opts.onStatus?.(gatheringId, { online, savedAt });
      }
    };
    const scheduleStatus = () => {
      if (statusTimer) clearTimeout(statusTimer);
      statusTimer = setTimeout(status, offlineAfterMs + 10);
    };

    async function handle(v: LiveView, localMs: number) {
      if (stopped || v.id !== gatheringId) return;
      const offset = tracker.add(v.server_time, localMs);
      savedAt = v.server_time;
      const fresh = await store.saveSeen(gatheringId, v.version, v.group_id ?? null);
      if (!fresh || v.version <= delivered) return; // version guard (A4)
      delivered = v.version;
      onView(v, offset);
      if (v.state === "gone") await end(v.ended ?? null);
    }

    async function end(ended: string | null) {
      if (gone) return;
      gone = true;
      await store.gone(gatheringId);
      stop();
      opts.onGone?.(gatheringId, ended);
    }

    async function poll() {
      if (stopped) return;
      const t0 = now();
      try {
        const res = await doFetch(viewUrl, { headers: { accept: "application/json" }, cache: "no-store" });
        if (res.status === 410) {
          lastPollOk = true;
          await end(null);
          return;
        }
        if (!res.ok) throw new Error(String(res.status));
        const v = (await res.json()) as LiveView;
        lastPollOk = true;
        await handle(v, (t0 + now()) / 2); // midpoint: half the round trip each way
      } catch {
        lastPollOk = false;
      }
      status();
    }

    async function connect() {
      if (stopped) return;
      stream = new AbortController();
      const headers: Record<string, string> = { accept: "text/event-stream" };
      const seen = await store.seenVersion(gatheringId);
      if (seen > 0) headers["Last-Event-ID"] = String(seen);
      try {
        const res = await doFetch(`${viewUrl}/events`, { headers, signal: stream.signal, cache: "no-store" });
        if (res.status === 410) return void (await end(null));
        if (!res.ok || !res.body) throw new Error(String(res.status));
        streamUp = true;
        streamDownSince = null;
        retry = 0;
        status();
        const decoder = new TextDecoder();
        const parse = sseParser((e) => {
          try {
            if (e.event === "gathering") void handle(JSON.parse(e.data) as LiveView, now());
            else if (e.event === "gone") void end((JSON.parse(e.data) as { ended?: string }).ended ?? null);
          } catch {
            // A malformed event is skipped; the next poll repairs the view.
          }
        });
        const reader = res.body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          parse(decoder.decode(value, { stream: true }));
        }
      } catch {
        // Network error or abort; fall through to the retry.
      }
      streamUp = false;
      streamDownSince ??= now();
      scheduleStatus();
      if (stopped || gone) return;
      const wait = RETRY_MS[Math.min(retry++, RETRY_MS.length - 1)] ?? 15000;
      retryTimer = setTimeout(() => void connect(), wait);
    }

    const reconnectNow = () => {
      if (stopped) return;
      if (!streamUp) {
        if (retryTimer) clearTimeout(retryTimer);
        retry = 0;
        void connect();
      }
      void poll();
    };
    const onVisible = () => {
      if (doc?.visibilityState === "visible") reconnectNow();
    };
    const pollTimer = setInterval(() => {
      if (!doc || doc.visibilityState === "visible") void poll();
    }, pollMs);
    doc?.addEventListener("visibilitychange", onVisible);
    events.addEventListener("online", reconnectNow);

    function stop() {
      if (stopped) return;
      stopped = true;
      stream?.abort();
      clearInterval(pollTimer);
      if (retryTimer) clearTimeout(retryTimer);
      if (statusTimer) clearTimeout(statusTimer);
      doc?.removeEventListener("visibilitychange", onVisible);
      events.removeEventListener("online", reconnectNow);
    }

    void poll().then(() => connect());
    scheduleStatus();
    return stop;
  }

  return { follow, offset: (id) => offsets.get(id)?.value ?? 0 };
}
