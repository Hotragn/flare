# Flare: Interface control document

Version 1.0, frozen Sat 2026-10-10 19:30 ET. Owner: Engineering lead. Every boundary between two work packages is listed here with its single source of truth. A specialist builds against these and nothing else, so all nine can work at once.

## 1. The interfaces

| ICD | Interface | Provider | Consumers | Source of truth (frozen) | Checked by |
| --- | --- | --- | --- | --- | --- |
| 1 | Core engine: `solve`, `transition`, `view`, events, effects, errors | CE | BE, INT (effects) | [packages/shared/src/icd/engine.ts](../../packages/shared/src/icd/engine.ts) | `tsc`; engine tests use only exported types |
| 2 | HTTP API: 37 operations, schemas, 25 error codes, auth, idempotency | BE | FE, PWA, ODAI, WEB, INT (Telegram webhook) | [contracts/openapi.yaml](../architecture/contracts/openapi.yaml) v1.0.0 | `npm run contracts` (Redocly strict, route drift check) |
| 3 | Hub relay: hello, job (photo, ladder), result, ping, pong; heartbeat timings | BE (server side), ML (hub side) | each other | [contracts/asyncapi.yaml](../architecture/contracts/asyncapi.yaml) channel `hub`; zod in [hub-protocol.ts](../../packages/shared/src/hub-protocol.ts) | `npm run contracts` (kinds and error codes match) |
| 4 | Live events: SSE `gathering` and `gone`; Web Push payload | BE (SSE), INT (push) | PWA | asyncapi.yaml channels `gatheringEvents`, `push` | Contract tests in BE5 and INT1 |
| 5 | Phone modules: crypto, store, outbox, live; AAD table; sealed payloads | PWA | FE, ODAI, MAP, service worker | [icd/client.ts](../../packages/shared/src/icd/client.ts); zod [sealed.ts](../../packages/shared/src/sealed.ts); [ADR-0008](../architecture/adr/0008-group-key-and-sealing.md) AAD table | `tsc`; sealed.test.ts |
| 6 | Map pack v2 format and place functions | MAP | FE, ODAI (place words), PWA (precache path) | [icd/map.ts](../../packages/shared/src/icd/map.ts) | `tsc`; pack schema test in MP1 |
| 7 | Conditions parser and read-back | ODAI | FE | [icd/conditions.ts](../../packages/shared/src/icd/conditions.ts); fixtures [conditions-60.json](../requirements/fixtures/conditions-60.json) | `tsc`; fixture score in CI |
| 8 | Capability probe and shader gate | ODAI | FE, PWA | [icd/capabilities.ts](../../packages/shared/src/icd/capabilities.ts) | `tsc` |
| 9 | Database schema and migrations | BE | CE (BE7), INT (bot tables), audit | [migrations/](../../apps/server/src/db/migrations/) and [06-erd-and-data-dictionary.md](../architecture/06-erd-and-data-dictionary.md) | db.test.ts (forbidden columns, expiry columns, cascade) |
| 10 | Telegram bot behaviour, callback data, copy | INT | founder (setup), BE (engine events) | [contracts/telegram.md](../architecture/contracts/telegram.md) | T-TG-1 against a fake Bot API |
| 11 | Plain-text SMS forms and reply parsing | shared (done) | FE (share sheet), BE (text yes) | [contracts/plain-text.md](../architecture/contracts/plain-text.md), [plaintext.ts](../../packages/shared/src/plaintext.ts) | 8 tests |
| 12 | Copy deck: every user-facing string by key | Copy owner (lead holds it this phase) | FE, WEB, INT (bot), PWA (push text) | [deck.json](../../design/prototype/src/lib/copy/deck.json) | copy-lint (keys, lengths, banned words) |
| 13 | Design tokens and components | Design (done) | FE, WEB | [design/system/tokens.css](../../design/system/tokens.css), [prototype components](../../design/prototype/src/lib/components/) | svelte-check, axe |
| 14 | Environment settings | Lead | every service | [scripts/lib/env-spec.ts](../../scripts/lib/env-spec.ts), `.env.example` | `npm run check-env`, 4 tests |

## 2. Rules every interface follows

| Topic | Rule | Where it's defined |
| --- | --- | --- |
| Ids | UUID v4 made on the phone; tokens 128-bit base64url; short codes 5 characters | ADR-0018 |
| Time | UTC ISO 8601 with milliseconds on the wire; the engine takes `now` as an argument; phones show server time | BR-TIME-1 to 3 |
| Places | Only labels `spot`, `c1` to `c12`, `step:1` to `step:4` cross to the server | ADR-0009 |
| Readable text | Only in sealed fields, except Telegram groups' `telegram` object | ADR-0008, ADR-0013 |
| Errors | `{code, message}` with a code from the contract list; phones show the copy deck string for the code | openapi.yaml `Error` |
| Effects | The engine returns effects; only BE executes them, after commit | ICD-1 |
| Logs | Route template, status, ms, fixed event names; nothing else | 09-observability.md |

## 3. Who can change what

1. **Frozen means frozen.** Until RC (Sun 10:00), an interface changes only for a defect, never for convenience.
2. A change is a pull request labelled `icd-change` that edits the source of truth, this document's version line, and every affected consumer's fake in the same PR.
3. The engineering lead approves it; each consumer owner acknowledges in the PR. Target: 20 minutes from open to merge.
4. Additive changes (a new optional field, a new error code) need only the lead. Removing or renaming anything needs every consumer.
5. `npm run contracts` and `tsc` must pass. They fail if code and contract drift.

## 4. Working without waiting: fakes

Every consumer builds against a fake of each interface it uses, written by the consumer, typed by the ICD:

| Consumer needs | Fake to write | Typed by |
| --- | --- | --- |
| The engine (BE before CE lands) | `fakeEngine: Engine` that lights at quorum with no rules | ICD-1 |
| The API (FE, PWA, ODAI, WEB) | In-memory handler set on `fetch` for the routes you call, built from openapi.yaml examples and schemas | ICD-2 |
| The hub (BE) | Already in tests: `apps/server/test/app.test.ts` fake hub socket | ICD-3 |
| SSE (PWA) | A `ReadableStream` that emits `gathering` events | ICD-4 |
| Crypto, store, outbox (FE) | Pass-through `seal` (JSON, base64url) and a `Map`-backed store | ICD-5 |
| Map functions (FE, ODAI) | Return fixed places from the lab 05 pack | ICD-6 |
| Parser (FE) | Returns one fixed rule and read-back | ICD-7 |
| Capabilities (FE, PWA) | A constant object | ICD-8 |
| Ollama (ML) | Already in tests: `apps/hub/test/hub.test.ts` | ICD-3 |
| Telegram Bot API (INT) | A `node:http` server recording calls | ICD-10 |

Fakes live next to the consumer's tests (`test/fakes/`), never in production code. At each integration point (05:00 and 08:00) the lead swaps fakes for the real modules on `main` and runs the end-to-end suite.

## 5. Interface details not in the contract files

These were decided in the engineering phase and are binding:

| Item | Decision |
| --- | --- |
| Hub heartbeat | Server pings every 5 s; drops a silent hub after 12.5 s or 3 s after a job timeout; the hub drops a silent server after 15 s; first redial 250 ms (spike E1, BUG-030) |
| Sweep SQL and index | `DELETE ... WHERE id IN (SELECT ... WHERE (state='gone' AND state_since < now() - '60 s') OR expires_at < now() LIMIT 200)`, repeated until fewer than 200; partial index `gatherings_gone` (spike E2, migration 0002) |
| Compass permission order | `DeviceOrientationEvent.requestPermission()` is the first call in the tap handler, before any `await`; location second (spike E3) |
| Zod in the browser | `z.config({ jitless: true })` before any parse, imported by the root layout (BUG-029) |
| Engine package | `packages/engine`, name `@flare/engine`, exports `engine: Engine` |
| Map pack path | `apps/web/static/maps/fairlane.json`, served at `/maps/fairlane.json` |
| Device-check pages | `apps/web/static/check/` (capability, compass); kit server `npm run device-check` |
