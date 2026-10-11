// Drafts from the hub with the rules tier as fallback (ADR-0006, ADR-0007, ADR-0011, BR-AI-1).
// Photos and ask lines are kept in memory only and never logged.
import {
  DraftResponse,
  type DraftResponseT,
  enforce,
  enforceLadder,
  enforceOsmTags,
  MAX_PHOTO_BYTES,
  TagsDraftResponse,
  type TagsDraftResponseT,
  TEMPLATE_INVITE,
  templateLadder,
} from "@flare/shared";
import { HUB_MODEL } from "@flare/shared/prompts/guard";
import type { Context, Hono } from "hono";
import type { Ctx } from "../core/deps.ts";
import { bumpGlobal } from "../core/gatherings.ts";
import { ApiError } from "../http/errors.ts";
import { body, limitWrite, type RateLimiter } from "../http/middleware.ts";
import { LadderRequest } from "../http/schemas.ts";
import { clientIp } from "../http/write.ts";
import { log } from "../log.ts";
import { aiJob, cloudChat, guardSpan, hubChat } from "../tracing.ts";

/** The photo routes' checks: JPEG only, 1.5 MB at most. The caller zero-fills the buffer. */
async function readJpeg(c: Context): Promise<Buffer> {
  if (c.req.header("content-type") !== "image/jpeg") throw new ApiError(415, "not_jpeg", "Send image/jpeg");
  if (Number(c.req.header("content-length") ?? "0") > MAX_PHOTO_BYTES)
    throw new ApiError(413, "too_large", "1.5 MB at most");
  const buf = Buffer.from(await c.req.arrayBuffer());
  if (buf.length === 0 || buf.length > MAX_PHOTO_BYTES) {
    buf.fill(0);
    throw new ApiError(413, "too_large", "1.5 MB at most");
  }
  if (buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) {
    buf.fill(0);
    throw new ApiError(400, "not_jpeg", "Not a JPEG");
  }
  return buf;
}

/** Loaded on the first agent request only, so LADDER_AGENT off costs nothing at boot. */
let agentModule: Promise<typeof import("../agent/ladder-agent.ts")> | null = null;
const loadAgent = () => {
  agentModule ??= import("../agent/ladder-agent.ts");
  return agentModule;
};

export function mountAi(app: Hono, ctx: Ctx, rl: RateLimiter): void {
  const count = (name: string, tier: string) => {
    if (ctx.db) bumpGlobal(ctx.db, name, tier).catch(() => log.warn({ event: "counter.failed" }, "counter failed"));
  };

  app.post("/api/v1/drafts", async (c) => {
    limitWrite(rl, { anon: clientIp(c) });
    const optIn = c.req.query("cloud") === "1"; // the host's per-Flare choice (ADR-0022)
    const buf = await readJpeg(c);
    try {
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
        // ADR-0022: DigitalOcean only when the hub is absent and the host opted in for this Flare.
        const cloud =
          !guarded && !present && optIn && ctx.cloud
            ? await cloudChat(
                ctx.cloud.model,
                () => (ctx.cloud as NonNullable<typeof ctx.cloud>).photo(buf),
                () => (ctx.cloud as NonNullable<typeof ctx.cloud>).last(),
              )
            : null;
        const ms = Math.round(performance.now() - t);
        const res: DraftResponseT = guarded
          ? { invite: guarded.invite, alt: guarded.alt, tier: "hub", ms }
          : cloud
            ? { invite: cloud.invite, alt: cloud.alt, tier: "cloud", ms }
            : { invite: TEMPLATE_INVITE, alt: "", tier: "rules", ms };
        job.set({
          "flare.tier": res.tier,
          "flare.ok": res.tier !== "rules",
          ...(res.tier === "hub" ? {} : { "flare.fallback": fallback }),
        });
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
      if (ctx.ladderAgent) {
        // ADR-0025: the Mastra agent, same contract and guard; any failure shows the template.
        const r = await loadAgent()
          .then((m) =>
            m.runLadderAgent(
              { relay: ctx.relay, cloud: ctx.cloud, budgetMs: ctx.ladderTimeoutMs, now: () => ctx.clock.now() },
              b,
              job,
            ),
          )
          .catch(() => null);
        const tier = r?.steps && r.tier ? r.tier : "rules";
        job.set({
          "flare.tier": tier,
          "flare.ok": tier !== "rules",
          ...(tier === "rules" ? { "flare.fallback": r?.fallback ?? "invalid" } : {}),
        });
        return { steps: r?.steps ?? templateLadder(b.total_minutes), tier, ms: Math.round(performance.now() - t) };
      }
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
      // ADR-0022: the ask line is non-personal text; DigitalOcean answers when the hub is absent.
      const cloud =
        !hub && !present && ctx.cloud
          ? await cloudChat(
              ctx.cloud.model,
              () => (ctx.cloud as NonNullable<typeof ctx.cloud>).ladder({ ask: b.ask, total_minutes: b.total_minutes }),
              () => (ctx.cloud as NonNullable<typeof ctx.cloud>).last(),
            )
          : null;
      const steps = hub ?? cloud ?? templateLadder(b.total_minutes);
      const tier = hub ? "hub" : cloud ? "cloud" : "rules";
      const fallback = !present ? "hub_absent" : !r ? "timeout" : !r.ok ? "hub_error" : "invalid";
      job.set({ "flare.tier": tier, "flare.ok": tier !== "rules", ...(hub ? {} : { "flare.fallback": fallback }) });
      return { steps, tier, ms: Math.round(performance.now() - t) };
    });
    count("tier_ran.ladder", out.tier);
    return c.json(out);
  });

  // ICR-ML5: Fix the map. The hub drafts OSM tags; the guard runs again here; a person reviews
  // every tag on the phone. No cloud tier: the photo is of a street feature, but ADR-0022 sends
  // photos only on a per-Flare opt-in, and there is no Flare here. The photo is never stored.
  app.post("/api/v1/drafts/tags", async (c) => {
    limitWrite(rl, { anon: clientIp(c) });
    const buf = await readJpeg(c);
    try {
      const out = await aiJob("tags", async (job) => {
        const t = performance.now();
        const present = ctx.relay.status === "connected";
        const r = await hubChat(HUB_MODEL, async (chat) => {
          const res = await ctx.relay.tags(buf, ctx.ladderTimeoutMs); // same 8 s budget as the ladder
          chat.set({ "flare.ok": !!res?.ok, ...(res?.model ? { "gen_ai.response.model": res.model } : {}) });
          if (res?.error) chat.set({ "flare.error": res.error });
          return res;
        });
        const tags =
          r?.ok && r.tags
            ? guardSpan("enforce_osm_tags", (g) => {
                const d = enforceOsmTags(JSON.stringify({ tags: r.tags }));
                g.set({ "flare.valid": !!d, ...(d ? { "flare.dropped": d.dropped.length } : {}) });
                return d?.tags ?? null;
              })
            : null;
        const fallback = !present ? "hub_absent" : !r ? "timeout" : !r.ok ? "hub_error" : "invalid";
        const res: TagsDraftResponseT = tags
          ? { tags, tier: "hub", ms: Math.round(performance.now() - t) }
          : { tags: {}, tier: "rules", ms: Math.round(performance.now() - t) };
        job.set({
          "flare.tier": res.tier,
          "flare.ok": res.tier === "hub",
          ...(tags ? {} : { "flare.fallback": fallback }),
        });
        return res;
      });
      count("tier_ran.tags", out.tier);
      return c.json(TagsDraftResponse.parse(out));
    } finally {
      buf.fill(0);
    }
  });
}
