// Try-it demo (docs/engineering/07-sunday-backlog.md #4): a judge alone plays a Flare with three
// demo friends. Runs the real engine (@flare/engine) in the browser on a demo clock: the same
// rules decide when it lights, when it shrinks to an Ember at 30 minutes, and which bench the
// Ember picks. No server, no network, no real data; every screen says "Demo".
import { createFlare, engine } from "@flare/engine";
import type { Answer, EngineEvent, Gathering, JobKind, Label } from "@flare/shared/icd/engine";

export const DEMO_FRIENDS = [
  { id: "00000000-0000-4000-8000-0000000000a1", name: "Amor" },
  { id: "00000000-0000-4000-8000-0000000000a2", name: "Benny" },
  { id: "00000000-0000-4000-8000-0000000000a3", name: "Kai" },
] as const;
export const DEMO_HOST = "00000000-0000-4000-8000-0000000000a0";
export const DEMO_WORDS = "Pond walk, cider at golden hour";
export const DEMO_SCENE = "A pond with a wooden bench, autumn trees and the sun low over the water.";
export const DEMO_SPOT = "Ford Woods Park, by the pond";
export const DEMO_BENCHES: Record<string, string> = {
  c1: "the bench by the willow",
  c2: "the picnic table on the hill",
};

const iso = (ms: number) => new Date(ms).toISOString();

export class DemoEngine {
  now = $state(Date.now());
  g = $state<Gathering | null>(null);
  answers = $state<Answer[]>([]);
  log = $state<string[]>([]);
  #jobs = new Map<JobKind, number>();

  /** The host lights a demo Flare that needs 4 (so it can shrink), with two bench candidates. */
  start(quorum = 4): void {
    const made = createFlare(
      {
        id: "00000000-0000-4000-8000-00000000f1a0",
        group_id: "00000000-0000-4000-8000-00000000c0de",
        host: DEMO_HOST,
        group_size: 1 + DEMO_FRIENDS.length,
        quorum,
        ember_candidates: ["c1", "c2"] as Label[],
      },
      iso(this.now),
    );
    if (!made.ok) throw new Error(made.error);
    this.g = made.gathering;
    this.answers = [];
    this.#jobs.clear();
    this.#effects(made.effects);
  }

  /** Feeds one event through the real engine. Returns false when the engine refuses it. */
  event(e: EngineEvent): boolean {
    if (!this.g) return false;
    // The engine clones its inputs; Svelte state proxies can't be cloned, so pass snapshots.
    const r = engine.transition($state.snapshot(this.g), $state.snapshot(this.answers), e, iso(this.now));
    if (!r.ok) return false;
    this.g = r.gathering;
    this.answers = r.answers;
    this.#effects(r.effects);
    return true;
  }

  yes(memberId: string): boolean {
    return this.event({ type: "answer", member_id: memberId, answer: "yes", rules: [], ember_only: false });
  }

  /** Moves the demo clock and runs every timer that falls due, in order (like the server's tick). */
  advance(ms: number): void {
    const end = this.now + ms;
    for (;;) {
      const due = [...this.#jobs].filter(([, at]) => at <= end).sort((a, b) => a[1] - b[1])[0];
      if (!due) break;
      this.#jobs.delete(due[0]);
      this.now = Math.max(this.now, due[1]);
      this.event({ type: "timer", job: due[0] });
    }
    this.now = end;
  }

  need(): number {
    if (!this.g) return 0;
    return engine.view($state.snapshot(this.g), $state.snapshot(this.answers), iso(this.now)).need;
  }
  have(): number {
    return this.answers.filter((a) => a.status === "yes").length + 1; // the host counts
  }

  #effects(effects: { type: string; job?: JobKind; at?: string }[]): void {
    for (const f of effects) {
      if (f.type === "schedule" && f.job && f.at) this.#jobs.set(f.job, Date.parse(f.at));
      if (f.type === "unschedule" && f.job) this.#jobs.delete(f.job);
    }
  }
}
