// Live bug 5 (Oct 11): "We'll buzz you" was promised in a Brave tab with no push. An iPhone
// browser tab can't buzz; only a Home Screen install with alerts allowed gets push. Say only
// what this device will really do.

export type Buzz = "push" | "telegram" | "open";

/** True only when this device holds a live push subscription with alerts allowed. */
export async function pushLive(): Promise<boolean> {
  try {
    if (globalThis.Notification?.permission !== "granted") return false;
    const reg = await navigator.serviceWorker?.getRegistration();
    return !!(await reg?.pushManager?.getSubscription());
  } catch {
    return false;
  }
}

export const buzzMode = (o: { push: boolean; telegram: boolean }): Buzz =>
  o.push ? "push" : o.telegram ? "telegram" : "open";

/** The Sent line: the buzz promise only with push. */
export const sentBodyKey = (b: Buzz): "sent.body" | "sent.bodyTelegram" | "sent.bodyOpen" =>
  b === "push" ? "sent.body" : b === "telegram" ? "sent.bodyTelegram" : "sent.bodyOpen";

export function installed(): boolean {
  try {
    return (
      globalThis.matchMedia?.("(display-mode: standalone)").matches === true ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
}

/** The tab title and the Home Screen badge follow the Flare. */
export function showState(lit: boolean, title: string): void {
  try {
    document.title = title;
    const n = navigator as Navigator & {
      setAppBadge?: (n?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (!installed()) return;
    if (lit) void n.setAppBadge?.(1).catch(() => {});
    else void n.clearAppBadge?.().catch(() => {});
  } catch {}
}

/** The friend's "You're in" line: the buzz promise only with push (final review). */
export const inBodyKey = (push: boolean): "in.body" | "in.bodyOpen" => (push ? "in.body" : "in.bodyOpen");
