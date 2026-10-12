// Update prompt (PW5). A new service worker waits until the person taps Reload
// (copy app.updateReady, app.updateReload), so a page never changes code mid-tap.

/** Calls `onReady` when a new version is installed and waiting. Returns a stop function. */
export function watchForUpdate(onReady: () => void, container?: ServiceWorkerContainer): () => void {
  const sw = container ?? (globalThis.navigator as Navigator | undefined)?.serviceWorker;
  if (!sw) return () => undefined;
  let stopped = false;
  const check = (reg: ServiceWorkerRegistration) => {
    if (reg.waiting && sw.controller && !stopped) onReady();
  };
  const track = (reg: ServiceWorkerRegistration) => {
    check(reg);
    reg.addEventListener("updatefound", () => {
      const next = reg.installing;
      next?.addEventListener("statechange", () => {
        if (next.state === "installed") check(reg);
      });
    });
  };
  void sw.getRegistration().then((reg) => reg && track(reg));
  const onVisible = () => {
    if (globalThis.document?.visibilityState === "visible") void sw.getRegistration().then((r) => r?.update());
  };
  globalThis.document?.addEventListener("visibilitychange", onVisible);
  return () => {
    stopped = true;
    globalThis.document?.removeEventListener("visibilitychange", onVisible);
  };
}

/** The Reload tap: activate the waiting worker, then reload once it controls the page. */
export async function applyUpdate(container?: ServiceWorkerContainer): Promise<void> {
  const sw = container ?? (globalThis.navigator as Navigator | undefined)?.serviceWorker;
  const reg = await sw?.getRegistration();
  if (!sw || !reg?.waiting) {
    globalThis.location?.reload();
    return;
  }
  sw.addEventListener("controllerchange", () => globalThis.location?.reload(), { once: true });
  reg.waiting.postMessage({ type: "skip-waiting" });
}

/**
 * Live bug 6: a new worker takes over at once (service-worker.ts). An open page then holds old
 * code, so the next in-app navigation becomes a full load, and a missing old chunk reloads.
 * Returns true from `shouldReload()` once a newer worker controls the page.
 */
export function followNewVersion(container?: ServiceWorkerContainer): { shouldReload: () => boolean } {
  const sw = container ?? (globalThis.navigator as Navigator | undefined)?.serviceWorker;
  let stale = false;
  const hadController = !!sw?.controller; // the first install claiming the page is not an update
  sw?.addEventListener("controllerchange", () => {
    if (hadController) stale = true;
  });
  globalThis.addEventListener?.("vite:preloadError", () => globalThis.location?.reload());
  const onVisible = () => {
    if (globalThis.document?.visibilityState === "visible") void sw?.getRegistration().then((r) => r?.update());
  };
  globalThis.document?.addEventListener("visibilitychange", onVisible);
  return { shouldReload: () => stale };
}
