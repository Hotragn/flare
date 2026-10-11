// Hot spots for the app flows (BR-K-5, BR-K-6): the host's phone adds one Lit gathering to the
// group's sealed Hot spots blob at Gone, and the link page shows "Your group met here N times."
// The blob, Spark and history helpers live with the Hot spots screen (routes/app/(more)/more.ts).
import type { ClientIcd } from "@flare/shared/icd/index";
import { type HotspotEntryT, HotspotsBlob, mergeHotspots, sparkHistory } from "../../routes/app/(more)/more.ts";

export { sparkHistory };

type Deps = { fetch: (input: string, init?: RequestInit) => Promise<Response>; crypto: ClientIcd.Crypto };

const bearer = (g: ClientIcd.GroupRecord) => `Bearer ${g.memberId}.${g.token}`;
const idem = () => {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

/**
 * BR-K-6: one more Lit gathering at this place, merged by max count per place. Optimistic
 * concurrency with If-Match on the blob version; on 412 it re-reads, re-merges and tries once more.
 * Returns false on any failure (the history line is a nicety; nothing else depends on it).
 */
export async function recordLitAtPlace(
  deps: Deps,
  group: ClientIcd.GroupRecord,
  place: { key: string; name: string },
  day: string,
): Promise<boolean> {
  if (!place.key || !place.name) return false;
  const url = `/api/v1/groups/${encodeURIComponent(group.groupId)}/hotspots`;
  for (let attempt = 0; attempt < 2; attempt++) {
    let version = "0";
    let places: HotspotEntryT[] = [];
    const got = await deps.fetch(url, { headers: { authorization: bearer(group) } }).catch(() => null);
    if (!got) return false;
    if (got.ok) {
      const body = (await got.json()) as { blob_ct?: string; version?: number };
      version = String(body.version ?? 0);
      try {
        const parsed = HotspotsBlob.safeParse(
          await deps.crypto.openJson(group.key, `h:${group.groupId}`, body.blob_ct ?? ""),
        );
        if (parsed.success) places = parsed.data.places;
      } catch {
        // An unreadable blob (another key) is replaced by ours, merged from nothing.
      }
    } else if (got.status !== 404) return false;
    const prev = places.find((p) => p.place_key === place.key);
    const entry: HotspotEntryT = {
      place_key: place.key,
      place_name: place.name.slice(0, 120),
      count: (prev?.count ?? 0) + 1,
      last_date: day,
      spark_id: prev?.spark_id ?? null,
    };
    const merged = mergeHotspots(
      places.filter((p) => p.place_key !== place.key),
      [entry],
    );
    const blob_ct = await deps.crypto.sealJson(group.key, `h:${group.groupId}`, { v: 1, places: merged });
    const put = await deps
      .fetch(url, {
        method: "PUT",
        headers: {
          authorization: bearer(group),
          "content-type": "application/json",
          "idempotency-key": idem(),
          "if-match": version,
        },
        body: JSON.stringify({ blob_ct }),
      })
      .catch(() => null);
    if (put?.ok) return true;
    if (put?.status !== 412) return false;
  }
  return false;
}
