# Flare engineering

Version 1.0, Sat 2026-10-10. Owner: Engineering lead. The plan to build the P0 release candidate by Sun 10:00 ET.

| Doc | What it answers |
| --- | --- |
| [01-work-breakdown.md](01-work-breakdown.md) | 50 P0 work packages (88 h) for nine specialists, each mapped to backlog stories and SRS ids, with a "done when" bar and owner load (max 14 h) |
| [02-interface-control.md](02-interface-control.md) | 14 frozen interfaces, their sources of truth, change rules and the fakes each consumer writes |
| [03-spikes.md](03-spikes.md) | Risk register; lab spikes cited; engineering spikes E1 (relay faults), E2 (deletion timing), E3 (compass permission); what only the iPhones can tell us |
| [04-dependencies-and-process.md](04-dependencies-and-process.md) | Dependency graph, critical path, integration times, branching, review, definition of done |
| [05-device-checklist.md](05-device-checklist.md) | Sunday 08:30: one ordered list per phone, about 17 minutes |
| [notes/](notes/README.md) | One note per work package as it merges |
| [spikes/evidence/](spikes/evidence/) | Raw spike output |

Commands:

```bash
npm run ci              # what CI runs
npm run e2e:hello       # needs Ollama + Chrome
npm run device-check    # Sunday kit on https://<mac-ip>:8443/check/
node scripts/spikes/relay-faults.ts --seconds 60
node scripts/spikes/deletion-timing.ts
node scripts/spikes/compass-flow.ts
```
