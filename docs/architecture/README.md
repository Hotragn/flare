# Flare architecture

Version 1.0, Sat 2026-10-10. Owner: Architect. Start with the system architecture, then the contracts you build against.

| Doc | What it answers |
| --- | --- |
| [01-system-architecture.md](01-system-architecture.md) | Goals, C4 context, containers, components, deployment, quality scenarios, risks |
| [02-data-flows.md](02-data-flows.md) | Physical DFDs, levels 0 to 2 (photo, conditions, needs, location, deletion), trust zones |
| [03-sequences.md](03-sequences.md) | Nine sequence diagrams: send, answer, light, Ember, Plan and fade, offline arrival, Telegram, Gone, hub |
| [04-state-machines.md](04-state-machines.md) | Flare, Plan, answer and hub machines with transition tables |
| [05-api.md](05-api.md) | API conventions and the endpoint map |
| [06-erd-and-data-dictionary.md](06-erd-and-data-dictionary.md) | ERD, every column, retention, deletion audit mapping |
| [07-offline-sync-and-ai.md](07-offline-sync-and-ai.md) | Offline behaviour, outbox, sync; which AI runs where and its fallbacks |
| [08-security-privacy.md](08-security-privacy.md) | Promises and proofs, honest limits, STRIDE threat model, keys, headers, deletion bounds |
| [09-observability.md](09-observability.md) | What we log and count, and what we never do |
| [10-performance-budgets.md](10-performance-budgets.md) | 18 budgets for the iPhone 13 |
| [11-coding-standards.md](11-coding-standards.md) | Rules for code, enforced where a tool can |
| [12-testing-strategy.md](12-testing-strategy.md) | Test layers, must-have tests by area, definition of done |
| [adr/](adr/README.md) | 20 decision records |
| [contracts/](contracts/) | openapi.yaml, asyncapi.yaml, telegram.md, plain-text.md |
| [evidence/](evidence/) | Saved output: end-to-end hello world |

## Checks

```bash
npm run ci          # secret scan, lint, types, tests, contracts, build, JS budget, diagrams
npm run e2e:hello   # needs Ollama with gemma4:e4b-it-q4_K_M and Google Chrome
```
