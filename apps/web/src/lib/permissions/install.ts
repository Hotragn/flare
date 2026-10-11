// Home Screen install (PW6). iOS Safari has no install prompt: the person taps Share, then
// Add to Home Screen (copy perm.notify.homeScreenHow). Chrome on Android fires
// beforeinstallprompt, which we keep and show behind our own button. Installed, Flare opens
// full screen and, on iOS 16.4 and later, can get push notices (SRS-IF-3).

type InstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type InstallKind = "installed" | "ios-share" | "prompt" | "none";

type Env = {
  matchMedia?: (q: string) => { matches: boolean };
  navigator?: { standalone?: boolean };
};

const env = (): Env => globalThis as unknown as Env;

/** True when opened from the Home Screen (display-mode standalone, or iOS navigator.standalone). */
export function isStandalone(e: Env = env()): boolean {
  if (e.matchMedia?.("(display-mode: standalone)").matches) return true;
  return e.navigator?.standalone === true;
}

let deferred: InstallPromptEvent | null = null;

/** Keeps Chrome's install prompt for our own button. Call once at startup. */
export function captureInstallPrompt(target: EventTarget = globalThis as unknown as EventTarget): () => void {
  const onPrompt = (ev: Event) => {
    ev.preventDefault();
    deferred = ev as InstallPromptEvent;
  };
  const onInstalled = () => {
    deferred = null;
  };
  target.addEventListener("beforeinstallprompt", onPrompt);
  target.addEventListener("appinstalled", onInstalled);
  return () => {
    target.removeEventListener("beforeinstallprompt", onPrompt);
    target.removeEventListener("appinstalled", onInstalled);
  };
}

/**
 * What the install step looks like here. `navigator.standalone` exists only in iOS and iPadOS
 * Safari, so it tells us the Share-sheet route without reading the user agent.
 */
export function installKind(e: Env = env()): InstallKind {
  if (isStandalone(e)) return "installed";
  if (deferred) return "prompt";
  if (e.navigator && "standalone" in e.navigator) return "ios-share";
  return "none";
}

/** Shows Chrome's prompt from a tap. Resolves true when the person accepted. */
export async function promptInstall(): Promise<boolean> {
  const ev = deferred;
  if (!ev) return false;
  deferred = null;
  await ev.prompt();
  return (await ev.userChoice).outcome === "accepted";
}
