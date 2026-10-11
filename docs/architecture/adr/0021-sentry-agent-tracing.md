# ADR-0021: Sentry Agent Tracing for the AI path, server side only

Status: Accepted (founder decision, Sun 2026-10-11 02:45 ET). Supersedes the "No Sentry" line of ADR-0020; the rest of ADR-0020 stands.

## Context
The founder wants real traces of the AI path for the DEV post: how often the hub answered, how long it took, when the template took over. ADR-0020 and SRS-PRIV-7 ruled out third-party telemetry so that nothing about people reaches another company.

## Decision
- **Server only.** `apps/server/src/tracing.ts`, `@sentry/node` 11.6.0, started when `SENTRY_DSN` is set. The phone app, the link page and the website load no Sentry code (SRS-PRIV-7 holds for every page).
- **Only AI spans.** `defaultIntegrations: false` and `integrations: []`: no automatic HTTP, database or console capture, so request URLs (which hold ids), headers and bodies are never recorded. The AI routes create spans by hand, following Sentry's agent-tracing names:
  - `invoke_agent flare-photo` and `invoke_agent flare-ladder` (op `gen_ai.invoke_agent`) per job;
  - `chat gemma4:e4b-it-q4_K_M` (op `gen_ai.chat`, provider `ollama`) for the relay round trip to the Mac and Ollama;
  - `execute_tool enforce` and `execute_tool enforce_ladder` (op `gen_ai.execute_tool`) for the guards.
- **Allow-list.** Only these attribute keys leave, and only as numbers, booleans or short tokens: `gen_ai.operation.name`, `gen_ai.agent.name`, `gen_ai.provider.name`, `gen_ai.request.model`, `gen_ai.response.model`, `gen_ai.tool.name`, `flare.job`, `flare.tier`, `flare.ok`, `flare.error`, `flare.fallback`, `flare.valid`, `flare.repaired`, plus Sentry's own `sentry.*` bookkeeping. `beforeSendSpan`, `beforeSendTransaction` and `beforeSend` drop everything else, remove `request`, `user`, `extra`, breadcrumbs, tags and server name, and blank exception messages (the class is kept).
- `sendDefaultPii: false`; `dataCollection.genAI` inputs and outputs off.
- **Proof.** `apps/server/test/tracing.test.ts` runs the real photo and ladder routes with a fake hub and marker text, captures every Sentry envelope in memory, and checks the spans and `flare.tier` arrive while the marker invite, scene, ask line, photo bytes, `/api/v1` URLs, headers, IPs and any UUID do not.
- **Disclosed.** The privacy page gains `site.privacy.l.sentry`.

## Consequences
- Traces show tiers and timings per job, which the post can quote.
- A future span added without the helpers would still be scrubbed by the allow-list; a new attribute must be added to `ALLOWED` on purpose.
