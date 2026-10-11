import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { bindTelegram, takeBindToken } from "../../src/lib/outbox/bind.ts";
import type { FlareOutbox } from "../../src/lib/outbox/index.ts";
import { askCompass, askLocation, askMotion } from "../../src/lib/permissions/index.ts";
import { installKind, isStandalone } from "../../src/lib/permissions/install.ts";
import { enablePush, pushSupport } from "../../src/lib/push/subscribe.ts";

const g = globalThis as Record<string, unknown>;
afterEach(() => {
  delete g.DeviceOrientationEvent;
  vi.unstubAllGlobals();
});

/** Records the order of calls, like the spike E3 shim. */
function iosShim(answer: "granted" | "denied") {
  const calls: string[] = [];
  g.DeviceOrientationEvent = {
    requestPermission: () => {
      calls.push("orientation");
      return Promise.resolve(answer);
    },
  };
  vi.stubGlobal("navigator", {
    geolocation: {
      getCurrentPosition: (ok: PositionCallback, fail: PositionErrorCallback) => {
        calls.push("location");
        if (answer === "granted")
          ok({ coords: { latitude: 42.3, longitude: -83.2, accuracy: 8 } } as GeolocationPosition);
        else fail({ code: 1 } as GeolocationPositionError);
      },
    },
  });
  return calls;
}

function fakeOutbox() {
  const sent: { method: string; path: string; body: unknown }[] = [];
  const outbox = {
    send: async (i: { method: string; path: string; body: unknown }) => {
      sent.push(i);
      return null;
    },
  } as unknown as FlareOutbox;
  return { outbox, sent };
}

describe("PW6 permission flows", () => {
  it("spike E3: orientation is asked synchronously, before any await, then location", async () => {
    const calls = iosShim("granted");
    const { motion, location } = askCompass();
    expect(calls).toEqual(["orientation"]); // already called when askCompass returns
    expect(await motion).toBe("granted");
    expect(await location).toEqual({ ok: true, coords: { lat: 42.3, lon: -83.2, accuracy: 8 } });
    expect(calls).toEqual(["orientation", "location"]);
  });

  it("spike E3: denied motion still asks location (distance only)", async () => {
    const calls = iosShim("denied");
    const { motion, location } = askCompass();
    expect(await motion).toBe("denied");
    expect(await location).toEqual({ ok: false, reason: "denied" });
    expect(calls).toEqual(["orientation", "location"]);
  });

  it("SRS-COMP-2: no permission API means not-needed; no sensor means unavailable", async () => {
    g.DeviceOrientationEvent = {};
    expect(await askMotion()).toBe("not-needed");
    delete g.DeviceOrientationEvent;
    expect(await askMotion()).toBe("unavailable");
    vi.stubGlobal("navigator", {});
    expect(await askLocation()).toEqual({ ok: false, reason: "unavailable" });
  });
});

describe("PW6 install and push", () => {
  it("SRS-COMP-2: iOS Safari tab needs the Home Screen step; installed is standalone", () => {
    const tab = { navigator: { standalone: false }, matchMedia: () => ({ matches: false }) };
    expect(isStandalone(tab)).toBe(false);
    expect(installKind(tab)).toBe("ios-share");
    expect(pushSupport(tab)).toBe("needs-install");
    const home = { navigator: { standalone: true }, matchMedia: () => ({ matches: true }) };
    expect(installKind(home)).toBe("installed");
    expect(installKind({ navigator: {}, matchMedia: () => ({ matches: false }) })).toBe("none");
  });

  it("SRS-IF-3: asks for notices inside the tap, then sends the subscription to each group", async () => {
    let asked = false;
    const sub = { toJSON: () => ({ endpoint: "https://push.example/abc", keys: { p256dh: "pk", auth: "au" } }) };
    const e = {
      PushManager: {},
      Notification: {
        permission: "default" as NotificationPermission,
        requestPermission: () => {
          asked = true;
          return Promise.resolve("granted" as NotificationPermission);
        },
      },
      navigator: {
        serviceWorker: {
          ready: Promise.resolve({ pushManager: { getSubscription: async () => null, subscribe: async () => sub } }),
        } as unknown as ServiceWorkerContainer,
      },
    };
    const { outbox, sent } = fakeOutbox();
    const p = enablePush({ outbox, groupIds: ["g1", "g2"], vapidKey: "BEl62iUYgUivxIkv69yViEuiBIa", e });
    expect(asked).toBe(true); // before the first await
    expect(await p).toBe("granted");
    expect(sent.map((s) => `${s.method} ${s.path}`)).toEqual([
      "PUT /api/v1/groups/g1/push-subscriptions",
      "PUT /api/v1/groups/g2/push-subscriptions",
    ]);
    expect(sent[0]?.body).toEqual({ endpoint: "https://push.example/abc", keys: { p256dh: "pk", auth: "au" } });
  });

  it("SRS-IF-3: a Safari tab gets needs-install and no prompt; a no stays a no", async () => {
    const { outbox, sent } = fakeOutbox();
    expect(await enablePush({ outbox, groupIds: ["g"], vapidKey: "k", e: { navigator: { standalone: false } } })).toBe(
      "needs-install",
    );
    const e = {
      PushManager: {},
      Notification: {
        permission: "default" as NotificationPermission,
        requestPermission: async () => "denied" as const,
      },
      navigator: { serviceWorker: {} as ServiceWorkerContainer },
    };
    expect(await enablePush({ outbox, groupIds: ["g"], vapidKey: "k", e })).toBe("denied");
    expect(sent).toHaveLength(0);
  });
});

describe("PW6 Telegram bind link", () => {
  it("takes the token, strips bind and via, keeps the key fragment", () => {
    const token = "A".repeat(22);
    let replaced = "";
    const h = {
      state: null,
      replaceState: (_s: unknown, _t: string, u?: string | URL | null) => {
        replaced = String(u);
      },
    };
    const got = takeBindToken({ href: `https://flare.test/g/abc/?via=tg&bind=${token}#k=KEY` }, h);
    expect(got).toBe(token);
    expect(replaced).toBe("/g/abc/#k=KEY");
    expect(takeBindToken({ href: "https://flare.test/g/abc/?bind=bad#k=KEY" }, h)).toBeNull();
    expect(takeBindToken({ href: "https://flare.test/g/abc/#k=KEY" }, h)).toBeNull();
  });

  it("sends the token through the outbox", async () => {
    const { outbox, sent } = fakeOutbox();
    await bindTelegram(outbox, "gid", "T".repeat(22));
    expect(sent).toEqual([
      { method: "POST", path: "/api/v1/gatherings/gid/telegram-bind", body: { token: "T".repeat(22) } },
    ]);
  });
});
