// Live deletion audit on the privacy page (SRS-WEB-2, BR-D-7): GET /api/v1/audit, counts only.
// Fails soft: any network error, bad status, bad shape or a slow server gives "down", and the
// page keeps the static audit text.
import { z } from "zod";

export const Audit = z.object({
  at: z.string(),
  pass: z.boolean(),
  stores: z
    .array(
      z.object({
        store: z.string().max(40),
        table: z.string().max(80),
        per_gathering: z.boolean(),
        total_rows: z.number().int().min(0),
        expired_rows: z.number().int().min(0),
      }),
    )
    .max(64),
});
export type AuditT = z.infer<typeof Audit>;

export type AuditView =
  | { s: "down" }
  | { s: "ok"; at: Date; pass: boolean; leftover: number; stores: AuditT["stores"] };

export async function fetchAudit(
  fetchFn: (u: string, i?: RequestInit) => Promise<Response>,
  timeoutMs = 5000,
): Promise<AuditView> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetchFn("/api/v1/audit", { headers: { accept: "application/json" }, signal: ctl.signal });
    if (!res.ok) return { s: "down" };
    const parsed = Audit.safeParse(await res.json());
    if (!parsed.success) return { s: "down" };
    const at = new Date(parsed.data.at);
    if (Number.isNaN(at.getTime())) return { s: "down" };
    // Passing is about the per-gathering stores (openapi Audit.pass); the others are totals.
    const leftover = parsed.data.stores.filter((s) => s.per_gathering).reduce((n, s) => n + s.expired_rows, 0);
    return { s: "ok", at, pass: parsed.data.pass && leftover === 0, leftover, stores: parsed.data.stores };
  } catch {
    return { s: "down" };
  } finally {
    clearTimeout(timer);
  }
}
