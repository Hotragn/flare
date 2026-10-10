// Drift checks between code and the contracts. Used by check-contracts.ts and its test.
import { JobHeader, JobResult } from "@flare/shared";
import { createApp } from "../../apps/server/src/app.ts";
import { HubRelay } from "../../apps/server/src/hub/relay.ts";

type OpenApi = { paths: Record<string, Record<string, unknown>> };
type AsyncApi = { components: { messages: Record<string, { payload: { properties?: Record<string, { const?: string; enum?: string[] }> } }> } };

/** Hono path "/api/v1/gatherings/:gatheringId" to OpenAPI "/api/v1/gatherings/{gatheringId}". */
export const toOpenApiPath = (p: string) => p.replace(/:([A-Za-z]+)/g, "{$1}");

export async function contractProblems(openapi: OpenApi, asyncapi: AsyncApi): Promise<string[]> {
  const problems: string[] = [];
  const relay = new HubRelay(10);
  const app = createApp({ relay, db: null, version: "contract-check", webBuildDir: "/nonexistent" });
  for (const r of app.routes) {
    if (!r.path.startsWith("/api/") || r.method === "ALL") continue;
    const op = openapi.paths[toOpenApiPath(r.path)]?.[r.method.toLowerCase()];
    if (!op) problems.push(`route ${r.method} ${r.path} is not in openapi.yaml`);
  }
  relay.close();

  const msgs = asyncapi.components.messages;
  const kinds = [msgs.photoJob?.payload.properties?.kind?.const, msgs.ladderJob?.payload.properties?.kind?.const];
  const codeKinds = [...JobHeader.shape.kind.values];
  for (const k of codeKinds) if (!kinds.includes(k)) problems.push(`hub job kind "${k}" in code is not in asyncapi.yaml`);
  const contractErrors = msgs.result?.payload.properties?.error?.enum ?? [];
  const codeErrors = JobResult.shape.error.unwrap().options;
  for (const e of codeErrors) if (!contractErrors.includes(e)) problems.push(`hub error "${e}" in code is not in asyncapi.yaml`);
  return problems;
}
