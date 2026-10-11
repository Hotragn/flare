# Core engine progress (wp/engine)

Brief: docs/engineering/briefs/6b-core-engine.md. Handoff: docs/handoffs/06b-core-engine.md.

## Done
- Package skeleton `packages/engine` (`@flare/engine`), time helpers, solver (`src/solve.ts`).

## In progress
- Flare transitions F1 to F14 (`src/transition.ts`).

## Exact next step
1. Write `src/transition.ts` (Flare rows first, then Plan rows), `src/view.ts`, `src/create.ts`, `src/index.ts` exporting `engine`.
2. Tests per row in `packages/engine/test/`, property tests (fast-check), benchmark, coverage.
3. Docs: docs/engine/01-algorithm.md, 02-api.md; handoff 06b.
