// The branded Telegram card (ADR-0023): renders a PNG in memory, shows no names, and uses
// the same flame geometry as the app.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CARD, cardSvg, DOME, FLAME, HOLE, renderCard, wrap } from "../../src/telegram/card.ts";
import { cardView } from "../../src/telegram/render.ts";
import type { PostRow } from "../../src/telegram/store.ts";
import { woffToSfnt } from "../../src/telegram/woff.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const row = (over: Partial<PostRow> = {}): PostRow => ({
  id: "g",
  group_id: "gr",
  kind: "flare",
  state: "kindling",
  tz: "America/Detroit",
  ended: null,
  ember_choice: null,
  current_step: null,
  plan_steps: null,
  start_at: null,
  created_at: new Date(),
  expires_at: new Date(),
  host_member_id: "h",
  plain: {
    host: "Sam",
    invite: "Bench by the pond, sun out",
    place: "Fairlane pond bench",
    link: "https://x/g/1#k=a",
    ember_places: { c1: "Maple bench" },
  },
  chat_id: 1,
  photos_on: false,
  ...over,
});

describe("Telegram branded card (ADR-0023)", () => {
  it("renders a 1200x800 PNG in memory", async () => {
    const png = await renderCard(cardView(row(), { need: 2, until: null }));
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    expect(png.readUInt32BE(16)).toBe(CARD.w);
    expect(png.readUInt32BE(20)).toBe(CARD.h);
  });
  it("shows the six words, the place and the count line, never the host's name", () => {
    const svg = cardSvg(cardView(row(), { need: 2, until: null }));
    for (const word of ["Bench", "pond,", "sun", "out"]) expect(svg).toContain(word); // wrapped over lines
    expect(svg).toContain("Fairlane pond bench");
    expect(svg).toContain("Need 2 more.");
    expect(svg).not.toContain("Sam");
  });
  it("follows the state: Lit, Ember with the chosen bench, Gone", () => {
    expect(cardView(row({ state: "lit" }), null).status).toBe("It's lit.");
    const ember = cardView(row({ state: "ember", ember_choice: "c1" }), null);
    expect([ember.state, ember.place, ember.status]).toEqual(["ember", "Maple bench", "Need 1 more."]);
    expect(cardView(row({ state: "gone", ended: "thanks_for_coming" }), null).status).toBe("Thanks for coming.");
    expect(cardSvg(cardView(row({ state: "lit" }), null))).toContain('fill="#F2B33D"'); // the gold dot
  });
  it("uses the app's flame geometry (apps/web/src/lib/brand.ts)", () => {
    const brand = fs.readFileSync(path.join(ROOT, "apps/web/src/lib/brand.ts"), "utf8");
    expect(brand).toContain(FLAME);
    expect(brand).toContain(DOME);
    expect(brand).toContain(`HOLE = { cx: ${HOLE.cx}, cy: ${HOLE.cy}, r: ${HOLE.r} }`);
  });
  it("wraps long words and caps the line count with an ellipsis", () => {
    expect(wrap("one two three four five six", 68, 300, 3).length).toBeLessThanOrEqual(3);
    const long = wrap("a ".repeat(80), 68, 300, 2);
    expect(long).toHaveLength(2);
    expect(long[1]?.endsWith("…")).toBe(true);
  });
  it("escapes text for SVG", () => {
    const svg = cardSvg(
      cardView(row({ plain: { ...(row().plain as NonNullable<PostRow["plain"]>), invite: "Tea & <cake>" } }), null),
    );
    expect(svg).toContain("Tea &amp; &lt;cake&gt;");
  });
  it("converts WOFF 1.0 to an SFNT with the same table count", () => {
    const woff = fs.readFileSync(
      path.join(ROOT, "node_modules/@fontsource/fraunces/files/fraunces-latin-600-normal.woff"),
    );
    const sfnt = woffToSfnt(woff);
    expect(new DataView(sfnt.buffer).getUint16(4)).toBe(woff.readUInt16BE(12));
    expect(() => woffToSfnt(new Uint8Array(64))).toThrow("not a WOFF 1.0 file");
  });
});
