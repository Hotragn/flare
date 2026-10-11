// OD3: capability probe (ICD-8) and the device check page (SRS-CAP-1, SRS-AI-5, SRS-COMP-2).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { detect, type Env, frameRateOk, SHADER_FRAMES } from "../../src/lib/capabilities/index.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, "../..");
const CHECK = path.join(WEB, "static/check");

const doc = (withSwitch: boolean) => ({
  createElement: () => {
    const el: Record<string, unknown> = { setAttribute: () => {} };
    if (withSwitch) el.switch = false;
    return el;
  },
});
class Orient {}
class OrientIos {
  static requestPermission() {
    return Promise.resolve("granted");
  }
}

const iphoneTab: Env = {
  window: {
    DeviceOrientationEvent: OrientIos,
    speechSynthesis: {},
    OffscreenCanvas: class {},
    WebGL2RenderingContext: class {},
  },
  navigator: { geolocation: {}, mediaDevices: { getUserMedia() {} }, serviceWorker: {}, share() {}, standalone: false },
  document: doc(true),
  matchMedia: () => ({ matches: false }),
  isSecureContext: true,
};

describe("ICD-8 detect()", () => {
  it("iPhone Safari tab: compass needs permission, push needs the Home Screen app, switch haptic", () => {
    const c = detect(iphoneTab);
    expect(c).toMatchObject({
      secureContext: true,
      standalone: false,
      camera: "live",
      orientation: "needs-permission",
      push: "needs-install",
      switchHaptic: true,
      vibrate: false,
      webgl2: true,
      offscreenCanvas: true,
    });
  });

  it("Home Screen app on iOS 16.4+: push available, standalone", () => {
    const c = detect({
      ...iphoneTab,
      window: { ...(iphoneTab.window as object), PushManager: class {}, Notification: class {} },
      navigator: { ...(iphoneTab.navigator as object), standalone: true },
    });
    expect(c.standalone).toBe(true);
    expect(c.push).toBe("available");
  });

  it("desktop Chrome: orientation available, vibrate, no switch", () => {
    const c = detect({
      window: { DeviceOrientationEvent: Orient, PushManager: class {}, Notification: class {} },
      navigator: { vibrate() {}, serviceWorker: {}, geolocation: {} },
      document: doc(false),
      matchMedia: () => ({ matches: false }),
      isSecureContext: true,
    });
    expect(c).toMatchObject({
      orientation: "available",
      vibrate: true,
      switchHaptic: false,
      push: "available",
      camera: "file-only",
    });
  });

  it("nothing at all: everything off, no throw", () => {
    const c = detect({});
    expect(c).toMatchObject({
      camera: "none",
      orientation: "none",
      push: "none",
      secureContext: false,
      storagePersisted: null,
    });
  });

  it("returns every ICD-8 field", () => {
    expect(Object.keys(detect(iphoneTab)).sort()).toEqual(
      [
        "secureContext",
        "standalone",
        "camera",
        "offscreenCanvas",
        "geolocation",
        "orientation",
        "speech",
        "vibrate",
        "switchHaptic",
        "webgl2",
        "push",
        "share",
        "shareFiles",
        "serviceWorker",
        "storagePersisted",
      ].sort(),
    );
  });

  it("runs in under 20 ms", () => {
    const t = performance.now();
    for (let i = 0; i < 100; i++) detect(iphoneTab);
    expect((performance.now() - t) / 100).toBeLessThan(20);
  });

  it("SRS-COMP-2: never reads the user agent or device model (lint grep)", () => {
    const dir = path.join(WEB, "src/lib/capabilities");
    for (const f of fs.readdirSync(dir)) {
      const code = fs.readFileSync(path.join(dir, f), "utf8").replace(/\/\/.*$/gm, "");
      expect(code, f).not.toMatch(/userAgent|navigator\.platform|userAgentData|iPhone|iPad|Macintosh/);
    }
  });

  it("ADR-0003 shader gate: 50 fps median over 60 frames", () => {
    expect(frameRateOk(Array(SHADER_FRAMES).fill(16.7))).toBe(true);
    expect(frameRateOk(Array(SHADER_FRAMES).fill(25))).toBe(false);
    expect(frameRateOk(Array(10).fill(16.7))).toBe(false);
  });
});

describe("device check page has no dead cards (SRS-CAP-1)", () => {
  const page = fs.readFileSync(path.join(CHECK, "capability/index.html"), "utf8");

  it("every button's data-run has a handler", () => {
    const runs = [...page.matchAll(/data-run="(\w+)"/g)].map((m) => m[1]);
    expect(runs.length).toBeGreaterThan(10);
    for (const r of runs) expect(page, r).toMatch(new RegExp(`T\\.${r}\\s*=|${r}\\s*\\(`));
  });

  it("every section gets a status on load or says tap to test", () => {
    const ids = [...page.matchAll(/<section id="s-([\w-]+)"/g)].map((m) => m[1] ?? "");
    for (const id of ids) expect(page, id).toMatch(new RegExp(`set\\('${id}'|'${id}'`));
  });

  it("has the Flare features (ICD-8), photo resize and shader cards", () => {
    expect(page).toContain('id="s-icd8"');
    expect(page).toContain('id="s-resize"');
    expect(page).toContain('id="s-shader"');
  });

  it("checklist links point at pages that exist or that the kit builds", () => {
    const index = fs.readFileSync(path.join(CHECK, "index.html"), "utf8");
    const links = [...index.matchAll(/href="(\/[^"]+)"/g)].map((m) => m[1] ?? "");
    for (const l of links) {
      if (l.startsWith("/lab/")) continue; // prototype build, made by npm run device-check
      const rel = l.replace(/^\/check\/?/, "");
      const f = path.join(CHECK, rel.endsWith("/") || rel === "" ? `${rel}index.html` : rel);
      expect(fs.existsSync(f), l).toBe(true);
    }
  });
});
