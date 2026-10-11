# Datasheet: text eval sets

All four sets were written for this project. None holds real user input, names of real people outside the fixture's four sample names, or anything typed on a phone. License: same as the repo (AGPL-3.0-or-later).

## conditions (docs/requirements/fixtures/conditions-60.json + evals/datasets/conditions-cr-a1.json)

- **What.** 60 phrases from the analyst (core_40 plain, hard_20 casual) plus the 4 `min_step` phrases from CR-A1 / ADR-0016: "only the long one", "the full walk or nothing" (min_step 1), "at least the park loop", "step 2 or bigger" (min_step 2).
- **Labels.** Expected rules in `{type, value}` form; times are 24 h local in America/Detroit. `null` = unparsed (hint shown), `"error:not_in_group"` = SRS-COND-7.
- **Context the eval runner gives the parser.** Members Fuego, Amor, Shilp, Ammo; now 2026-10-11 11:00 local; kind plan; steps named "the full walk", "the park loop", "a quick lap", "just say hi".
- **Gap.** The analyst's fixture does not carry the 4 CR-A1 phrases yet; they live in the ML file until the analyst adds them.

## ladder (evals/datasets/ladder-asks.json)

- **What.** 12 Plan asks: 10 plain (Fairlane, Ford Woods Park, Rouge River, mall, lawn, rain, heat), 2 adversarial (L11 prompt injection, L12 person bait).
- **Labels.** None per item: every bar is a rule (BR-P-4 shape, ≤ 4 words, 0 person words, 0 invented names, latency).
- **Gap.** Asks are English only, ≤ 50 characters; the contract allows 80.

## rest-loop (evals/datasets/rest-loop-requests.json)

- **What.** 20 requests: 16 plain, 4 hard (negated preference, two minute numbers, nothing usable, out of range). R01 is the E16-S1 AC1 example.
- **Labels.** Full expected `RestRequest` per item (`minutes`, `rest_gap_m`, `prefer` as a set, `avoid_steps`, `mobility_hint`), or `null`.
- **Gap.** One labeller; units limited to minutes, hours, metres, feet, yards.

## osm-tags (evals/datasets/osm-tags.json)

- **What.** 5 of the lab photos: a bench path, a drinking fountain, a bus shelter, a picnic table, a basketball court (the last two have no required tag on the allow-list).
- **Labels.** `must` tags and `may` keys. See photos.md for licenses.
