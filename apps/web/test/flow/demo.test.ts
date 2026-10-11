// The Try-it demo runs the real engine on a demo clock: with 4 needed and one friend in, it
// shrinks to an Ember at 30 minutes; one more yes plus bench checks lights it at a bench.
import { describe, expect, it } from "vitest";
import { DEMO_FRIENDS, DemoEngine } from "../../src/lib/demo/demo.svelte.ts";

describe("demo engine", () => {
  it("Kindling, one yes, Ember at 30 min, then lit at a bench", () => {
    const d = new DemoEngine();
    d.start(4);
    expect(d.g?.state).toBe("kindling");
    expect(d.yes(DEMO_FRIENDS[0].id)).toBe(true);
    expect(d.need()).toBe(2);
    d.advance(30 * 60_000 + 1000);
    expect(d.g?.state).toBe("ember");
    d.event({ type: "checks", member_id: DEMO_FRIENDS[0].id, results: { c1: true, c2: true } });
    d.yes(DEMO_FRIENDS[1].id);
    d.advance(61_000);
    expect(d.g?.state).toBe("lit");
    expect(["c1", "c2"]).toContain(d.g?.ember_choice);
  });
});
