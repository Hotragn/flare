# Flare: Release plan

Version 1.1: adds the Sunday-morning real Plan (M7b) and the CR-1 features to the field test.

All times ET (EDT, UTC-4). Fixed points: release candidate Sun 10:00 AM; field test Sun 11:00 AM to 3:00 PM; DEV deadline Mon 2:59 AM ET (Sun 11:59 PM PDT, Mon 06:59 UTC). Sunset Sun 6:57 PM.

Roles hand over in order; each milestone ends with a handoff in docs/handoffs/ and a commit.

| # | Milestone | Owner | Done when | Target |
| --- | --- | --- | --- | --- |
| M0 | Field scan | Research | docs/research/00 | Sat (done) |
| M1 | Product requirements | Product | docs/product/01 to 10, handoff 01 | Sat (this) |
| M2 | Analysis: requirement traceability, data and edge cases | Analyst | Every FR traced to a story and test; open questions closed | Sat evening |
| M3 | Brand and UX design | Design | Brand, screens for every story, motion and sound specs, copy deck | Sat night |
| M4 | Architecture and decisions | Engineering lead | Stack chosen with latest stable versions; storage decision (Postgres vs Atlas incl. SSPL); lab spikes reviewed | Sat night |
| M5 | Build P0 | Engineering, AI, maps, PWA | All P0 stories meet AC on a laptop and one iPhone | Sun 8:00 AM |
| M6 | QA and security pass on P0 | QA, Security | P0 AC pass; no high-severity issues | Sun 9:30 AM |
| M7 | Release candidate | Ops | Deployed (after founder's yes) to an unlisted HTTPS URL; bot in "Flare test" only; `/check` run on all four phones | **Sun 10:00 AM** |
| M7b | Real Plan sent: "Fairlane walk at 11?" with deadline about 10:40 AM | Founder | Plan reaches Lit or Gone; result recorded | **Sun about 10:10 AM** |
| M8 | Field test: the Plan's walk, Flares, an Ember on purpose, a Bench to Bench card walk, a Fix the map draft, Sparks then a repeat Flare to show history | Everyone | Checklist complete; KPI export saved; consent recorded | **Sun 11 AM to 3 PM** |
| M9 | Fixes and P1 (phone tier, rest loop, Fix the map, live location, text relay) | Engineering | P1 stories meet AC; field bugs logged in BUGLOG. Rest loop and Fix the map should be ready by 10 AM if possible so they're tested outside | Sun 7:00 PM |
| M10 | Deletion audit and metrics | Ops, Security | Audit prints 0 rows; KPI table final | Sun 7:30 PM |
| M11 | Website and docs final | Docs | Five pages live (after yes); README notes any post-deadline commits rule | Sun 9:00 PM |
| M12 | DEV post draft | Docs, Product | Template followed; tables; what broke; agent session embedded | Sun 10:30 PM |
| M13 | Founder review and publish | Founder | Founder says yes; published | **Before Mon 2:00 AM** (1 h buffer) |

## Gates

- **Go/no-go for the field test (Sun 10:00 AM):** E1, E2, E3, E4-S1, E6-S2, E7-S1, E9-S1, E10, E15-S1 to S4 pass AC on at least two of the four phones. If not, test what works and record what didn't; the post reports it.
- **Publish gate:** deletion audit output, KPI table, tier table, consent checklist all present.

## Approvals needed from the founder (asked one at a time, each prepared as one step)

1. Deploy the release candidate to Render (unlisted URL).
2. Allow the bot beyond "Flare test" (not planned this weekend).
3. Make the GitHub repo public (needed for the post's Code section).
4. Deploy the website.
5. Publish the DEV post.
6. Upload the demo video and make the agent session public.
