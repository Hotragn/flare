// FE6 logic for the "more" screens: Hot spots (BR-K-6, SRS-HOT-1 to -3), the Sparks history
// line (BR-K-5, SRS-SPK-2), the needs profile (BR-A-1, SRS-ACC-1) and Forget this group
// (SRS-ID-6, ADR-0015). Pure functions plus thin calls that take the ICD-5 modules as
// arguments, so tests run with fakes and the screens run with the real PWA modules.
import type { Crypto, GroupRecord, Store } from "@flare/shared/icd/client";
import type { Needs } from "@flare/shared/icd/map";
import { z } from "zod";

// ---------- Hot spots (BR-K-6) ----------

/** One place in the group's sealed Hot spots blob (BR-K-6). */
export const HotspotEntry = z.object({
  place_key: z.string().min(1).max(140),
  place_name: z.string().min(1).max(120),
  count: z.number().int().min(1),
  last_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // day only, like Spark created_on
  spark_id: z.string().uuid().nullable(),
});
export const HotspotsBlob = z.object({ v: z.literal(1), places: z.array(HotspotEntry).max(500) });
export type HotspotEntryT = z.infer<typeof HotspotEntry>;
export type HotspotsBlobT = z.infer<typeof HotspotsBlob>;

/** SRS-HOT-1: by count, then most recent. Ties after that keep a stable order by name. */
export function rankHotspots(places: readonly HotspotEntryT[]): HotspotEntryT[] {
  return [...places].sort(
    (a, b) => b.count - a.count || b.last_date.localeCompare(a.last_date) || a.place_name.localeCompare(b.place_name),
  );
}

/** BR-K-6 conflict rule: max count per place key; the newer last date and its Spark win. */
export function mergeHotspots(a: readonly HotspotEntryT[], b: readonly HotspotEntryT[]): HotspotEntryT[] {
  const out = new Map<string, HotspotEntryT>();
  for (const e of [...a, ...b]) {
    const seen = out.get(e.place_key);
    if (!seen) {
      out.set(e.place_key, { ...e });
      continue;
    }
    const newer = e.last_date > seen.last_date ? e : seen;
    out.set(e.place_key, { ...newer, count: Math.max(seen.count, e.count) });
  }
  return [...out.values()];
}

// ---------- Sparks history line (BR-K-5) ----------

export type HistoryLine = { times: number; spark: string | null } | null;

/** BR-K-5: shows when N >= 1 Lit gatherings at that place key, with the newest Spark if any. */
export function historyLine(
  places: readonly HotspotEntryT[],
  placeKey: string,
  newestSpark: string | null,
): HistoryLine {
  const entry = places.find((p) => p.place_key === placeKey);
  if (!entry || entry.count < 1) return null;
  const spark = newestSpark?.trim() ? newestSpark.trim() : null;
  return { times: entry.count, spark };
}

// ---------- Talking to the server ----------

export type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export type ApiFailure = "network" | "server" | "rateLimit" | "auth";

export class ApiError extends Error {
  readonly kind: ApiFailure;
  constructor(kind: ApiFailure) {
    super(`api ${kind}`);
    this.kind = kind;
  }
}

const bearer = (g: Pick<GroupRecord, "memberId" | "token">) => `Bearer ${g.memberId}.${g.token}`;

function failure(status: number): ApiError {
  if (status === 401 || status === 403) return new ApiError("auth");
  if (status === 429) return new ApiError("rateLimit");
  return new ApiError("server");
}

async function call(fetchFn: Fetch, path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetchFn(path, init);
  } catch {
    throw new ApiError("network");
  }
}

/**
 * GET the sealed blob and open it on the phone (AAD `h:{groupId}`, ADR-0008). A 404 means the
 * group has no meetups yet: an empty list, not an error. A blob that fails to open or to
 * validate is treated as empty too, so a damaged record never renders.
 */
export async function loadHotspots(
  deps: { fetch: Fetch; crypto: Crypto },
  group: GroupRecord,
): Promise<HotspotEntryT[]> {
  const res = await call(deps.fetch, `/api/v1/groups/${encodeURIComponent(group.groupId)}/hotspots`, {
    headers: { authorization: bearer(group) },
  });
  if (res.status === 404) return [];
  if (!res.ok) throw failure(res.status);
  const body = (await res.json()) as { blob_ct?: unknown };
  if (typeof body.blob_ct !== "string") return [];
  try {
    const opened = await deps.crypto.openJson<unknown>(group.key, `h:${group.groupId}`, body.blob_ct);
    const parsed = HotspotsBlob.safeParse(opened);
    return parsed.success ? rankHotspots(parsed.data.places) : [];
  } catch {
    return [];
  }
}

/**
 * Newest Spark at one place (BR-K-5): the place key is hashed on the phone (ADR-0008), the
 * server returns sealed text, the phone opens it with AAD `s:{groupId}:{sparkId}`. Any
 * failure gives null: the history line then shows the count alone.
 */
export async function newestSpark(
  deps: { fetch: Fetch; crypto: Crypto },
  group: GroupRecord,
  placeKey: string,
): Promise<string | null> {
  try {
    const hash = await deps.crypto.placeHash(group.key, placeKey);
    const res = await deps.fetch(
      `/api/v1/groups/${encodeURIComponent(group.groupId)}/sparks?place=${encodeURIComponent(hash)}&limit=1`,
      { headers: { authorization: bearer(group) } },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { sparks?: { id?: unknown; text_ct?: unknown }[] };
    const s = body.sparks?.[0];
    if (!s || typeof s.id !== "string" || typeof s.text_ct !== "string") return null;
    const plain = await deps.crypto.open(group.key, `s:${group.groupId}:${s.id}`, s.text_ct);
    const text = new TextDecoder("utf-8", { fatal: true }).decode(plain).trim();
    return text.length >= 1 && text.length <= 140 ? text : null;
  } catch {
    return null;
  }
}

/** SRS-SPK-2 end to end: the Hot spots count for the place plus its newest Spark. */
export async function sparkHistory(
  deps: { fetch: Fetch; crypto: Crypto },
  group: GroupRecord,
  placeKey: string,
): Promise<HistoryLine> {
  const places = await loadHotspots(deps, group).catch(() => [] as HotspotEntryT[]);
  const entry = places.find((p) => p.place_key === placeKey);
  if (!entry) return null;
  // Sparks arrive after the host's Gone update, so the newest one is asked for even when the
  // blob has no spark id yet (the server lists Sparks by place hash).
  const text = await newestSpark(deps, group, placeKey);
  return historyLine(places, placeKey, text);
}

export type ForgetOutcome = { lastMember: boolean; sparksDeleted: number };

/**
 * SRS-ID-6 / ADR-0015. The server goes first: if it can't be reached, this phone keeps the
 * group so the person can try again (otherwise the token to delete the server rows is lost).
 * A 401 or 404 means the server already has nothing for us, so the local copy goes anyway.
 */
export async function forgetGroup(
  deps: { fetch: Fetch; store: Pick<Store, "forget">; idemKey: () => string },
  group: GroupRecord,
  sparkDeleteTokens: readonly string[] = [],
): Promise<ForgetOutcome> {
  const res = await call(
    deps.fetch,
    `/api/v1/groups/${encodeURIComponent(group.groupId)}/members/${encodeURIComponent(group.memberId)}`,
    {
      method: "DELETE",
      headers: {
        authorization: bearer(group),
        "idempotency-key": deps.idemKey(),
        "content-type": "application/json",
      },
      body: JSON.stringify(sparkDeleteTokens.length ? { spark_delete_tokens: sparkDeleteTokens.slice(0, 500) } : {}),
    },
  );
  let outcome: ForgetOutcome = { lastMember: false, sparksDeleted: 0 };
  if (res.ok) {
    const body = (await res.json()) as { last_member?: unknown; sparks_deleted?: unknown };
    outcome = {
      lastMember: body.last_member === true,
      sparksDeleted: typeof body.sparks_deleted === "number" ? body.sparks_deleted : 0,
    };
  } else if (res.status !== 401 && res.status !== 404) {
    throw failure(res.status);
  }
  await deps.store.forget(group.groupId);
  return outcome;
}

// ---------- Needs profile (BR-A-1, SRS-ACC-1: stored only on the phone) ----------

export const NeedsSchema = z.object({
  avoid_steps: z.boolean(),
  rest_gap_m: z.union([z.literal(100), z.literal(200), z.literal(400), z.null()]),
  restroom_300m: z.boolean(),
});

/** The form's three choices; "" means not answered yet. */
export type NeedsForm = { steps: "" | "yes" | "no"; rest: "" | "100" | "200" | "400" | "none"; wc: "" | "yes" | "no" };

export const EMPTY_FORM: NeedsForm = { steps: "", rest: "", wc: "" };

export function needsToForm(n: Needs | null): NeedsForm {
  if (!n) return { ...EMPTY_FORM };
  return {
    steps: n.avoid_steps ? "yes" : "no",
    rest: n.rest_gap_m === null ? "none" : (String(n.rest_gap_m) as NeedsForm["rest"]),
    wc: n.restroom_300m ? "yes" : "no",
  };
}

/** Unanswered fields count as "no need" (needs.empty: every spot counts as fine). */
export function formToNeeds(f: NeedsForm): Needs {
  return {
    avoid_steps: f.steps === "yes",
    rest_gap_m: f.rest === "" || f.rest === "none" ? null : (Number(f.rest) as 100 | 200 | 400),
    restroom_300m: f.wc === "yes",
  };
}

/** Reads the profile from the phone; anything that doesn't match BR-A-1 reads as unset. */
export async function readNeeds(store: Pick<Store, "needs">): Promise<Needs | null> {
  const raw = await store.needs<unknown>();
  const parsed = NeedsSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export async function saveNeeds(store: Pick<Store, "saveNeeds">, f: NeedsForm): Promise<Needs> {
  const n = formToNeeds(f);
  await store.saveNeeds(n);
  return n;
}

// ---------- O7 Post in Telegram (ADR-0013, ADR-0023) ----------

export type TelegramState = { connected: boolean; showPhotos: boolean; available: boolean };

/** Whether the group posts to Telegram, and its photo setting. 503: the bot is not set up. */
export async function loadTelegram(deps: { fetch: Fetch }, group: GroupRecord): Promise<TelegramState> {
  const base = `/api/v1/groups/${encodeURIComponent(group.groupId)}`;
  const headers = { authorization: bearer(group) };
  const [g, s] = await Promise.all([
    call(deps.fetch, base, { headers, cache: "no-store" }),
    call(deps.fetch, `${base}/telegram-settings`, { headers, cache: "no-store" }),
  ]);
  if (!g.ok) throw failure(g.status);
  const channel = ((await g.json()) as { channel?: string }).channel;
  if (s.status === 503) return { connected: false, showPhotos: false, available: false };
  if (!s.ok) throw failure(s.status);
  const showPhotos = ((await s.json()) as { show_photos?: unknown }).show_photos === true;
  return { connected: channel === "telegram", showPhotos, available: true };
}

/** The one-time t.me link that adds the bot to a chat and connects it to this group. */
export async function telegramLink(deps: { fetch: Fetch }, group: GroupRecord): Promise<string> {
  const res = await call(deps.fetch, `/api/v1/groups/${encodeURIComponent(group.groupId)}/telegram-link`, {
    method: "POST",
    headers: { authorization: bearer(group), "idempotency-key": crypto.randomUUID() },
  });
  if (!res.ok) throw failure(res.status);
  const url = ((await res.json()) as { url?: unknown }).url;
  if (typeof url !== "string" || !url.startsWith("https://t.me/")) throw new ApiError("server");
  return url;
}

/** "Show photos in this Telegram group" on or off. */
export async function saveTelegramPhotos(deps: { fetch: Fetch }, group: GroupRecord, on: boolean): Promise<boolean> {
  const res = await call(deps.fetch, `/api/v1/groups/${encodeURIComponent(group.groupId)}/telegram-settings`, {
    method: "PUT",
    headers: { authorization: bearer(group), "content-type": "application/json" },
    body: JSON.stringify({ show_photos: on }),
  });
  if (!res.ok) throw failure(res.status);
  return ((await res.json()) as { show_photos?: unknown }).show_photos === true;
}
