# Architecture decision records

Format: Michael Nygard's ADR (status, context, decision, consequences), plus the options we weighed with numbers. One decision per file. A decision changes only by a new ADR that supersedes it.

| ADR | Decision | Status |
| --- | --- | --- |
| [0001](0001-monorepo-node-typescript.md) | npm workspaces monorepo, TypeScript 6.0.3 run directly by Node 24.21.0 LTS | Accepted |
| [0002](0002-web-ui-sveltekit-bits-ui.md) | SvelteKit 3 + Svelte 5 + Bits UI for the app and link page | Accepted |
| [0003](0003-motion-webgl-flame.md) | WebGL2 shader flame with a CSS fallback; sound on by default with a remembered mute | Accepted |
| [0004](0004-storage-postgres.md) | PostgreSQL, not MongoDB Atlas | Accepted |
| [0005](0005-hosting-render-https.md) | One Render web service plus Render Postgres; HTTPS from day one | Accepted |
| [0006](0006-hub-outbound-relay.md) | The Mac hub dials out to the server over a WebSocket | Accepted |
| [0007](0007-ai-placement.md) | Photo AI on the hub, conditions by rules on the phone, templates as the floor | Accepted |
| [0008](0008-group-key-and-sealing.md) | Group key in the link fragment; AES-256-GCM sealing on the phone | Accepted |
| [0009](0009-no-places-on-server.md) | No coordinates or readable places on the server (OQ-1, variant B), opaque labels | Accepted |
| [0010](0010-offline-first.md) | Service worker, static map pack, outbox with idempotency keys | Accepted |
| [0011](0011-hub-photos-in-memory.md) | Photos for the AI live only in memory, proven by test | Accepted |
| [0012](0012-plain-text-ascii-cut-mark.md) | Plain-text forms cut with "..." to stay GSM-7 | Accepted |
| [0013](0013-telegram-readable-posts.md) | Telegram groups get readable posts, disclosed; the bot never reads free text | Accepted |
| [0014](0014-live-updates-sse-and-sealed-push.md) | SSE for live views, Web Push with a sealed notice | Accepted |
| [0015](0015-forget-this-group.md) | "Forget this group" removes your data; the last member removes the group | Accepted |
| [0016](0016-fades-and-min-step.md) | After a fade nobody is removed; add `min_step`; private "Still coming?" | Accepted |
| [0017](0017-link-previews-safe.md) | Link previews show the brand card and the count, not the photo or words | Accepted |
| [0018](0018-ids-codes-tokens.md) | UUID v4 ids, 5-character short codes, 128-bit write tokens | Accepted |
| [0019](0019-license-agpl.md) | AGPL-3.0-or-later | Accepted |
| [0020](0020-observability.md) | Structured logs with redaction, counters, no third-party telemetry | Accepted |
| [0021](0021-sentry-agent-tracing.md) | Sentry Agent Tracing for the AI path, server side, allow-listed attributes | Accepted |
| [0022](0022-digitalocean-cloud-tier.md) | DigitalOcean Serverless Inference cloud tier: ladders when the hub is absent, photos only by the host's opt-in | Accepted |
| [0023](0023-telegram-card-and-photo-opt-in.md) | Telegram posts show a branded card; real photos only when the group turns them on | Accepted |
| [0024](0024-crew-space.md) | Crew space: stats from counters only; member removal without key rotation for now | Accepted |
| [0025](0025-mastra-plan-agent.md) | Plan ladder as a Mastra agent with local tools, through the existing relay job, behind `LADDER_AGENT=1` | Proposed |
| [0026](0026-google-ai-studio-cloud-tier.md) | Google AI Studio (Gemma 4 26B A4B, thinking minimal) after DigitalOcean; 1 h skip on 401/402/403; one daily cap | Accepted |
| [0027](0027-elevenlabs-voice.md) | ElevenLabs: warm compass voice as 54 pre-recorded clips (no names, offline), and opt-in Voice Spark through Scribe (own voice, 10 s, no audio kept) | Accepted |
| [0028](0028-voice-flares.md) | Voice Flares: say where you are, Gemma 4 on the hub writes the invite from the audio (WAV in Ollama images); hub only, no audio kept | Accepted |
