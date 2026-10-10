# Brief 6b: Core engine engineer

Branch `wp/engine`. Ports: none needed. Handoff: docs/handoffs/06b-core-engine.md.

You're a senior engineer with 10 years in algorithms and TypeScript. Build Flare's core logic: how a plan comes together, shrinks or ends, and how everyone's conditions get resolved fairly.

## Own
`packages/engine/**` (new workspace `@flare/engine`, exports `engine: Engine` per packages/shared/src/icd/engine.ts), `docs/engine/**`, `docs/engineering/notes/engine-progress.md`, `docs/engineering/bugs/engine.md`. Also WP BE7's pure rules (Sparks tickets, Hot spots merge-by-max) as functions in the engine; BE stores them.

## Build (WPs CE1 to CE6 + BE7 rules)
- Implement ICD-1 exactly: `solve`, `transition`, `view`. Pure: no I/O, no clock reads (now is an argument), no randomness.
- Rules: BR-Q-*, BR-S-*, BR-C-3 to BR-C-8 plus min_step (CR-A1, ADR-0016), BR-F-*, BR-P-*, BR-E-*, BR-H-*, BR-K-1, BR-K-6. Transition tables F1 to F14 and P1 to P11 in docs/architecture/04-state-machines.md are your test cases. The t0+30:00.000 race (BR-F-2).
- Effects only as data (ICD-1 `Effect`).

## Deliver, all finished
- Algorithm spec with invariants (docs/engine/01-algorithm.md): solver search, fixed point for `with`, ordering BR-S-1, ties BR-S-6, Plan step search, Ember pick, fades, headcount; invariants stated and each tied to a property test.
- The engine package, independent of UI and server.
- Complete tests: every transition row, edge cases, property tests with fast-check 4.10.2, coverage report (vitest v8 coverage; target ≥ 95% lines and branches on packages/engine/src).
- Complexity analysis and a benchmark (12 members × 4 rules × 4 steps must solve ≤ 5 ms, budget B14); record numbers.
- API reference and usage docs (docs/engine/02-api.md), with examples the backend can paste.

Done = all tests green, ICD-1 fully implemented, nothing stubbed. Add `packages/engine` to tsconfig include and vitest include (root files are shared: change only those include lines).
