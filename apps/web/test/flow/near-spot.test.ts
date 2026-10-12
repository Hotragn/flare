// Live bug (Oct 11): "Fuego is at Near Maple Road." Every "{host} is at {spot}" template,
// with a street spot, a park spot and a bench spot.
import { describe, expect, it } from "vitest";
import { t as botT } from "../../../server/src/telegram/copy.ts";
import { t } from "../../src/lib/copy/index.ts";
import { t as pushT } from "../../src/lib/push/notice.ts";

const SPOTS = [
  ["Near Maple Road", "near Maple Road"],
  ["Ford Field Park", "at Ford Field Park"],
  ["The bench by the willow", "at The bench by the willow"],
] as const;

describe("spot names read as English in every template", () => {
  for (const [spot, want] of SPOTS)
    it(spot, () => {
      const lines = [
        t("invite.where", { host: "Fuego", spot }),
        t("invite.whereWalk", { host: "Fuego", spot, walk: "6 min walk" }),
        t("lit.notice", { host: "Fuego", spot }),
        pushT("push.lit", { host: "Fuego", spot }),
        t("sms.lit" as never, { host: "Fuego", spot, code: "ABC" }),
        botT("lit.notice", { host: "Fuego", spot }),
      ];
      // Live, 12:20 AM: the friend's lit screen said "Fuego is waiting at Near West Road."
      expect(t("send.hostLine", { host: "Fuego", spot })).not.toMatch(/at [Nn]ear/);
      for (const l of lines) {
        expect(l).toContain(`Fuego is ${want}`);
        expect(l).not.toMatch(/at [Nn]ear/);
      }
    });
});
