# Flare docs

Everything behind Flare, in the order the work happened: research, product, requirements, brand and design, architecture, engineering, the build, QA. Each role ended with a handoff in [handoffs/](handoffs/). Bugs found along the way are in [BUGLOG.md](BUGLOG.md).

New here? Read the [PRD](product/03-prd.md), then the [system architecture](architecture/01-system-architecture.md), then [security and privacy](architecture/08-security-privacy.md).

## Research and product

| Doc | What it answers |
| --- | --- |
| [Challenge and field scan](research/00-challenge-and-field.md) | The rules, the template, and what 813 Week 1 entries and the Weekend winners did |
| [Business requirements](product/01-brd.md) | Who it's for and why |
| [Market analysis](product/02-market-analysis.md) | What exists and where it falls short |
| [PRD](product/03-prd.md) | What Flare does, feature by feature |
| [Personas and journeys](product/04-personas-journeys.md) | The friends it's built for |
| [Backlog](product/05-backlog.md), [scope](product/06-scope.md), [release plan](product/08-release-plan.md) | What's in, what's out, in what order |
| [KPIs](product/07-kpis.md), [risks](product/09-risks.md), [glossary and decisions](product/10-glossary-and-decisions.md) | How we measure it, what could go wrong, what words mean |

## Requirements

| Doc | What it answers |
| --- | --- |
| [SRS](requirements/01-srs.md) | Every requirement, numbered (SRS-*) |
| [Use cases](requirements/02-use-cases.md), [business rules](requirements/03-business-rules.md) | The flows and the rules (BR-*) the engine follows |
| [Data flow and dictionary](requirements/04-data-flow-and-dictionary.md) | What data exists, where it goes, when it's deleted |
| [Traceability matrix](requirements/05-rtm.md) | Requirement to code to test |

## Brand, design and content

| Doc | What it answers |
| --- | --- |
| [Brand strategy](brand/01-strategy.md), [name check](brand/02-name-check.md), [brand book](brand/03-brand-book.md), [contrast table](brand/contrast-table.md) | The name, the flame, the colors |
| [Design brief](design/01-brief-and-ux-scan.md), [flows](design/02-flows-and-ia.md), [wireframes](design/03-wireframes.md), [hi-fi screens](design/04-hifi-screens.md) | Every screen and how you get there |
| [Design system](design/05-design-system.md), [motion](design/motion.md), [website](design/06-website.md) | Tokens, components, the flame's motion |
| [Accessibility](design/07-accessibility.md), [focus order](design/07-annex-focus-order.md) | VoiceOver, low vision, limited mobility |
| [Voice and tone](content/01-voice-and-tone.md), [copy deck](content/02-copy-deck.md) (generated), [checks](content/03-checks.md) | Every user-facing string, checked by copy-lint |
| [Privacy statement](content/04-privacy-statement.md), [accessibility statement](content/05-accessibility-statement.md), [channels](content/06-channels.md) | What we promise users |

## Architecture

Start at the [architecture index](architecture/README.md). Highlights:

| Doc | What it answers |
| --- | --- |
| [System architecture](architecture/01-system-architecture.md) | Phone, server, laptop hub, Telegram, and why |
| [Security and privacy](architecture/08-security-privacy.md) | The group key in the link fragment, sealing, deletion |
| [Offline, sync and AI](architecture/07-offline-sync-and-ai.md) | The AI tiers and the outbox |
| [ADRs](architecture/adr/README.md) | 23 decisions, each with its reason |
| [Contracts](architecture/contracts/) | openapi.yaml, asyncapi.yaml, Telegram, plain-text SMS |
| [Performance budgets](architecture/10-performance-budgets.md), [testing strategy](architecture/12-testing-strategy.md), [observability](architecture/09-observability.md) | The numbers we hold ourselves to |

## Engineering and the build

| Doc | What it answers |
| --- | --- |
| [Engineering index](engineering/README.md) | Work breakdown, interfaces, spikes, process |
| [Interface control](engineering/02-interface-control.md) | The 14 interfaces that let nine specialists build at once |
| [Spikes](engineering/03-spikes.md) | Relay under loss, deletion timing, the iOS compass |
| [Device checklist](engineering/05-device-checklist.md), [deploy runbook](engineering/06-deploy-runbook.md) | Field-test morning, step by step |
| [Core engine](engine/01-algorithm.md) | Quorum, conditions, Ember, the smaller plan |
| [Backend](backend/01-service-design.md), [deletion](backend/02-retention-and-deletion.md), [deletion proof](backend/03-deletion-correctness.md), [running the server](backend/04-running-the-server.md) | The server and how it forgets |
| [Integrations](integrations/README.md) | Telegram bot, Web Push, link previews, plain-text SMS |
| [ML](ml/README.md): [model selection](ml/model-selection.md), [eval results](ml/eval-results.md), [failure modes](ml/failure-modes.md), [AI safety](ml/ai-safety.md) | Which Gemma, measured how, and where it fails |
| [On-device AI](ai-runtime/README.md) | What runs on the phone, and what we measured but didn't ship |
| [Maps](maps/README.md) | OpenStreetMap packs, places, compass, Bench to Bench, Fix the map |
| [PWA](pwa/README.md), [PWA test report](pwa/test-report.md) | Install, offline, the service worker |
| [Website](website/README.md) | The five public pages and Lighthouse 100 |

## QA

| Doc | What it answers |
| --- | --- |
| [Field-path QA](engineering/qa/01-field-path-qa.md) | Every field-test step on the real stack, with results |
| [BUGLOG](BUGLOG.md) | Every bug, how it was found, how it was fixed |

## Handoffs

One per role, in order: [product](handoffs/01-product.md), [analyst](handoffs/02-analyst.md), [brand](handoffs/03-brand.md), [product design](handoffs/04-product-design.md), [motion](handoffs/05-motion.md), [copy](handoffs/06-copy.md), [core engine](handoffs/06b-core-engine.md), [backend](handoffs/06c-backend.md), [integrations](handoffs/06d-integrations.md), [ML](handoffs/06e-ml.md), [on-device AI](handoffs/06f-on-device-ai.md), [maps](handoffs/06g-maps.md), [architect](handoffs/07-architect.md), [frontend](handoffs/07a-frontend-app.md), [PWA](handoffs/07b-pwa-offline.md), [website](handoffs/07c-website.md), [engineering lead](handoffs/08-engineering-lead.md). [RESUME.md](handoffs/RESUME.md) is the running log for picking work back up after a pause.
