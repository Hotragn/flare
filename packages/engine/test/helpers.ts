// Test helpers: build gatherings through the real create helpers and drive them with events.
import type { Answer, EngineEvent, Gathering, Id, Iso, Label, Result, Rule } from "@flare/shared/icd/engine";
import { expect } from "vitest";
import { createFlare, createPlan, engine } from "../src/index.ts";

export const T0 = "2026-10-11T15:00:00.000Z";
const T0MS = Date.parse(T0);

/** Time t0 + minutes (fractions allowed), as ISO. */
export function at(minutes: number): Iso {
  return new Date(T0MS + Math.round(minutes * 60_000)).toISOString();
}

/** Time t0 + ms, as ISO. */
export function atMs(msOffset: number): Iso {
  return new Date(T0MS + msOffset).toISOString();
}

/** Member id n (0 is the host), UUID-shaped and sortable. */
export function m(n: number): Id {
  return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}
export const HOST = m(0);

export function flare(opts: { quorum?: number; group_size?: number; candidates?: Label[] } = {}): Gathering {
  const r = createFlare(
    {
      id: "10000000-0000-4000-8000-000000000001",
      group_id: "20000000-0000-4000-8000-000000000001",
      host: HOST,
      group_size: opts.group_size ?? 12,
      quorum: opts.quorum ?? 2,
      ember_candidates: opts.candidates ?? [],
    },
    T0,
  );
  if (!r.ok) throw new Error(r.error);
  return r.gathering;
}

/** A Plan: D = t0 + 60, S = t0 + 120, ladder 90 / 60 / 40 / 20 minutes. */
export const D = at(60);
export const S = at(120);
export const LADDER = [
  { step: 1 as const, minutes: 90, place: "step:1" as const },
  { step: 2 as const, minutes: 60, place: "step:2" as const },
  { step: 3 as const, minutes: 40, place: "step:3" as const },
  { step: 4 as const, minutes: 20, place: "step:4" as const },
];

export function plan(opts: { quorum?: number; group_size?: number } = {}): Gathering {
  const r = createPlan(
    {
      id: "10000000-0000-4000-8000-000000000002",
      group_id: "20000000-0000-4000-8000-000000000001",
      host: HOST,
      group_size: opts.group_size ?? 12,
      quorum: opts.quorum ?? 3,
      start_at: S,
      deadline_at: D,
      steps: LADDER,
    },
    T0,
  );
  if (!r.ok) throw new Error(r.error);
  return r.gathering;
}

export function yes(n: number, rules: Rule[] = [], ember_only = false): EngineEvent {
  return { type: "answer", member_id: m(n), answer: "yes", rules, ember_only };
}

export function answer(n: number, rules: Rule[] = [], extra: Partial<Answer> = {}): Answer {
  return {
    member_id: m(n),
    status: "yes",
    ember_only: false,
    rules,
    checks: {},
    checks_at: null,
    faded: false,
    still_coming: false,
    arrived_at: null,
    ...extra,
  };
}

export type World = { g: Gathering; answers: Answer[]; last: Result };

/** Apply one event and require success. */
export function step(w: { g: Gathering; answers: Answer[] }, e: EngineEvent, now: Iso): World {
  const r = engine.transition(w.g, w.answers, e, now);
  if (!r.ok) throw new Error(`unexpected error ${r.error}`);
  return { g: r.gathering, answers: r.answers, last: r };
}

/** Apply events in order at the given times. */
export function run(g: Gathering, events: [EngineEvent, Iso][], answers: Answer[] = []): World {
  let w: World = { g, answers, last: { ok: true, gathering: g, answers, effects: [] } };
  for (const [e, now] of events) w = step(w, e, now);
  return w;
}

export function effects(r: Result) {
  if (!r.ok) throw new Error("not ok");
  return r.effects;
}

export function expectError(r: Result, error: string): void {
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.error).toBe(error);
}
