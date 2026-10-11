// Local clock times in the group time zone (BR-TIME-2) to and from UTC instants.
// No library: Intl.DateTimeFormat gives the zone offset at any instant, DST included.

const partsCache = new Map<string, Intl.DateTimeFormat>();

function fmt(tz: string): Intl.DateTimeFormat {
  let f = partsCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsCache.set(tz, f);
  }
  return f;
}

/** Wall-clock fields of an instant in a zone. */
export function wall(ms: number, tz: string): { y: number; mo: number; d: number; h: number; mi: number } {
  const p: Record<string, number> = {};
  for (const x of fmt(tz).formatToParts(new Date(ms))) if (x.type !== "literal") p[x.type] = Number(x.value);
  return { y: p.year ?? 0, mo: p.month ?? 1, d: p.day ?? 1, h: p.hour ?? 0, mi: p.minute ?? 0 };
}

/** Zone offset in ms at an instant (local minus UTC). */
function offsetAt(ms: number, tz: string): number {
  const w = wall(ms, tz);
  const asUtc = Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi);
  return asUtc - Math.floor(ms / 60_000) * 60_000;
}

/**
 * "HH:MM" on the group's local date of `nowIso` to a UTC ISO instant. A time earlier than now
 * stays on today's date: "after 2" said at 3 PM already holds, which is what the person meant.
 */
export function localToIso(hhmm: string, nowIso: string, tz: string): string {
  const [h, mi] = hhmm.split(":").map(Number) as [number, number];
  const today = wall(Date.parse(nowIso), tz);
  const guess = Date.UTC(today.y, today.mo - 1, today.d, h, mi);
  let utc = guess - offsetAt(guess, tz);
  const second = guess - offsetAt(utc, tz); // settle across a DST edge
  if (second !== utc) utc = second;
  return new Date(utc).toISOString();
}

/** "5 PM", "4:30 PM", "noon" style label in the group time zone, as the copy deck samples show. */
export function timeLabel(iso: string, tz: string): string {
  const w = wall(Date.parse(iso), tz);
  const ap = w.h < 12 ? "AM" : "PM";
  const h12 = w.h % 12 === 0 ? 12 : w.h % 12;
  return w.mi === 0 ? `${h12} ${ap}` : `${h12}:${String(w.mi).padStart(2, "0")} ${ap}`;
}
