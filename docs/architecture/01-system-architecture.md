# Flare: System architecture

Version 1.0, Sat 2026-10-10. Owner: Architect. Structure: arc42 sections 1 to 9, condensed, with C4 diagrams (context, containers, components) and a deployment diagram. Decisions are in [adr/](adr/README.md); contracts in [contracts/](contracts/).

## 1. Goals and constraints

| Goal | Measure | Source |
| --- | --- | --- |
| Friends answer in private | No response shows who said yes or when | BR-Q-5, SRS-RES-4 |
| The server can't read what friends share | No readable name, place, coordinate, photo or condition from a link group reaches the server or its logs | FR-PRIV-1, ADR-0008, ADR-0009 |
| Everything about a gathering is gone 5 min after it ends | Deletion audit prints 0 | BR-D-1, SRS-PRIV-5 |
| Fast on an iPhone 13 | Link page interactive ≤ 2.0 s on 4G; ≤ 150 KB gzipped JS | SRS-PERF-1, -2 |
| Works with no signal once lit | Lit screen and compass in airplane mode | SRS-OFF-2 |
| Open models only | Gemma 4 E4B on our Mac via Ollama | BRD constraint |

Constraints: no accounts; four test iPhones with unknown iOS versions (capability detection only); one weekend; every public action waits for the founder.

## 2. Context (C4 level 1)

```mermaid
flowchart LR
  host([Host<br/>iPhone, Safari or Home Screen app])
  friend([Friend<br/>link page, maybe low vision<br/>or limited mobility])
  textonly([Text-only friend<br/>SMS or satellite])
  op([Operator<br/>the team])
  subgraph flare [Flare system]
    sys[Flare<br/>app, server, hub]
  end
  tg[[Telegram Bot API]]
  push[[Apple and browser<br/>push services]]
  osm[[OpenStreetMap<br/>Overpass, build time only]]
  render[[Render<br/>hosting]]
  host -- photo, quorum, Plan, Done --> sys
  friend -- yes, rules, fade, I'm here, Spark --> sys
  sys -- live count, Lit, compass target --> friend
  textonly -. "FLARE K7Q2M ... / IN K7Q2M, via the host" .- host
  sys <-- webhook, posts, edits, deletes --> tg
  sys -- sealed notices --> push --> friend
  osm -. map pack, refreshed by script .-> sys
  sys -- runs on --> render
  op -- deploy, audit, KPI export --> sys
```

## 3. Containers (C4 level 2)

```mermaid
flowchart TB
  subgraph phone [Phone: Safari, trust zone P]
    web[Web app<br/>SvelteKit 3, Svelte 5<br/>link page, host app, /check]
    sw[Service worker<br/>precache, push, outbox flush]
    idb[(IndexedDB<br/>keys, tokens, needs profile,<br/>saved Lit data, outbox)]
    pack[(Map pack<br/>6.7 KB static JSON)]
    web --- idb
    sw --- idb
    web --- pack
  end
  subgraph cloud [Render, trust zone S]
    api[Flare server<br/>Node 24, Hono 4.13<br/>REST, SSE, /hub WebSocket,<br/>Telegram webhook, scheduler]
    db[(Postgres<br/>sealed data, counts,<br/>expires_at everywhere)]
    cron[Sweep cron<br/>every 5 min]
    api --- db
    cron --- db
  end
  subgraph mac [Team Mac, trust zone H]
    hub[Hub<br/>Node 24, ws client]
    ollama[Ollama 0.40.2<br/>gemma4:e4b-it-q4_K_M]
    hub -- localhost HTTP --> ollama
  end
  web -- HTTPS JSON, sealed fields --> api
  web -- HTTPS JPEG 768 px, for the draft only --> api
  api -- SSE --> web
  hub -- outbound WSS, Bearer HUB_SECRET --> api
  api -- Web Push, sealed notice_ct --> pushsvc[[Push services]] --> sw
  api <-- HTTPS --> tg[[Telegram]]
```

| Container | Tech (versions in ADR-0001) | Owns | Never holds |
| --- | --- | --- | --- |
| Web app | SvelteKit 3.0.1 static build, Bits UI 2.19.5, WebCrypto | Keys, sealing, rules parser, needs checks, map pack, compass, outbox | Other members' answers |
| Service worker | SvelteKit `$service-worker` | Precache, push display, outbox flush on open | Anything not already in IndexedDB |
| Flare server | Hono 4.13.13, ws 8.22.0, pg 8.23.1, pino 10.4.0, zod 4.6.5 | State machine, solver, timers, fan-out, bot, deletion | Group keys, readable places, names, conditions, needs, photos (beyond a request) |
| Postgres | Render Postgres | Sealed blobs, answers as rules, counts, tokens as hashes | Columns named lat, lon, spot, name (schema test) |
| Hub | Node 24, ws client, no `fs` | AI jobs in memory | Anything on disk |
| Ollama | 0.40.2, GGUF Q4_K_M | The model | Request history |

## 4. Components of the server (C4 level 3)

```mermaid
flowchart LR
  subgraph server [apps/server]
    http[HTTP routes<br/>app.ts, zod validation,<br/>member auth, idempotency,<br/>rate limits]
    sse[Live fan-out<br/>SSE per gathering]
    engine[Gathering engine<br/>state machine, solver,<br/>BR-F, BR-P, BR-S, BR-E]
    sched[Scheduler<br/>jobs table, 1 s tick,<br/>rebuild at boot]
    sweep[Sweeper<br/>Gone and expired rows,<br/>every 30 s]
    relay[Hub relay<br/>hub/relay.ts]
    bot[Telegram bot<br/>webhook, posts, edits, deletes]
    pushc[Push sender<br/>web-push, VAPID]
    audit[Audit and counters]
    repo[(Repository<br/>db/db.ts, SQL)]
  end
  http --> engine
  http --> relay
  http --> audit
  engine --> repo
  engine --> sse
  engine --> pushc
  engine --> bot
  sched --> engine
  sweep --> repo
  bot --> engine
  audit --> repo
```

| Component | Path | Rules it implements | Built now |
| --- | --- | --- | --- |
| HTTP routes | `src/app.ts`, `src/routes/*` | SRS-IF-1, SRS-SEC-4, -5, -6 | Health, drafts |
| Hub relay | `src/hub/relay.ts` | ADR-0006, ADR-0011 | Yes, tested |
| Gathering engine | `src/engine/*` (pure functions: `solve()`, `transition()`) | BR-Q, BR-S, BR-F, BR-P, BR-E, BR-H | Engineering |
| Scheduler | `src/engine/scheduler.ts` | BR-F-8, SRS-ST-2 | Engineering |
| Sweeper | `src/db/sweep.ts`, `npm run sweep` | BR-D-1, BR-D-2 | Engineering |
| Live fan-out | `src/live/sse.ts` | SRS-SOL-3 | Engineering |
| Push sender | `src/live/push.ts` | SRS-IF-3, ADR-0014 | Engineering |
| Telegram bot | `src/telegram/*` | contracts/telegram.md | Engineering |
| Audit and counters | `src/audit.ts` | BR-D-7, SRS-PRIV-6 | Engineering |
| Repository | `src/db/db.ts`, `migrations/` | ADR-0004 | Schema, migrate, tests |

The engine is pure: `(state, event, now) → (state, effects)`. Effects (send push, post to Telegram, schedule a job) are executed by the caller after the transaction commits. That keeps the solver deterministic (BR-S-5) and unit-testable without a database.

## 5. Components of the web app

| Module | Path (target) | Job |
| --- | --- | --- |
| Crypto | `src/lib/crypto/seal.ts` | Key import, seal and open with AAD (ADR-0008), place hash |
| Store | `src/lib/store/*.ts` | IndexedDB (idb 8.0.4): keys, tokens, saved Lit data, outbox |
| API client | `src/lib/api/*.ts` | Typed calls per openapi.yaml, idempotency keys, outbox |
| Live | `src/lib/live.ts` | SSE plus 30 s poll, server-time offset |
| Conditions | `src/lib/conditions/parse.ts` | Rules parser (lab 07: 40/40 core), read-back |
| Needs | `src/lib/needs/*.ts` | BR-A-2 checks on the map pack, per label |
| Map | `src/lib/map/pack.ts` | Map pack load, nearest named feature, Ember candidates |
| Compass | `src/lib/compass/*.ts` | Geolocation, orientation, speech, haptics |
| Photo | `src/lib/photo.ts` | 768 px JPEG for the draft (built now) |
| Screens and components | from `design/prototype/src/lib/` | 33 screens, copy deck, tokens, motion |

## 6. Deployment

```mermaid
flowchart TB
  subgraph iphones [4 iPhones on cellular, Dearborn MI]
    safari[Safari or Home Screen app<br/>iOS version found Sunday]
  end
  subgraph renderOhio [Render, Ohio region]
    websvc[Web service flare-outside<br/>Starter, 1 instance, Node 24.21.0<br/>npm start, health /api/v1/health]
    pg[(Render Postgres<br/>internal URL, TLS)]
    cronj[Cron job: npm run sweep<br/>every 5 min]
    websvc --- pg
    cronj --- pg
  end
  subgraph home [Team Mac, home network, behind NAT]
    hubp[npm run hub<br/>caffeinate -dims]
    oll[Ollama :11434 localhost only]
    hubp --> oll
  end
  safari -- "HTTPS 443, *.onrender.com" --> websvc
  hubp -- "WSS 443 outbound" --> websvc
  websvc -- HTTPS --> tgapi[[api.telegram.org]]
  websvc -- HTTPS --> apns[[web.push.apple.com]]
  gh[[GitHub Actions CI<br/>private repo Hotragn/flare]] -. build checks .- websvc
```

| Setting | Value |
| --- | --- |
| Build | `npm ci && npm run build` |
| Start | `npm start` (`node apps/server/src/main.ts`) |
| Env (server) | `PUBLIC_BASE_URL`, `DATABASE_URL`, `HUB_SECRET`, `TELEGRAM_*`, `VAPID_*` (checked by `npm run check-env -- server bot`) |
| Env (hub) | `FLARE_SERVER_URL=wss://…`, `HUB_SECRET`, `OLLAMA_URL`, `OLLAMA_MODEL` |
| TLS | Render-managed certificate; HSTS from the app |
| Instances | 1 (relay and SSE are in memory; ADR-0005) |

Deploying, the cron job, the paid plan and the Telegram webhook all wait for the founder's yes.

## 7. Cross-cutting concepts

| Concern | Approach | Detail |
| --- | --- | --- |
| Privacy | Seal on the phone, labels for places, counts only | [08-security-privacy.md](08-security-privacy.md) |
| Deletion | Cascade, expires_at, sweeper, cron, audit | ADR-0004, [06-erd-and-data-dictionary.md](06-erd-and-data-dictionary.md) |
| Time | Server clock decides; views carry `server_time`; phones display the offset-corrected time | BR-TIME-1 to 3 |
| Idempotency | Every write has a key; outbox retries | ADR-0010 |
| Offline | Service worker, map pack, saved Lit data | [07-offline-sync-and-ai.md](07-offline-sync-and-ai.md) |
| AI | Hub for photos and ladders, rules on the phone | ADR-0007 |
| Errors | Typed `Error.code` per contract; the phone maps codes to copy deck strings | contracts/openapi.yaml |
| Observability | Redacted logs, counters, health, audit | [09-observability.md](09-observability.md) |
| Accessibility | WCAG 2.2 AA, axe in CI for every screen | [12-testing-strategy.md](12-testing-strategy.md) |

## 8. Quality scenarios

| Scenario | Response | Measure |
| --- | --- | --- |
| The Mac sleeps mid-test | Health shows `hub: absent`; drafts return the template in ≤ 6 s; the host types six words | No P0 flow blocked |
| Render restarts during Kindling | Hub reconnects (1 to 30 s); phones' SSE reconnects; scheduler rebuilds timers from `jobs` | Timer fires within 30 s of schedule (SRS-ST-2) |
| A friend loses signal after Lit | Saved Lit data and compass work; taps queue in the outbox | "Offline. Saved at {time}." |
| 12 friends tap within 1 s | Each yes is one transaction with `SELECT … FOR UPDATE` on the gathering; the solver runs in under 5 ms for 12 (exhaustive, BR-S-4) | p95 ≤ 300 ms (SRS-PERF-3) |
| A database row survives Gone | The audit counts it; the cron sweep deletes it within 5 min | Audit 0 |

## 9. Risks and technical debt

| Risk | Mitigation |
| --- | --- |
| iPhone 13 shader frame rate unknown | Frame-time gate falls back to CSS (ADR-0003); measure Sunday |
| iOS Web Push needs Home Screen install | Telegram post and open page carry Lit too (AS-1) |
| One server instance | Fine for the test; LISTEN/NOTIFY path documented in ADR-0005 |
| Telegram groups readable by Telegram | Disclosed before adding the bot (ADR-0013) |
| Free Render Postgres expires in 30 days | Paid plan or recreate; founder decides with the deploy |
