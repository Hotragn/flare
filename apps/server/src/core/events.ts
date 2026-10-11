// In-process fan-out for live updates (asyncapi.yaml, channel gatheringEvents).
// One server instance (ADR-0004), so a Map of listeners is the whole bus.
export type LiveMessage =
  | { type: "gathering"; version: number; view: Record<string, unknown> }
  | { type: "gone"; id: string; ended: "not_this_time" | "thanks_for_coming" };

export type Listener = (m: LiveMessage) => void;

export class EventBus {
  private readonly subs = new Map<string, Set<Listener>>();

  subscribe(gatheringId: string, fn: Listener): () => void {
    let set = this.subs.get(gatheringId);
    if (!set) {
      set = new Set();
      this.subs.set(gatheringId, set);
    }
    set.add(fn);
    return () => {
      const s = this.subs.get(gatheringId);
      if (!s) return;
      s.delete(fn);
      if (s.size === 0) this.subs.delete(gatheringId);
    };
  }

  publish(gatheringId: string, m: LiveMessage): void {
    for (const fn of [...(this.subs.get(gatheringId) ?? [])]) {
      try {
        fn(m);
      } catch {
        // a broken stream must not stop the others
      }
    }
  }

  listeners(gatheringId?: string): number {
    if (gatheringId) return this.subs.get(gatheringId)?.size ?? 0;
    let n = 0;
    for (const s of this.subs.values()) n += s.size;
    return n;
  }
}
