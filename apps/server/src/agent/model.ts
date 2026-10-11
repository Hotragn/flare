// A Mastra model adapter that talks to the hub's Gemma through the existing relay job
// (ADR-0025). Gemma on the Mac sees the same fixed ladder prompt as today: the relay job
// carries only the ask, the minutes and coarse weather, so nothing new on the Mac is exposed.
//
// The small model cannot call tools through that job, so the adapter plans the tool calls by
// rule on the first step (every context tool, in one parallel step), then on the second step
// turns the tool results into one relay job and returns the hub's ladder as JSON text.
import type { LadderInputT } from "@flare/shared";
import type { NearbyOut, PlanWeather, SunsetOut } from "./tools.ts";
import { withPackSpelling } from "./tools.ts";

export const TOOL_NAMES = ["sunset", "weather_window", "nearby_places", "step_templates"] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

/** The request the route hands the agent, as the user message (JSON). */
export type AgentRequest = LadderInputT & {
  /** When the Plan starts (ISO). Without it the tools use now. */
  start_at?: string;
  /** A pack place label or the pack name; never coordinates. */
  area?: string;
};

/** What the tools found, by tool name. Missing entries mean the tool did not run or failed. */
export type ToolResults = Partial<{
  sunset: SunsetOut;
  weather_window: PlanWeather | null;
  nearby_places: NearbyOut;
  step_templates: unknown;
}>;

/** Extra words the agent may add to the ask when there is room (the ask stays ≤ 80 characters). */
export const DARK_HINT = " before dark";

/** The one relay job the second step sends. Pure, so tests can pin it. */
export function planJob(req: AgentRequest, found: ToolResults): LadderInputT {
  let ask = withPackSpelling(req.ask, found.nearby_places?.named ?? []);
  if (found.sunset?.ends_after_dark && !/\b(dark|night|sunset)\b/i.test(ask) && ask.length + DARK_HINT.length <= 80)
    ask += DARK_HINT;
  const weather = req.weather ?? found.weather_window ?? undefined;
  return { ask, total_minutes: req.total_minutes, ...(weather ? { weather } : {}) };
}

/** Calls the hub (or the cloud tier when the hub is absent) and returns raw JSON text, or null. */
export type LadderCall = (job: LadderInputT, signal: AbortSignal | undefined) => Promise<string | null>;

// The parts of the AI SDK LanguageModelV2 contract this adapter uses (Mastra accepts v2 models).
type Part = { type: string; text?: string; toolName?: string; output?: { type: string; value?: unknown } };
type Msg = { role: string; content: string | Part[] };
type CallOptions = { prompt: Msg[]; tools?: { type: string; name: string }[]; abortSignal?: AbortSignal };
type Content =
  | { type: "text"; text: string }
  | { type: "tool-call"; toolCallId: string; toolName: string; input: string };
type Generated = {
  content: Content[];
  finishReason: "stop" | "tool-calls" | "error";
  usage: { inputTokens: number | undefined; outputTokens: number | undefined; totalTokens: number | undefined };
  warnings: [];
};

const usage = { inputTokens: undefined, outputTokens: undefined, totalTokens: undefined };

function readRequest(prompt: Msg[]): AgentRequest | null {
  for (let i = prompt.length - 1; i >= 0; i--) {
    const m = prompt[i];
    if (m?.role !== "user") continue;
    const text = typeof m.content === "string" ? m.content : m.content.map((p) => p.text ?? "").join("");
    try {
      const j = JSON.parse(text) as AgentRequest;
      if (typeof j.ask === "string" && typeof j.total_minutes === "number") return j;
    } catch {
      return null;
    }
  }
  return null;
}

function readResults(prompt: Msg[]): ToolResults | null {
  const out: Record<string, unknown> = {};
  let any = false;
  for (const m of prompt) {
    if (m.role !== "tool" || typeof m.content === "string") continue;
    for (const p of m.content) {
      if (p.type !== "tool-result" || !p.toolName) continue;
      any = true;
      if (p.output?.type === "json") out[p.toolName] = p.output.value;
    }
  }
  return any ? (out as ToolResults) : null;
}

/** The tool inputs for step one, for the tools the agent actually offers. */
function toolCalls(req: AgentRequest, offered: Set<string>): Content[] {
  const when = { total_minutes: req.total_minutes, ...(req.start_at ? { start_at: req.start_at } : {}) };
  const where = req.area ? { area: req.area } : {};
  const inputs: Record<ToolName, unknown> = {
    sunset: { ...when, ...where },
    weather_window: { ...when, ...where },
    nearby_places: { ask: req.ask },
    step_templates: { total_minutes: req.total_minutes },
  };
  return TOOL_NAMES.filter((n) => offered.has(n))
    .filter((n) => !(n === "weather_window" && req.weather)) // the phone already sent weather
    .map((n, i) => ({
      type: "tool-call",
      toolCallId: `call_${i + 1}_${n}`,
      toolName: n,
      input: JSON.stringify(inputs[n]),
    }));
}

/** A Mastra-compatible (AI SDK v2) model whose only backend is `call`. */
export function relayModel(call: LadderCall, modelId: string) {
  async function doGenerate(o: CallOptions): Promise<Generated> {
    const req = readRequest(o.prompt);
    if (!req) return { content: [{ type: "text", text: "" }], finishReason: "error", usage, warnings: [] };
    const found = readResults(o.prompt);
    const offered = new Set((o.tools ?? []).map((t) => t.name));
    if (!found) {
      const calls = toolCalls(req, offered);
      if (calls.length) return { content: calls, finishReason: "tool-calls", usage, warnings: [] };
    }
    const text = await call(planJob(req, found ?? {}), o.abortSignal);
    return {
      content: [{ type: "text", text: text ?? "" }],
      finishReason: text ? "stop" : "error",
      usage,
      warnings: [],
    };
  }

  return {
    specificationVersion: "v2" as const,
    provider: "flare-relay",
    modelId,
    supportedUrls: {},
    doGenerate,
    async doStream(o: CallOptions) {
      const r = await doGenerate(o);
      const parts: unknown[] = [{ type: "stream-start", warnings: [] }];
      for (const c of r.content) {
        if (c.type === "text") {
          parts.push({ type: "text-start", id: "t1" }, { type: "text-delta", id: "t1", delta: c.text });
          parts.push({ type: "text-end", id: "t1" });
        } else parts.push(c);
      }
      parts.push({ type: "finish", finishReason: r.finishReason, usage });
      const stream = new ReadableStream({
        start(ctl) {
          for (const p of parts) ctl.enqueue(p);
          ctl.close();
        },
      });
      return { stream };
    },
  };
}
