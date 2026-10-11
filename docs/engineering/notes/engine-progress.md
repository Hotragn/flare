# Core engine progress (wp/engine)

Brief: docs/engineering/briefs/6b-core-engine.md. Handoff: docs/handoffs/06b-core-engine.md.

## Done (Sat 2026-10-10)
- `packages/engine` (`@flare/engine`): solver, Flare F1 to F14, Plan P1 to P11, Ember pick, arrivals, view, create helpers, BE7 rules (Sparks tickets, Hot spots merge).
- 141 engine tests incl. property tests INV-1 to INV-10 (300 cases each) and the B14 bench test; coverage lines 100%, branches 96.8%.
- Bench: p50 0.022 ms, p99 0.06 ms (budget 5 ms).
- Docs: docs/engine/01-algorithm.md, 02-api.md; bugs: docs/engineering/bugs/engine.md; handoff 06b.
- `npm run ci` green (193 tests in the repo).

## In progress
- Nothing.

## Exact next step
- None in the brief. If ICR-1 (counter `by`/`op`) is accepted, change the three counters in `end()` in packages/engine/src/transition.ts and their test in flare.test.ts "F9".
