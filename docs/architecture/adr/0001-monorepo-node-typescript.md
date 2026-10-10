# ADR-0001: npm workspaces monorepo, TypeScript run directly by Node

Status: Accepted. Date: 2026-10-10.

## Context
Four parts share code: the server, the hub, the web app and the shared rules (photo prompt and `enforce()`, short codes, plain-text forms, hub protocol). The team has under 40 hours to the deadline and wants the fewest moving parts.

## Decision
- One repository, npm workspaces: `packages/shared`, `apps/server`, `apps/hub`, `apps/web`.
- TypeScript 6.0.3, strict, with `erasableSyntaxOnly`, `verbatimModuleSyntax`, `allowImportingTsExtensions`.
- Node 24.21.0 LTS ("Krypton") in production and CI (`.nvmrc`, `engines >=24.21.0`). Node strips types itself, so the server and hub run `.ts` with no build step and no bundler. Imports carry the `.ts` extension.
- Vitest 5.0.3 for tests, Biome 2.5.15 for lint and format, PGlite 0.5.8 for an in-memory Postgres in tests.

## Versions checked (npm, 2026-10-10)
typescript 6.0.3 (7.0.2 exists, but SvelteKit 3.0.1 pins `typescript ^6`), hono 4.13.13, @hono/node-server 2.1.4, ws 8.22.0, pino 10.4.0, zod 4.6.5, pg 8.23.1, vitest 5.0.3, @biomejs/biome 2.5.15, playwright-core 1.64.0, @redocly/cli 2.62.1, @asyncapi/parser 3.6.3.

## Consequences
- No `tsc` build, no source maps to ship; stack traces point at the real files.
- Parameter properties, enums and namespaces are not allowed (not erasable). BUG-020 records the one we hit.
- Proof: `npx -y node@24.21.0 node_modules/vitest/vitest.mjs run` passes 38 tests; the same on Node 26.8.1.

## Options weighed
| Option | Why not |
| --- | --- |
| pnpm or Turborepo | One more tool to install on a clean machine (SRS-MNT-3) for 4 packages |
| tsc or esbuild build step | Adds a dist folder and a watch process; type stripping does the job |
| TypeScript 7 (native) | Not accepted by SvelteKit 3.0.1's peer range |
