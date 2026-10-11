// Drafts from the hub with the rules tier as fallback (ADR-0006, ADR-0007, ADR-0011, BR-AI-1).
// Photos and ask lines are kept in memory only and never logged.
import {
  DraftResponse,
  type DraftResponseT,
  enforce,
  enforceLadder,
  MAX_PHOTO_BYTES,
  TEMPLATE_INVITE,
  templateLadder,
} from "@flare/shared";
import { HUB_MODEL } from "@flare/shared/prompts/guard";
import type { Hono } from "hono";
import type { Ctx } from "../core/deps.ts";
import { bumpGlobal } from "../core/gatherings.ts";
import { ApiError } from "../http/errors.ts";
import { body, limitWrite, type RateLimiter } from "../http/middleware.ts";
import { LadderRequest } from "../http/schemas.ts";
import { clientIp } from "../http/write.ts";
import { log } from "../log.ts";
import { aiJob, guardSpan, hubChat } from "../tracing.ts";

export function mountAi(app: Hono, ctx: Ctx, rl: RateLimiter): void {
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
      const out = await aiJob("photo", async (job) => {
        const t = performance.now();
        const present = ctx.relay.status === "connected";
        const r = await hubChat(HUB_MODEL, async (chat) => {
          const res = await ctx.relay.draft(buf);
          chat.set({ "flare.ok": !!res?.ok, ...(res?.model ? { "gen_ai.response.model": res.model } : {}) });
          if (res?.error) chat.set({ "flare.error": res.error });
          return res;
        });
        const guarded =
          r?.ok && r.draft
            ? guardSpan("enforce", (g) => {
                const v = enforce(JSON.stringify(r.draft));
                g.set({ "flare.valid": !!v });
                return v;
              })
            : null;
        const fallback = !present ? "hub_absent" : !r ? "timeout" : !r.ok ? "hub_error" : "invalid";
        const res: DraftResponseT = guarded
          ? { invite: guarded.invite, alt: guarded.alt, tier: "hub", ms: Math.round(performance.now() - t) }
          : { invite: TEMPLATE_INVITE, alt: "", tier: "rules", ms: Math.round(performance.now() - t) };
        job.set({ "flare.tier": res.tier, "flare.ok": !!guarded, ...(guarded ? {} : { "flare.fallback": fallback }) });
        return res;
      });
      count("tier_ran.photo", out.tier);
      return c.json(DraftResponse.parse(out));
    } finally {
      buf.fill(0); // drop the photo bytes on every path; nothing is stored (ADR-0011)
    }
  });

  app.post("/api/v1/drafts/ladder", async (c) => {
    limitWrite(rl, { anon: clientIp(c) });
    const b = await body(c, LadderRequest);
    const out = await aiJob("ladder", async (job) => {
      const t = performance.now();
      const present = ctx.relay.status === "connected";
      const r = await hubChat(HUB_MODEL, async (chat) => {
        const res = await ctx.relay.ladder(b, ctx.ladderTimeoutMs);
        chat.set({ "flare.ok": !!res?.ok, ...(res?.model ? { "gen_ai.response.model": res.model } : {}) });
        return res;
      });
      // ML's guard (packages/shared/src/prompts/ladder.ts): one rule set for hub and server.
      const hub =
        r?.ok && r.ladder
          ? guardSpan("enforce_ladder", (g) => {
              const d = enforceLadder(JSON.stringify(r.ladder), { ask: b.ask, total_minutes: b.total_minutes });
              g.set({ "flare.valid": !!d, ...(d ? { "flare.repaired": d.repaired.length } : {}) });
              return d?.ladder ?? null;
            })
          : null;
      const steps = hub ?? templateLadder(b.total_minutes);
      const tier = hub ? "hub" : "rules";
      const fallback = !present ? "hub_absent" : !r ? "timeout" : !r.ok ? "hub_error" : "invalid";
      job.set({ "flare.tier": tier, "flare.ok": !!hub, ...(hub ? {} : { "flare.fallback": fallback }) });
      return { steps, tier, ms: Math.round(performance.now() - t) };
    });
    count("tier_ran.ladder", out.tier);
    return c.json(out);
  });
}
