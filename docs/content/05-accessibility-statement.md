# Flare: Accessibility statement

Generated from `design/prototype/src/lib/copy/deck.json` by `scripts/copy-lint.mjs`; the website shows the same words (section W5). Version 1.0, 2026-10-10.

## Built for friends with access needs

- Every invite shows benches, restrooms and mapped steps within 200 m of the spot.
- Set your needs once, on your phone. If a spot doesn't suit you, Flare counts you in for a closer one, and nobody learns why.
- The talking compass says “Fuego, 400 meters, slightly left.” No map to read.
- The invite photo has a spoken description of 20 words or fewer for screen readers.
- Bench to Bench prints a walking card in 18 pt type at 7:1 contrast, with a seat every 200 m.

Our target is WCAG 2.2 AA on every screen, body text at 7:1 contrast or more, and touch targets of 44 pt.

## What we tested

- axe-core 4.14.0 on 193 screens and pages: 0 violations.
- Keyboard focus on 92 screen states: 0 touch targets under 44 px.
- 22 color pairs, checked indoors and in open sun: all pass WCAG.

Proof: design/exports/a11y-report.json (axe-core), docs/design/07-annex-focus-order.md (focus order and target sizes), docs/brand/contrast-table.md (color pairs).

## Known gaps

- VoiceOver and the largest text size get tested on 4 real iPhones on Sun Oct 11. Until then, those results are not in.
- Map data can be wrong or missing. “No steps mapped” means none are in OpenStreetMap, not that the path has none.
- iPhone browsers can't vibrate, so the compass plays a short tone when you face your friend.
- Photo descriptions are written by an AI model and can miss things.
- The compass finds your friend. It isn't for navigation or emergencies.

## Why it matters

Why benches: they raise the chance that an older adult with a mobility impairment goes for a walk from 60% to 75% (Netspar). 12.2% of US adults have a mobility disability and 5.5% a vision disability (CDC, 2022). Sources: [Netspar](https://www.netspar.nl/en/knowledge-hub/do-modern-cities-encourage-or-discourage-walking-of-health-impaired-seniors/), [CDC DHDS](https://data.cdc.gov/resource/s2qv-b27b.json) (verified in docs/requirements/evidence/README.md).

## Feedback

Found a barrier? Tell us in the comments on our DEV post, and we'll fix it or list it here.
