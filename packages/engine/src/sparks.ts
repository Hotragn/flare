// WP BE7's pure rules: Spark tickets (BR-K-1) and the Hot spots merge (BR-K-6).
// The backend stores; these functions decide. Place keys and names arrive here only inside
// the host phone's decrypted blob or as opaque values; the server never sees them readable.

export type SparkError = "not_arrived" | "spark_exists";

/**
 * BR-K-1: only a member with an accepted arrival (a ticket from the `spark_ticket` effect) may
 * leave a Spark, and only one per gathering.
 */
export function sparkAllowed(ticket: {
  issued: boolean;
  used: boolean;
}): { ok: true } | { ok: false; error: SparkError } {
  if (!ticket.issued) return { ok: false, error: "not_arrived" };
  if (ticket.used) return { ok: false, error: "spark_exists" };
  return { ok: true };
}

/** One entry of the Hot spots blob (BR-K-6). `last_date` is YYYY-MM-DD. */
export type HotSpot = {
  place_key: string;
  place_name: string;
  count: number;
  last_date: string;
  newest_spark_id: string | null;
};

/** The newer of two entries for the same place: later date, then higher count, then a. */
function newer(a: HotSpot, b: HotSpot): HotSpot {
  if (a.last_date !== b.last_date) return a.last_date > b.last_date ? a : b;
  return b.count > a.count ? b : a;
}

/**
 * BR-K-6: merge two versions of the blob. Count is the max per place key; name, date and
 * newest Spark come from the newer entry. Commutative on counts, idempotent, output sorted by key.
 */
export function mergeHotSpots(a: readonly HotSpot[], b: readonly HotSpot[]): HotSpot[] {
  const out = new Map<string, HotSpot>();
  for (const e of [...a, ...b]) {
    const prev = out.get(e.place_key);
    if (!prev) {
      out.set(e.place_key, { ...e });
      continue;
    }
    const n = newer(prev, e);
    out.set(e.place_key, {
      place_key: e.place_key,
      place_name: n.place_name,
      count: Math.max(prev.count, e.count),
      last_date: n.last_date,
      newest_spark_id: n.newest_spark_id ?? (n === prev ? e.newest_spark_id : prev.newest_spark_id),
    });
  }
  return [...out.values()].sort((x, y) => (x.place_key < y.place_key ? -1 : x.place_key > y.place_key ? 1 : 0));
}

/** BR-K-6 at Gone: the host phone adds one Lit gathering at this place. */
export function recordLit(
  blob: readonly HotSpot[],
  place: { key: string; name: string },
  date: string,
  sparkId: string | null,
): HotSpot[] {
  const prev = blob.find((e) => e.place_key === place.key);
  const entry: HotSpot = {
    place_key: place.key,
    place_name: place.name,
    count: (prev?.count ?? 0) + 1,
    last_date: prev && prev.last_date > date ? prev.last_date : date,
    newest_spark_id: sparkId ?? prev?.newest_spark_id ?? null,
  };
  return mergeHotSpots(
    blob.filter((e) => e.place_key !== place.key),
    [entry],
  );
}
