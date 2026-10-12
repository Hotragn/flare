// Live proof strip on home (brief item 3): GET /api/v1/health, counts and states only.
// Fails soft like audit.ts: any error, bad status, bad shape or a slow server gives "down".
import { Health, type HealthT } from "@flare/shared";

export type HealthView = { s: "down" } | ({ s: "ok" } & HealthT);

export async function fetchHealth(
  fetchFn: (u: string, i?: RequestInit) => Promise<Response>,
  timeoutMs = 8000,
): Promise<HealthView> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetchFn("/api/v1/health", { headers: { accept: "application/json" }, signal: ctl.signal });
    if (!res.ok) return { s: "down" };
    const parsed = Health.safeParse(await res.json());
    return parsed.success ? { s: "ok", ...parsed.data } : { s: "down" };
  } catch {
    return { s: "down" };
  } finally {
    clearTimeout(timer);
  }
}

/** "checked 12 s ago" under a minute, then minutes. Never negative (clock skew). */
export function agoParts(at: Date, now: Date): { s: number } | { m: number } {
  const sec = Math.max(0, Math.round((now.getTime() - at.getTime()) / 1000));
  return sec < 60 ? { s: sec } : { m: Math.floor(sec / 60) };
}

/** Is cloud photo drafting offered on this server? GET /api/v1/config cloud_ai.photo_opt_in. */
export async function cloudPhotoOffered(fetchFn: (u: string, i?: RequestInit) => Promise<Response>): Promise<boolean> {
  try {
    const res = await fetchFn("/api/v1/config", { headers: { accept: "application/json" } });
    if (!res.ok) return false;
    const body = (await res.json()) as { cloud_ai?: { photo_opt_in?: unknown } };
    return body?.cloud_ai?.photo_opt_in === true;
  } catch {
    return false;
  }
}
