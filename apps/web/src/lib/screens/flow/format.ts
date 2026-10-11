// Small formatting helpers shared by the flows. Times show in the group's time zone
// (BR-TIME-2) on server-corrected time (BR-TIME-1).
import type { Rule } from "@flare/shared/icd/engine";
import { t } from "#lib/copy/index.ts";

/** "5:00 PM" in the given zone. */
export function clock(iso: string | number | Date, tz: string): string {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz }).format(new Date(iso));
}

/** "Sun 11:00 AM" in the given zone. */
export function dayClock(iso: string | number | Date, tz: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
  }).format(new Date(iso));
}

/** Whole minutes from now until `iso`, never below 0. */
export const minutesUntil = (iso: string, nowMs: number): number =>
  Math.max(0, Math.ceil((Date.parse(iso) - nowMs) / 60_000));

/** Server-minus-device offset in ms from a view's server_time, measured at receipt. */
export const offsetFrom = (serverTime: string, deviceNow: number): number => Date.parse(serverTime) - deviceNow;

/** One chip per rule for the read-back sheet (I3). `names` resolves member ids opened on this phone. */
export function ruleChip(r: Rule, tz: string, names: Record<string, string>): string {
  switch (r.type) {
    case "with":
      return t("readback.chip.with", { name: names[r.member_id] ?? "" });
    case "after":
      return t("readback.chip.after", { time: clock(r.at, tz) });
    case "back_by":
      return t("readback.chip.backBy", { time: clock(r.at, tz) });
    case "max_walk":
      return t("readback.chip.maxWalk", { min: r.minutes });
    case "max_step":
      return t("readback.chip.maxStep", { k: r.step });
    case "min_step":
      return t("readback.chip.minStep", { k: r.step });
  }
}

/** 16 random bytes, base64url without padding: a write token or delete token (ADR-0018). */
export function newToken(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...b))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function toB64url(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromB64url(text: string): Uint8Array<ArrayBuffer> {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (text.length % 4)) % 4);
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);
export const fromUtf8 = (b: Uint8Array): string => new TextDecoder().decode(b);
