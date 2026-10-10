## Work package

WP: <!-- e.g. CE1 --> · Requirements: <!-- e.g. SRS-SOL-1, BR-S-1 -->

## What changed

## How it was tested

<!-- Commands and their output. Screenshots for UI. -->

## Definition of done (docs/engineering/04-dependencies-and-process.md)

- [ ] Built only against frozen interfaces (`tsc`, `npm run contracts` pass)
- [ ] Tests for every rule, named with the rule id; error paths tested
- [ ] `npm run ci` green
- [ ] Privacy rules hold: nothing readable leaves the phone beyond the contract, no new log fields, new tables have `expires_at` and cascade
- [ ] UI: copy from the deck, axe 0 serious or critical, 44 px targets, Reduce Motion, 390 px with no sideways scroll
- [ ] No TODO, stub or fake data in production code
- [ ] RTM rows filled; `docs/engineering/notes/{WP}.md` written; BUGLOG entry for any bug solved
- [ ] `icd-change` label if an interface changed, with consumer acknowledgements
