# Flare: Coding standards

Version 1.0, Sat 2026-10-10. Owner: Architect. Enforced by `npm run ci` where a tool can check it; the rest is review.

## 1. Language and layout

| Rule | Check |
| --- | --- |
| TypeScript 6.0.3 strict, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `erasableSyntaxOnly`: no enums, namespaces or parameter properties | `tsc --noEmit` |
| Imports carry their extension (`./relay.ts`); web uses `#lib/*` | tsc, svelte-check |
| ES modules only; Node built-ins as `node:fs` | Biome |
| One job per module; pure logic (solver, transitions, parser, needs checks) has no I/O and takes `now` as a parameter | Review |
| Shared rules live in `packages/shared` and are imported, never copied | Review |
| Biome 2.5.15 `recommended`, 2-space indent, 120 columns, double quotes, semicolons | `biome check .` |
| `console.log` only in `scripts/`; services use the pino logger | Biome `noConsole` |

## 2. Contracts first

- A new endpoint or message starts as a change to `docs/architecture/contracts/`. The pull request carries contract, zod schema, handler and tests together. `npm run contracts` fails if a route is missing from openapi.yaml.
- Every request body is parsed with zod; unknown fields are rejected (`.strict()`), every string has a max length.
- Errors use `apiError(c, status, code, message)` with a `code` from the contract's list. Never echo input in `message`.

## 3. Privacy rules in code

1. Never log a request body, header, id, code, name, place, coordinate, condition or fragment. Log route templates and event names.
2. Never add a column that holds a readable place, name or coordinate (schema test).
3. Never send free text off the phone; parse on the phone, send the rule.
4. Seal with `seal(key, aad, bytes)`; the AAD names the field and its owner id (ADR-0008).
5. No `{@html}` with anything that came from a person or the network.
6. No third-party script, font, analytics or CDN at runtime.
7. Buffers holding readable photos are zero-filled in `finally`.

## 4. Data and time

- All transitions take the server's `now`; no `Date.now()` inside the engine.
- SQL uses parameters (`$1`), never string building. Multi-row changes run in one transaction with `SELECT … FOR UPDATE` on the gathering row.
- Every per-gathering table has `expires_at` and cascades from `gatherings`.
- Writes are idempotent by key.

## 5. Errors and resilience

- Every network call has a timeout (hub 6 s or 8 s, Telegram 10 s, push 10 s, Ollama 30 s).
- External failures degrade to the next option (template, open page, retry queue), never block a P0 flow (SRS-COMP-2).
- No silent catch: either handle and log an event, or let it reach the error handler.

## 6. UI code

- Text from the copy deck through `t()`; buttons ≤ 3 words, messages ≤ 12 words (copy-lint).
- Role tokens, never raw hex (design rule 2); motion tokens only, so reduced motion turns it off.
- Native elements first; Bits UI for dialogs and toggle groups; touch targets ≥ 44 px.
- Capability detection, never user-agent sniffing (SRS-AI-5).

## 7. Tests and commits

- A bug fix lands with a test that fails without it.
- Test names state the rule: "deleting a gathering removes every per-gathering row (BR-D-1)".
- Commit messages: imperative summary, a body that says why, and the requirement id when there is one.
- No TODO comments in merged code: open an issue or finish it.

## 8. Versions

Exact versions in `package.json` (no `^`), latest stable checked on npm before adding, recorded in ADR-0001. GitHub Actions pinned by commit SHA.
