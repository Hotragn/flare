// Web Push subscribe (PW6, ADR-0014, SRS-IF-3). Only after a tap; on iOS only from the Home
// Screen app (16.4+). The subscription is sent to each group through the outbox, so it
// survives a dropped signal. Never prompts on page load.
import { fromBase64url } from "../crypto/index.ts";
import type { FlareOutbox } from "../outbox/index.ts";
import { isStandalone } from "../permissions/install.ts";

export type PushSupport = "available" | "needs-install" | "none";
export type PushResult = "granted" | "denied" | "needs-install" | "none" | "not-configured";

type Env = {
  PushManager?: unknown;
  Notification?: { permission: NotificationPermission; requestPermission(): Promise<NotificationPermission> };
  navigator?: { serviceWorker?: ServiceWorkerContainer; standalone?: boolean };
  matchMedia?: (q: string) => { matches: boolean };
};
const env = (): Env => globalThis as unknown as Env;

/** Same rule as ICD-8 `push`: iOS Safari tabs report needs-install. */
export function pushSupport(e: Env = env()): PushSupport {
  const hasSw = !!e.navigator?.serviceWorker;
  if (hasSw && e.PushManager && e.Notification) return "available";
  if (e.navigator && "standalone" in e.navigator && !isStandalone(e)) return "needs-install";
  return "none";
}

/** GET /api/v1/config once; null when the server has no VAPID key (push not configured). */
export async function loadVapidKey(base = "", f: typeof fetch = fetch): Promise<string | null> {
  try {
    const res = await f(`${base}/api/v1/config`, { headers: { accept: "application/json" } });
    if (!res.ok) return null;
    const c = (await res.json()) as { vapid_public_key?: string | null };
    return typeof c.vapid_public_key === "string" && c.vapid_public_key ? c.vapid_public_key : null;
  } catch {
    return null;
  }
}

type SubJson = { endpoint: string; keys: { p256dh: string; auth: string } };

function toBody(sub: PushSubscription): SubJson | null {
  const j = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!j.endpoint || !j.keys?.p256dh || !j.keys.auth) return null;
  return { endpoint: j.endpoint, keys: { p256dh: j.keys.p256dh, auth: j.keys.auth } };
}

async function sendToGroups(outbox: FlareOutbox, sub: PushSubscription, groupIds: string[]): Promise<void> {
  const body = toBody(sub);
  if (!body) return;
  for (const g of groupIds) await outbox.send({ method: "PUT", path: `/api/v1/groups/${g}/push-subscriptions`, body });
}

/**
 * Call from the "Allow alerts" tap. The permission prompt is the first call, before any
 * await, so Safari counts the tap. Then it subscribes and tells each group's server row.
 */
export function enablePush(opts: {
  outbox: FlareOutbox;
  groupIds: string[];
  vapidKey: string | null | Promise<string | null>;
  e?: Env;
}): Promise<PushResult> {
  const e = opts.e ?? env();
  const support = pushSupport(e);
  if (support !== "available" || !e.Notification)
    return Promise.resolve(support === "needs-install" ? "needs-install" : "none");
  const asked =
    e.Notification.permission === "granted" ? Promise.resolve("granted" as const) : e.Notification.requestPermission();
  return (async () => {
    if ((await asked) !== "granted") return "denied";
    const key = await opts.vapidKey;
    if (!key) return "not-configured";
    const reg = await e.navigator?.serviceWorker?.ready;
    if (!reg) return "none";
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: fromBase64url(key) }));
    await sendToGroups(opts.outbox, sub, opts.groupIds);
    return "granted";
  })();
}

/** On app open: if alerts are on, send the current subscription again (PUT is idempotent). */
export async function refreshPush(opts: { outbox: FlareOutbox; groupIds: string[]; e?: Env }): Promise<boolean> {
  const e = opts.e ?? env();
  if (pushSupport(e) !== "available" || e.Notification?.permission !== "granted") return false;
  const reg = await e.navigator?.serviceWorker?.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return false;
  await sendToGroups(opts.outbox, sub, opts.groupIds);
  return true;
}

/** "Stop notices on this phone" for one group. */
export async function disablePush(outbox: FlareOutbox, groupId: string): Promise<void> {
  await outbox.send({ method: "DELETE", path: `/api/v1/groups/${groupId}/push-subscriptions`, body: undefined });
}
