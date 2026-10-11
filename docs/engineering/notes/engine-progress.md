# Core engine progress (wp/engine)

Brief: docs/engineering/briefs/6b-core-engine.md. Handoff: docs/handoffs/06b-core-engine.md.

## Done
- Package skeleton, solver (`src/solve.ts`), transitions F and P (`src/transition.ts`), view, create (F1, P1), Sparks and Hot spots rules (`src/sparks.ts`). Flare rows F1-F14 and Plan rows P1-P11 tested (89 tests); solver cases, Ember, arrivals, view, Sparks and Hot spots (133 tests); property tests INV-1 to INV-10, B14 bench (p50 0.022 ms, p99 0.06 ms), coverage lines 100%, branches 96.8% (141 tests).

## In progress
- Next: docs/engine/01-algorithm.md, 02-api.md, handoff 06b, npm run ci.

## Exact next step
1. Write `src/transition.ts` (Flare rows first, then Plan rows), `src/view.ts`, `src/create.ts`, `src/index.ts` exporting `engine`.
2. Tests per row in `packages/engine/test/`, property tests (fast-check), benchmark, coverage.
3. Docs: docs/engine/01-algorithm.md, 02-api.md; handoff 06b.
