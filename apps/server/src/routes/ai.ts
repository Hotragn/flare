// Drafts from the hub with the rules tier as fallback (ADR-0006, ADR-0007, ADR-0011, BR-AI-1).
// Photos and ask lines are kept in memory only and never logged.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DraftResponse, type DraftResponseT, enforce, MAX_PHOTO_BYTES, TEMPLATE_INVITE } from "@flare/shared";
import type { Hono } from "hono";
import type { Ctx } from "../core/deps.ts";
import { bumpGlobal } from "../core/gatherings.ts";
import { ApiError } from "../http/errors.ts";
import { body, limitWrite, type RateLimiter } from "../http/middleware.ts";
import { LadderRequest } from "../http/schemas.ts";
import { clientIp } from "../http/write.ts";
import { log } from "../log.ts";

const DECK = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../design/prototype/src/lib/copy/deck.json",
);

/** Template ladder labels from the copy deck (keys ladder.tmpl.1 to 4). */
export function templateLabels(file = DECK): [string, string, string, string] {
  const deck = JSON.parse(fs.readFileSync(file, "utf8")) as { strings: Record<string, { text: string }> };
  const get = (k: number) => {
    const t = deck.strings[`ladder.tmpl.${k}`]?.text;
    if (!t) throw new Error(`copy key ladder.tmpl.${k} missing`);
    return t;
  };
  return [get(1), get(2), get(3), get(4)];
}

const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);

/** ADR-0007: minutes = total x 1, 0.5, 0.25, 0.125 rounded to 5, kept strictly decreasing. */
export function templateMinutes(total: number): [number, number, number, number] {
  const m = [1, 0.5, 0.25, 0.125].map((f) => round5(total * f));
  for (let i = m.length - 2; i >= 0; i--) if ((m[i] as number) <= (m[i + 1] as number)) m[i] = (m[i + 1] as number) + 5;
  return m as [number, number, number, number];
}

type LadderStep = { step: 1 | 2 | 3 | 4; label: string; minutes: number };

/** The hub's ladder is used only if it is exactly 4 steps, strictly decreasing, short labels. */
export function guardLadder(raw: unknown): LadderStep[] | null {
  if (!Array.isArray(raw) || raw.length !== 4) return null;
  const out: LadderStep[] = [];
  for (let i = 0; i < 4; i++) {
    const s = raw[i] as { step?: unknown; label?: unknown; minutes?: unknown };
    if (s?.step !== i + 1 || typeof s.label !== "string" || typeof s.minutes !== "number") return null;
    const label = s.label.trim();
    if (!label || label.length > 40 || label.split(/\s+/).length > 4 || /\p{Extended_Pictographic}/u.test(label))
      return null;
    if (!Number.isInteger(s.minutes) || s.minutes < 5 || s.minutes > 600) return null;
    if (i > 0 && s.minutes >= (out[i - 1] as LadderStep).minutes) return null;
    out.push({ step: (i + 1) as LadderStep["step"], label, minutes: s.minutes });
  }
  return out;
}

export function mountAi(app: Hono, ctx: Ctx, rl: RateLimiter): void {
  const labels = templateLabels();
  const count = (name: string, tier: string) => {
    if (ctx.db) bumpGlobal(ctx.db, name, tier).catch(() => log.warn({ event: "counter.failed" }, "counter failed"));
  };

  app.post("/api/v1/drafts", async (c) => {
    limitWrite(rl, { anon: clientIp(c) });
    if (c.req.header("content-type") !== "image/jpeg") throw new ApiError(415, "not_jpeg", "Send image/jpeg");
    if (Number(c.req.header("content-length") ?? "0") > MAX_PHOTO_BYTES)
      throw new ApiError(413, "too_large", "1.5 MB at most");
    const buf = Buffer.from(await c.req.arrayBuffer());
    try {
      if (buf.length === 0 || buf.length > MAX_PHOTO_BYTES) throw new ApiError(413, "too_large", "1.5 MB at most");
      if (buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) throw new ApiError(400, "not_jpeg", "Not a JPEG");
      const t = performance.now();
      const r = await ctx.relay.draft(buf);
      const guarded = r?.ok && r.draft ? enforce(JSON.stringify(r.draft)) : null;
      const out: DraftResponseT = guarded
        ? { invite: guarded.invite, alt: guarded.alt, tier: "hub", ms: Math.round(performance.now() - t) }
        : { invite: TEMPLATE_INVITE, alt: "", tier: "rules", ms: Math.round(performance.now() - t) };
      count("tier_ran.photo", out.tier);
      return c.json(DraftResponse.parse(out));
    } finally {
      buf.fill(0); // drop the photo bytes on every path; nothing is stored (ADR-0011)
    }
  });

  app.post("/api/v1/drafts/ladder", async (c) => {
    limitWrite(rl, { anon: clientIp(c) });
    const b = await body(c, LadderRequest);
    const t = performance.now();
    const r = await ctx.relay.ladder(b, ctx.ladderTimeoutMs);
    const hub = r?.ok ? guardLadder(r.ladder) : null;
    const mins = templateMinutes(b.total_minutes);
    const steps =
      hub ?? labels.map((label, i) => ({ step: (i + 1) as LadderStep["step"], label, minutes: mins[i] as number }));
    const tier = hub ? "hub" : "rules";
    count("tier_ran.ladder", tier);
    return c.json({ steps, tier, ms: Math.round(performance.now() - t) });
  });
}
