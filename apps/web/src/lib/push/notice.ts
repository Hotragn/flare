// Push notice text (PW5, ADR-0014, asyncapi channel `push`). The service worker opens
// `notice_ct` with the group key from IndexedDB and fills the copy deck templates. If it
// can't (no key on this phone, wrong key, damaged text), it shows the fallback, which has no
// names or places. iOS needs a visible notice for every push, so this never throws.
import type { NoticeTextT } from "@flare/shared/sealed";
import { aad, flareCrypto } from "../crypto/index.ts";
import type { FlareStore } from "../store/index.ts";
import copy from "./push-copy.json" with { type: "json" };

export type PushPayload = {
  v: 1;
  g: string;
  kind: "flare" | "plan";
  event: "lit" | "ember" | "plan_on" | "plan_ember" | "plan_smaller" | "still_coming" | "plan_soon" | "gone";
  label?: string;
  step?: number;
  at?: string;
  notice_ct?: string;
};

export type Notice = { title: string; body: string; tag: string; url: string };

type CopyKey = keyof typeof copy;
const EVENTS = new Set(["lit", "ember", "plan_on", "plan_ember", "plan_smaller", "still_coming", "plan_soon", "gone"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function t(key: CopyKey, vars: Record<string, string> = {}): string {
  return copy[key]
    .replace(/\{(\w+)\}/g, (_, name: string) => {
      const v = vars[name];
      if (v === undefined) throw new Error(`push copy ${key} needs ${name}`);
      return v;
    })
    .replace(/\bat [Nn]ear (?=\p{Lu})/gu, "near "); // "is near Heather Drive", not "is at Near"
}

/** Checks the asyncapi pushNotice shape; anything else gets the generic notice. */
export function parsePayload(raw: unknown): PushPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  if (p.v !== 1 || typeof p.g !== "string" || !UUID.test(p.g)) return null;
  if (p.kind !== "flare" && p.kind !== "plan") return null;
  if (typeof p.event !== "string" || !EVENTS.has(p.event)) return null;
  return {
    v: 1,
    g: p.g,
    kind: p.kind,
    event: p.event as PushPayload["event"],
    ...(typeof p.label === "string" ? { label: p.label } : {}),
    ...(typeof p.step === "number" ? { step: p.step } : {}),
    ...(typeof p.at === "string" ? { at: p.at } : {}),
    ...(typeof p.notice_ct === "string" ? { notice_ct: p.notice_ct } : {}),
  };
}

/** "7:30 PM" in the phone's zone; the field test is all in one zone (America/Detroit). */
export function formatTime(iso: string, timeZone?: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    ...(timeZone ? { timeZone } : {}),
  }).format(d);
}

const isStr = (v: unknown, min: number, max: number): v is string =>
  typeof v === "string" && v.length >= min && v.length <= max;
const isNames = (v: unknown, max: number): boolean =>
  v === undefined ||
  (typeof v === "object" && v !== null && !Array.isArray(v) && Object.values(v).every((x) => isStr(x, 0, max)));

/**
 * The same rules as zod `NoticeText` in packages/shared/src/sealed.ts, written out so the
 * service worker doesn't ship zod (31 KB gzipped). notice.test.ts checks both agree.
 */
export function isNoticeText(v: unknown): v is NoticeTextT {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return o.v === 1 && isStr(o.host, 1, 40) && isStr(o.spot, 0, 120) && isNames(o.benches, 120) && isNames(o.steps, 40);
}

function stepName(n: NoticeTextT, p: PushPayload): string | undefined {
  const label = p.label ?? (p.step ? `step:${p.step}` : undefined);
  return label ? n.steps?.[label] : undefined;
}

/** The readable notice, or null when a needed name is missing (then the fallback is used). */
export function readable(n: NoticeTextT, p: PushPayload, timeZone?: string): { title: string; body: string } | null {
  const title = t(p.kind === "plan" ? "push.planTitle" : "push.flareTitle", { host: n.host });
  const time = p.at ? formatTime(p.at, timeZone) : null;
  const step = stepName(n, p);
  switch (p.event) {
    case "lit":
      return n.spot ? { title, body: t("push.lit", { host: n.host, spot: n.spot }) } : null;
    case "ember": {
      const bench = p.label ? n.benches?.[p.label] : undefined;
      return bench ? { title, body: t("push.ember", { bench }) } : null;
    }
    case "plan_on":
      return step && time ? { title, body: t("push.planOn", { step, time }) } : null;
    case "plan_ember":
      return step && time ? { title, body: t("push.planEmber", { step, time }) } : null;
    case "plan_smaller":
      return step ? { title, body: t("push.planSmaller", { step }) } : null;
    case "still_coming":
      return step ? { title, body: t("push.stillComing", { step }) } : null;
    case "plan_soon":
      return step && time ? { title, body: t("push.planSoon", { step, time }) } : null;
    case "gone":
      return { title, body: t("push.gone") };
  }
}

/** Generic text with no names or places. */
export function fallback(p: PushPayload | null): { title: string; body: string } {
  const title = t("push.fallbackTitle");
  if (p?.event === "gone") return { title, body: t("push.gone") };
  if (p?.event === "lit" || p?.event === "plan_on" || !p) return { title, body: t("push.fallbackLit") };
  return { title, body: t("push.fallbackChange") };
}

/** Builds the notice for a push. Never throws. */
export async function buildNotice(raw: unknown, store: FlareStore | null, timeZone?: string): Promise<Notice> {
  const p = parsePayload(raw);
  const tag = p ? `flare-${p.g}` : "flare";
  let url = p ? `/g/${p.g}/` : "/app/";
  try {
    if (p && store) {
      const group = await store.groupOf(p.g);
      if (group) {
        const fragment = await store.fragment(group.groupId);
        if (fragment) url = `/g/${p.g}/#k=${fragment}`;
        if (p.notice_ct) {
          const opened = await flareCrypto.openJson<unknown>(group.key, aad.notice(p.g), p.notice_ct);
          const text = isNoticeText(opened) ? readable(opened, p, timeZone) : null;
          if (text) return { ...text, tag, url };
        }
      }
    }
  } catch {
    // Wrong key, damaged text or storage error: generic notice below.
  }
  return { ...fallback(p), tag, url };
}
