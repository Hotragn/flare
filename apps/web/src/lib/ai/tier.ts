// Tier selection for every AI feature (SRS-AI-1, SRS-AI-4, BR-AI-1).
//   photo draft:  hub (Gemma 4 on our laptop, via POST /api/v1/drafts) -> rules (template + typed field)
//   Plan ladder:  hub (POST /api/v1/drafts/ladder)                     -> rules (template ladder, on the phone)
//   conditions:   rules parser on the phone, always (CR-E1: conditions never leave the phone)
// No vision model fits iPhone Safari (lab 01, 07, 09), so there is no phone-model tier.
// The choice is automatic and the result always says which tier ran ("Made on our laptop").
import { enforce } from "@flare/shared";
import { z } from "zod";
import { t } from "./copy.ts";

export type Feature = "photo" | "ladder" | "conditions";
/** cloud = DigitalOcean Serverless Inference, used only when the hub is absent (ADR-0022). */
export type Tier = "hub" | "rules" | "cloud";
/** Why the hub tier didn't run. Only these words are stored; never content. */
export type FallbackWhy = "offline" | "network" | "timeout" | "hub_down" | "unusable" | "server_error";

export type TierRecord = { feature: Feature; tier: Tier; at: string; ms: number; why?: FallbackWhy };

/** The server waits 6 s for the hub (photo) and 8 s (ladder); the phone allows upload time on top. */
export const HUB_BUDGET_MS = { photo: 6000, ladder: 8000 } as const;
export const PHONE_TIMEOUT_MS = { photo: 7500, ladder: 9500 } as const;
/** When /config says the cloud tier is on, the server may take up to 35 s (ADR-0022). */
export const CLOUD_TIMEOUT_MS = 40_000;

export type TierDeps = {
  fetch: typeof fetch;
  online: () => boolean;
  /** API origin; "" means same origin. */
  base?: string;
  now?: () => number;
  store?: TierStore;
  timeoutMs?: number;
};

/** "Made on our laptop" / "Made from a template" (copy deck app.tier.*). */
export const tierLabel = (tier: Tier): string =>
  t(tier === "hub" ? "app.tier.hub" : tier === "cloud" ? "app.tier.cloud" : "app.tier.rules");

// ---------- last tier used, for the /ai/ status screen ----------

const STORE_KEY = "flare.ai.tiers.v1";
type KV = Pick<Storage, "getItem" | "setItem">;

export type TierStore = {
  record(r: TierRecord): void;
  last(): TierRecord | null;
  all(): Partial<Record<Feature, TierRecord>>;
};

const RecordSchema = z.object({
  feature: z.enum(["photo", "ladder", "conditions"]),
  tier: z.enum(["hub", "rules", "cloud"]),
  at: z.string(),
  ms: z.number().int().nonnegative(),
  why: z.enum(["offline", "network", "timeout", "hub_down", "unusable", "server_error"]).optional(),
});

/** Keeps the last tier per feature in memory and, when it can, in localStorage. Never content. */
export function createTierStore(kv: KV | null = safeLocalStorage()): TierStore {
  let mem: Partial<Record<Feature, TierRecord>> = {};
  try {
    const raw = kv?.getItem(STORE_KEY);
    if (raw) {
      const parsed = z.record(z.string(), RecordSchema).safeParse(JSON.parse(raw));
      if (parsed.success) mem = parsed.data as Partial<Record<Feature, TierRecord>>;
    }
  } catch {
    mem = {};
  }
  return {
    record(r) {
      const clean = RecordSchema.parse(r) as TierRecord; // drops any extra field
      mem = { ...mem, [r.feature]: clean };
      try {
        kv?.setItem(STORE_KEY, JSON.stringify(mem));
      } catch {
        /* private mode or full storage: memory only */
      }
    },
    last() {
      const all = Object.values(mem);
      return all.length ? (all.sort((a, b) => b.at.localeCompare(a.at))[0] ?? null) : null;
    },
    all: () => ({ ...mem }),
  };
}

function safeLocalStorage(): KV | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

// ---------- calling the hub through the server ----------

export type HubCall<T> =
  | { ok: true; value: T; ms: number; tier: "hub" | "cloud" }
  | { ok: false; why: FallbackWhy; ms: number };

/**
 * One POST with a hard phone-side timeout. Offline short-circuits without a request.
 * Spike E1: when the relay drops, the server answers at once with the rules tier, so the
 * phone sees `tier: "rules"` quickly; a dead link on the phone side ends at the timeout.
 */
export async function callHub<T>(
  path: string,
  init: { body: BodyInit; contentType: string },
  parse: (json: unknown) => { tier: Tier; value: T } | null,
  deps: TierDeps,
  timeoutMs: number,
): Promise<HubCall<T>> {
  const now = deps.now ?? (() => performance.now());
  const t0 = now();
  const ms = () => Math.max(0, Math.round(now() - t0));
  if (!deps.online()) return { ok: false, why: "offline", ms: 0 };
  let res: Response;
  try {
    res = await deps.fetch(`${deps.base ?? ""}${path}`, {
      method: "POST",
      headers: { "content-type": init.contentType },
      body: init.body,
      signal: AbortSignal.timeout(timeoutMs),
      credentials: "same-origin",
    });
  } catch (e) {
    const name = (e as { name?: string }).name;
    return { ok: false, why: name === "TimeoutError" || name === "AbortError" ? "timeout" : "network", ms: ms() };
  }
  if (!res.ok) return { ok: false, why: "server_error", ms: ms() };
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { ok: false, why: "server_error", ms: ms() };
  }
  const p = parse(json);
  if (!p) return { ok: false, why: "unusable", ms: ms() };
  if (p.tier === "rules") return { ok: false, why: "hub_down", ms: ms() };
  return { ok: true, value: p.value, ms: ms(), tier: p.tier };
}

// ---------- photo draft ----------

const DraftResponse = z.object({
  invite: z.string(),
  alt: z.string(),
  tier: z.enum(["hub", "rules", "cloud"]),
  ms: z.number().int().nonnegative(),
});

export type PhotoOutcome =
  | { tier: "hub" | "cloud"; invite: string; alt: string; ms: number; label: string }
  | { tier: "rules"; invite: ""; alt: ""; ms: number; label: string; why: FallbackWhy; message: string };

/** Why-to-message for the typed fallback screen (H2). */
export function fallbackMessage(why: FallbackWhy): string {
  if (why === "offline") return t("develop.offline");
  if (why === "network") return t("develop.noSignal");
  return t("develop.hubDown");
}

/**
 * Photo to six words. Hub when it answers in time with a usable draft; otherwise the typed
 * fallback (rules tier). The phone runs enforce() again, so a bad answer never shows (SRS-AI-2).
 */
export async function draftPhoto(jpeg: Blob, deps: TierDeps, opts: { cloud?: boolean } = {}): Promise<PhotoOutcome> {
  // `cloud`: the host opted in to DigitalOcean for this Flare (ADR-0022); the server uses it only
  // when the hub is absent, so the longer wait applies only to that request.
  const r = await callHub(
    opts.cloud ? "/api/v1/drafts?cloud=1" : "/api/v1/drafts",
    { body: jpeg, contentType: "image/jpeg" },
    (json) => {
      const d = DraftResponse.safeParse(json);
      if (!d.success) return null;
      if (d.data.tier === "rules") return { tier: "rules", value: null };
      const guarded = enforce(JSON.stringify({ invite: d.data.invite, alt: d.data.alt }));
      return guarded ? { tier: d.data.tier, value: { invite: guarded.invite, alt: guarded.alt } } : null;
    },
    deps,
    deps.timeoutMs ?? (opts.cloud ? CLOUD_TIMEOUT_MS : PHONE_TIMEOUT_MS.photo),
  );
  const at = new Date(Date.now()).toISOString();
  if (r.ok && r.value) {
    deps.store?.record({ feature: "photo", tier: r.tier, at, ms: r.ms });
    return { tier: r.tier, invite: r.value.invite, alt: r.value.alt, ms: r.ms, label: tierLabel(r.tier) };
  }
  const why: FallbackWhy = r.ok ? "unusable" : r.why;
  deps.store?.record({ feature: "photo", tier: "rules", at, ms: r.ms, why });
  return {
    tier: "rules",
    invite: "",
    alt: "",
    ms: r.ms,
    label: tierLabel("rules"),
    why,
    message: fallbackMessage(why),
  };
}

/** Conditions always run on the phone; record it so /ai/ can say so. */
export function recordConditionsRun(store: TierStore | undefined, ms: number): void {
  store?.record({ feature: "conditions", tier: "rules", at: new Date(Date.now()).toISOString(), ms: Math.round(ms) });
}
