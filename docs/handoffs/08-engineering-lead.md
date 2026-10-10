# Handoff 08: Engineering lead to the nine specialists

From: Engineering lead. Date: Sat 2026-10-10, 20:30 ET. Next: Core engine, Backend, Integrations, ML, On-device AI, Maps, Frontend, PWA and offline, Website, in parallel. RC Sun 10:00 ET.

## Start here

1. Read [docs/engineering/README.md](../engineering/README.md), then your section of [01-work-breakdown.md](../engineering/01-work-breakdown.md).
2. Build against [02-interface-control.md](../engineering/02-interface-control.md) only. Write your own fakes for anything you consume; the types in `packages/shared/src/icd/` keep them honest.
3. Branch `wp/{ID}-{slug}` in your own worktree, PR to `main`, meet the definition of done in [04-dependencies-and-process.md](../engineering/04-dependencies-and-process.md) section 4.
4. Integration points: 01:00, 05:00, 08:00. RC tag 09:30.

## What was delivered

| Path | Contents |
| --- | --- |
| docs/engineering/01-work-breakdown.md | 50 P0 and 4 P1 work packages for the nine specialists, mapped to backlog stories and SRS ids, hours and "done when"; owner load 4.5 to 14 h, 88 P0 hours in total |
| docs/engineering/02-interface-control.md | 14 frozen interfaces with sources of truth, change rules and a fake per consumer |
| packages/shared/src/icd/ | Frozen types: engine, map, conditions, capabilities, client modules. `packages/shared/src/sealed.ts`: zod for the sealed payloads |
| docs/engineering/03-spikes.md | Risk register R1 to R13; lab L01 to L09 cited; E1, E2, E3 run here; 15 iPhone-only measures |
| docs/engineering/04-dependencies-and-process.md | Dependency graph (no build dependency crosses specialists), critical path, integration times, branching, review, definition of done; `.github/pull_request_template.md` |
| docs/engineering/05-device-checklist.md | The Sunday 08:30 list: capability page, flame fps, haptics, Telegram, compass, then the results table and fallbacks |
| `npm run device-check` | One HTTPS address on the Mac for all four phones; saves results to `device-results/` (git-ignored) |
| apps/web/static/check/ | Checklist page, compass check (spike E3), capability page imported from lab spike 04 (vision card and coordinates removed) |
| scripts/spikes/ | relay-faults.ts, deletion-timing.ts, compass-flow.ts |
| Relay fixes | Heartbeat both ways, fail-fast pending jobs, 250 ms first redial (BUG-030, BUG-031) |
| Migration 0002 | Partial index for the sweep |
| docs/BUGLOG.md | BUG-029 root cause and fix; BUG-030 to BUG-032 |

## Proof

| Check | Result |
| --- | --- |
| `npm run ci` | Secret scan 0; lint, types clean; **52 tests** pass; contracts ok; build; JS 62.7 KB of 150; 37 diagrams render |
| E1 relay | Silent half-open link: recovered in 16.1 s (was never); health right after 8.5 s (was wrong for 54.5 s); resets: p95 315 ms (was 6,006 ms), 55/60 AI drafts (was 50/60); 15% loss: 60/60, no false drops |
| E2 deletion | Worst case 90 s after Gone (bound 300 s); 0.28 ms per gathering at 250; 0 orphans; expiry backstop deletes forgotten gatherings |
| E3 compass | 21/21 checks with an iOS-like permission shim, including the no-tap control |
| e2e-hello | 7/7 runs after the zod fix, no CSP violations (evidence: docs/architecture/evidence/e2e-hello.txt) |
| Device kit | Every page loads at 390 px with no sideways scroll, served over HTTPS on the LAN; a test upload saved with no coordinates |

## Decisions in this phase

1. **Heartbeat** 5 s / 12.5 s / 15 s, probe after a timeout (spike E1). Binding for BE and ML.
2. **Sweep** batches of 200 every 30 s, plus the 5-minute cron; partial index (spike E2).
3. **Compass** asks orientation first inside the tap, location second (spike E3).
4. **Zod** runs jitless in the browser (BUG-029).
5. **Map pack v2** must add picnic tables, named natural features and street names, centred on TEST_AREA: lab 05's pack lacks them and sits 733 m east (MP1).
6. **Owner moves** to balance load: BE7 to Core engine; BE9 and BE10 to Integrations; FE5 to On-device AI; FE6 and FE7 to Website.

## Change requests

- **CR-A1 (approved by the manager):** `min_step` in BR-C-1, SRS-COND-1, plus 4 fixture phrases. Rides with OD1.
- **CR-E1 (product, analyst):** drop the hub-tier condition parser (SRS-COND-3, E5-S2). Conditions never leave the phone (founder brief). Lab 07 shows rules at 40/40 core, so the hub would add little. Close SRS-COND-3 as "not built, by decision".
- **CR-E2 (product, analyst):** close the phone-tier model requirements (SRS-COND-4, SRS-AI-6, SRS-OFF-6, E8-S3, all P1) as "measured, not shipped" (labs 01, 07, 09; ADR-0007).

## Waiting for the founder (unchanged, each one step)

| Approval | Step when approved |
| --- | --- |
| Render deploy, Postgres, sweep cron | `npm run deploy:render` (BE10 builds it; `--dry-run` first) |
| Telegram webhook | After the Telegram test in the device checklist: `npm run telegram:webhook` (INT3) |
| Repo public | `gh repo rename flare-outside` then `gh repo edit --visibility public --accept-visibility-change-consequences` |

## Things to know

- `lab/` is read-only. The Telegram live test is the lab's own script, run from `lab/` in checklist step 0.
- Spike E1 runs about 7 minutes (`--only silent` for one case). E2 needs about 200 MB of memory.
- `device-results/` holds phone reports and is git-ignored. Commit only the summary table.
- The frontend has the least slack (14 h). If it slips at 05:00, FE2 share-sheet polish and FE8 sound move after RC; the CSS flame is already a valid outcome.
