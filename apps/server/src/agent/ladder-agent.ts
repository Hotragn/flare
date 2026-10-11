// The Plan ladder as a Mastra agent (ADR-0025), behind LADDER_AGENT=1. Same contract as the
// plain route: 4 steps through enforceLadder(), tier hub | cloud | rules, 8 s for the hub.
// The ask line is kept in memory only and never logged; spans carry tool names and flags only.
import "./no-telemetry.ts";
import { enforceLadder, type LadderInputT, type LadderT } from "@flare/shared";
import { HUB_MODEL } from "@flare/shared/prompts/guard";
import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import type { CloudTier } from "../cloud.ts";
import type { HubRelay } from "../hub/relay.ts";
import { cloudChat, guardSpan, hubChat, type SpanHandle } from "../tracing.ts";
import { keepAsked } from "./constraints.ts";
import { type AgentRequest, relayModel } from "./model.ts";
import { nearbyPlaces, resolveArea, stepTemplates, sunsetWindow, weatherWindow } from "./tools.ts";

export type AgentDeps = {
  relay: Pick<HubRelay, "status" | "ladder">;
  cloud: Pick<CloudTier, "model" | "ladder"> | null;
  /** Hub budget for the whole run, ms (ADR-0007: 8 s). */
  budgetMs: number;
  now?: () => Date;
  /** For the weather tool only. Tests pass a fake; null turns the tool off. */
  fetch?: typeof fetch | null;
  weatherTimeoutMs?: number;
};

export type AgentOutcome = {
  steps: LadderT | null; // guarded by enforceLadder against the original ask, or null
  tier: "hub" | "cloud" | null;
  fallback: "hub_absent" | "timeout" | "hub_error" | "invalid" | null;
  repaired: number;
  /** Steps whose label the guard replaced with the template label (0 to 3). */
  templateSteps: number;
  weather: "phone" | "tool" | "none";
  /** True when step 1 was set back to the activity the ask named (constraints.ts). */
  kept: boolean;
};

const Minutes = z.object({ total_minutes: z.number().int().min(40).max(600) });
/** The plan's window and coarse area. The area is a label; the cell it maps to stays inside the tool. */
const When = Minutes.extend({
  start_at: z.string().max(40).optional(),
  area: z.string().max(40).optional(),
});

function tools(d: AgentDeps, seen: { weather: boolean }) {
  const now = d.now ?? (() => new Date());
  const startOf = (iso: string | undefined) => {
    const t = iso ? Date.parse(iso) : Number.NaN;
    return Number.isFinite(t) ? new Date(t) : now();
  };
  return {
    sunset: createTool({
      id: "sunset",
      description: "Sunset on the plan's day in its area, and whether the plan ends after dark.",
      inputSchema: When,
      execute: async ({ total_minutes, start_at, area }) =>
        guardSpan("sunset", () => sunsetWindow(total_minutes, startOf(start_at), resolveArea(area)?.cell ?? null)),
    }),
    weather_window: createTool({
      id: "weather_window",
      description: "Rain chance and temperature for the plan's window (api.weather.gov, area rounded to 0.1°).",
      inputSchema: When,
      execute: async ({ total_minutes, start_at, area }) =>
        guardSpan("weather_window", async (g) => {
          if (d.fetch === null) return null;
          const w = await weatherWindow(total_minutes, startOf(start_at), {
            ...(d.fetch ? { fetch: d.fetch } : {}),
            timeoutMs: d.weatherTimeoutMs ?? 2500,
            at: resolveArea(area)?.cell ?? null,
            now: now(),
          });
          g.set({ "flare.ok": !!w });
          if (w) seen.weather = true;
          return w;
        }),
    }),
    nearby_places: createTool({
      id: "nearby_places",
      description: "Named places from the Fairlane map pack: those the ask names, and the closest ones. Labels only.",
      inputSchema: z.object({ ask: z.string().max(80) }),
      execute: async ({ ask }) => guardSpan("nearby_places", () => nearbyPlaces(ask)),
    }),
    step_templates: createTool({
      id: "step_templates",
      description: "The template ladder for these minutes (the fallback).",
      inputSchema: Minutes,
      execute: async ({ total_minutes }) => guardSpan("step_templates", () => stepTemplates(total_minutes)),
    }),
  };
}

/**
 * One agent run. The model call goes to the hub over the relay; DigitalOcean only when the hub
 * is absent (ADR-0022). Never throws: on any failure the caller shows templateLadder().
 */
export async function runLadderAgent(d: AgentDeps, req: AgentRequest, job: SpanHandle): Promise<AgentOutcome> {
  const t0 = performance.now();
  const present = d.relay.status === "connected";
  const seen = { weather: false };
  let tier: AgentOutcome["tier"] = null;
  let hubReplied: boolean | null = null; // null: no reply (timeout), false: hub said not ok
  let sent: LadderInputT | null = null;

  const call = async (j: LadderInputT): Promise<string | null> => {
    sent = j;
    if (present) {
      const left = Math.max(0, d.budgetMs - Math.round(performance.now() - t0));
      const r = await hubChat(HUB_MODEL, async (chat) => {
        const res = left > 0 ? await d.relay.ladder(j as Parameters<HubRelay["ladder"]>[0], left) : null;
        chat.set({ "flare.ok": !!res?.ok, ...(res?.model ? { "gen_ai.response.model": res.model } : {}) });
        return res;
      });
      hubReplied = r ? r.ok : null;
      if (!r?.ok || !r.ladder) return null;
      tier = "hub";
      return JSON.stringify({ steps: r.ladder });
    }
    const cloud = d.cloud;
    if (!cloud) return null;
    const l = await cloudChat(cloud.model, () => cloud.ladder({ ask: j.ask, total_minutes: j.total_minutes }));
    if (!l) return null;
    tier = "cloud";
    return JSON.stringify({ steps: l });
  };

  const agent = new Agent({
    id: "flare-plan-ladder",
    name: "flare-plan-ladder",
    instructions: "Draft a 4-step Plan ladder. Use the tools for context, then answer with the ladder JSON.",
    model: relayModel(call, present ? HUB_MODEL : (d.cloud?.model ?? "none")) as never,
    tools: tools(d, seen),
  });

  // The hub path keeps today's 8 s for the whole run; the cloud path keeps its own budget (cloud.ts).
  const abort = new AbortController();
  const timer = present ? setTimeout(() => abort.abort(), d.budgetMs + 250) : null;
  let text = "";
  try {
    const out = await agent.generate(JSON.stringify(req), { maxSteps: 3, abortSignal: abort.signal });
    text = out.text ?? "";
  } catch {
    text = "";
  } finally {
    if (timer) clearTimeout(timer);
  }

  const weather = req.weather ? "phone" : seen.weather ? "tool" : "none";
  // The same guard as today, against the phone's own ask (not the agent's rewrite).
  const guarded =
    text && tier
      ? guardSpan("enforce_ladder", (g) => {
          const v = enforceLadder(text, { ask: req.ask, total_minutes: req.total_minutes });
          g.set({ "flare.valid": !!v, ...(v ? { "flare.repaired": v.repaired.length } : {}) });
          return v;
        })
      : null;
  // User constraints beat weather: the asked activity stays on step 1 (constraints.ts), and
  // the changed ladder passes the same guard again.
  const rain = !!(sent as LadderInputT | null)?.weather?.rain_likely;
  const k = guarded ? keepAsked(guarded.ladder, req.ask, rain) : null;
  const kept = k?.changed
    ? guardSpan("keep_asked", (g) => {
        const v = enforceLadder(JSON.stringify({ steps: k.ladder }), {
          ask: req.ask,
          total_minutes: req.total_minutes,
        });
        g.set({ "flare.valid": !!v });
        return v;
      })
    : null;
  const final = kept ?? guarded;
  const fallback: AgentOutcome["fallback"] = guarded
    ? null
    : !present
      ? "hub_absent"
      : hubReplied === null
        ? "timeout"
        : hubReplied === false
          ? "hub_error"
          : "invalid";
  job.set({ "flare.agent": true, "flare.weather": weather });
  return {
    steps: final?.ladder ?? null,
    tier: final ? tier : null,
    fallback,
    repaired: final?.repaired.length ?? 0,
    templateSteps: final?.templateSteps ?? 4,
    weather,
    kept: !!kept,
  };
}
