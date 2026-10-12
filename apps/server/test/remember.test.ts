// ADR-0031: Remember this. The consent rule as properties: it is ready only when the host turned
// it on, it is lit, and every yes agreed; any no or late joiner without consent makes it off for
// everyone; and the result never says who. Plus the transcript lines and the summary guard.
import { enforceSummary } from "@flare/shared";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { rememberState } from "../src/core/remember.ts";
import { toLines } from "../src/voice.ts";

const id = fc.uuid();
const world = fc.record({
  on: fc.boolean(),
  lit: fc.boolean(),
  yes: fc.uniqueArray(id, { minLength: 1, maxLength: 11 }),
  answered: fc.array(fc.option(fc.boolean(), { nil: undefined }), { minLength: 11, maxLength: 11 }),
  until: fc.option(fc.integer({ min: 0, max: 200_000 }), { nil: null }),
});
type World = { on: boolean; lit: boolean; yes: string[]; answered: (boolean | undefined)[]; until: number | null };
const build = (w: World) => {
  const consent = new Map<string, boolean>();
  w.yes.forEach((m: string, i: number) => {
    const a = w.answered[i];
    if (a !== undefined) consent.set(m, a);
  });
  return { on: w.on, lit: w.lit, yes: w.yes, consent, recordingUntil: w.until, now: 100_000 };
};

describe("Remember this consent (ADR-0031)", () => {
  it("ready exactly when on, lit and every yes agreed", () => {
    fc.assert(
      fc.property(world, (w) => {
        const i = build(w);
        const all = w.yes.every((m) => i.consent.get(m) === true);
        expect(rememberState(i).ready).toBe(w.on && w.lit && all);
      }),
    );
  });
  it("any no, from anyone, makes it off for everyone", () => {
    fc.assert(
      fc.property(world, fc.nat(), (w, k) => {
        const i = build(w);
        const who = w.yes[k % w.yes.length] as string;
        i.consent.set(who, false);
        const s = rememberState(i);
        expect(s.ready).toBe(false);
        expect(s.recording).toBe(false);
      }),
    );
  });
  it("a late joiner who hasn't agreed makes it off for everyone", () => {
    fc.assert(
      fc.property(world, id, (w, late) => {
        fc.pre(!w.yes.includes(late));
        const i = build(w);
        for (const m of w.yes) i.consent.set(m, true);
        expect(rememberState({ ...i, on: true, lit: true }).ready).toBe(true);
        expect(rememberState({ ...i, on: true, lit: true, yes: [...w.yes, late] }).ready).toBe(false);
      }),
    );
  });
  it("never says who: the result holds no member id and the same flags for any order", () => {
    fc.assert(
      fc.property(world, (w) => {
        const i = build(w);
        const s = rememberState(i);
        const text = JSON.stringify(s);
        for (const m of w.yes) expect(text).not.toContain(m);
        expect(Object.keys(s).sort()).toEqual(["on", "ready", "recording", "recording_until"]);
        expect(rememberState({ ...i, yes: [...w.yes].reverse() })).toEqual(s);
      }),
    );
  });
  it("recording only while ready and inside its 60 s", () => {
    fc.assert(
      fc.property(world, (w) => {
        const s = rememberState(build(w));
        if (s.recording) expect(s.ready && w.until !== null && w.until > 100_000).toBe(true);
      }),
    );
  });
});

describe("transcript lines and the summary guard", () => {
  it("speaker ids become Speaker 1, 2 in order of speaking; words join per turn", () => {
    const lines = toLines(
      [
        { text: "Look", type: "word", speaker_id: "speaker_7" },
        { text: " ", type: "spacing", speaker_id: "speaker_7" },
        { text: "geese", type: "word", speaker_id: "speaker_7" },
        { text: "Yeah", type: "word", speaker_id: "speaker_2" },
        { text: "(laughs)", type: "audio_event", speaker_id: "speaker_2" },
      ],
      "",
    );
    expect(lines).toEqual([
      { speaker: "Speaker 1", text: "Look geese" },
      { speaker: "Speaker 2", text: "Yeah" },
    ]);
  });
  it("enforceSummary keeps one plain line and refuses labels, numbers and links", () => {
    expect(enforceSummary('{"line": "Geese on the pond and plans to come back with cider"}')).toBe(
      "Geese on the pond and plans to come back with cider",
    );
    expect(enforceSummary('{"line": "Speaker 1 talked about geese"}')).toBeNull();
    expect(enforceSummary('{"line": "Call me on 313 555 0199 later"}')).toBeNull();
    expect(enforceSummary('{"line": ""}')).toBeNull();
    expect(enforceSummary("no json")).toBeNull();
  });
});
