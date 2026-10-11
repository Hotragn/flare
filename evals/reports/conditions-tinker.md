# Eval: conditions (Tinker LoRA, then rules taught by it)

The fine-tune showed us what people say; we taught the phone's rules, so the words still never leave the phone.

Base model: Qwen/Qwen3.5-4B (Apache-2.0). LoRA rank 32, 92 steps on 3000 synthetic examples. Date: 2026-10-11. Scoring: same() from evals/harness/tasks/conditions.ts, called through ml/tinker/rules_bridge.ts.

| Set | Rules before | Rules after | Qwen3.5-4B zero-shot | LoRA v1 (label bug) | LoRA v2 |
| --- | --- | --- | --- | --- | --- |
| core_40 | 40/40 | 40/40 | 23/40 | 37/40 | 40/40 |
| hard_20 | 18/20 | 20/20 | 10/20 | 18/20 | 19/20 |
| cr_a1_min_step | 4/4 | 4/4 | 0/4 | 4/4 | 4/4 |
| fresh_hard_40 | 15/40 | 40/40 | 20/40 | 38/40 | 38/40 |
| blind_40 | 20/40 | 30/40 | 25/40 | not run | 38/40 |

- core_40, hard_20: docs/requirements/fixtures/conditions-60.json. cr_a1_min_step: evals/datasets/conditions-cr-a1.json.
- fresh_hard_40: evals/datasets/conditions-fresh-40.json, 40 phrasings written by a separate agent blind to the training templates. Held out from the LoRA. It was then used to pick the new rules families, so **for "Rules after" it is a dev set**, and 40/40 says only that the families cover it.
- blind_40: evals/datasets/conditions-blind-40.json, written by another agent that saw neither the parser, the templates nor fresh_40, before the parser changes, and read only to score. **This is the held-out number for the new rules.**
- Rules before = the app parser at commit be95b6a. Model answers: greedy, 40 tokens max. Base zero-shot moved by one item on core_40 between passes (23 or 24/40) even at temperature 0.
- Synthetic training data as a wider check (3,000 template-labelled texts, not an eval): rules agree with the template label on 44% before and 75.5% after, and on all 212 negatives (plain yes, vague, OR, impossible times, outside names) both before and after.

## What the rules learned (apps/web/src/lib/conditions/rules.ts)

| Family | Example | Rule |
| --- | --- | --- |
| Times | back no later than quarter to 5 | quarter to / quarter past / half past N |
| W1 with | cant go without shilp, tell ammo to come, as long as Amor joins | softer cues; only names in the group, so "tell Mom" is not an error |
| A1 after | im stuck at work until 5, can't do anything til 3 | busy until T means after T |
| A2 after | 2:45 at the earliest, once its past 1:30 | T at the earliest, past T |
| A3 after | once I'm done with lunch around 1 | done with X around T |
| B1 back_by | curfew is 5:30, 5 at the latest, free until 6, wrap up by noon | |
| B2 back_by | got a thing at 3, need to be back for it | event at T plus a back/leave word, no "after" |
| M0-M2 max_walk | half hour walk max, 15 mins walking tops, nothing far | spoken durations; limit word after the minutes |
| S1-S3 steps | sit somewhere close, just wanna say hi, nothing bigger than the park loop | sit / say hi is step 4; named-step limits |
| Plain yes | sure thing, sounds good, bet | |

Each family has unit tests in apps/web/test/ai/conditions-families.test.ts, including the parse time (under 1 ms per phrase over core, hard and fresh).

## Still missed on blind_40

| Text | Expected | Rules after | LoRA v2 |
| --- | --- | --- | --- |
| is Amor in? then me too | `[{"type": "with", "value": "Amor"}]` | `null` | `[{"type": "with", "value": "Amor"}]` |
| need Shilp there or I'm out | `[{"type": "with", "value": "Shilp"}]` | `null` | `null` |
| cant leave the house till 2 | `[{"type": "after", "value": "14:00"}]` | `null` | `[{"type": "back_by", "value": "14:00"}]` |
| anytime past 1:45 works | `[{"type": "after", "value": "13:45"}]` | `null` | `[{"type": "after", "value": "13:45"}]` |
| start no earlier than 12:30 pls | `[{"type": "after", "value": "12:30"}]` | `null` | `[{"type": "after", "value": "12:30"}]` |
| must be back at my place by half past 5 | `[{"type": "back_by", "value": "17:30"}]` | `null` | `[{"type": "back_by", "value": "17:30"}]` |
| dont wanna walk more than 25 mins | `[{"type": "max_walk", "value": 25}]` | `null` | `[{"type": "max_walk", "value": 25}]` |
| park loop at minimum, not doing the tiny stuff | `[{"type": "min_step", "value": 2}]` | `null` | `[{"type": "min_step", "value": 2}]` |
| yesss lets go | `[]` | `null` | `[]` |
| in if jake's coming | `"error:not_in_group"` | `null` | `"error:not_in_group"` |

These are left as they are on purpose: tuning on blind_40 would spend the only held-out set. Write a new blind set before teaching the rules any of them.

## LoRA misses on the other sets

- hard_20: "sit somewhere close" expected `[{"type": "max_step", "value": 4}, {"type": "max_walk", "value": 10}]`, got `[{"type": "max_walk", "value": 10}]`
- fresh_hard_40: "back no later than quarter to 5" expected `[{"type": "back_by", "value": "16:45"}]`, got `[{"type": "back_by", "value": "17:15"}]`
- fresh_hard_40: "half hour walk max" expected `[{"type": "max_walk", "value": 30}]`, got `[{"type": "max_step", "value": 3}]`

## Read this before trusting the numbers

- The template author (this run) had read core_40 and hard_20. Exact and near copies (token Jaccard >= 0.6) of every eval text were dropped from the training data.
- v1 to v2 was informed by eval errors: v1 failed "after 2" and "earliest 3" because the generator labelled valid hours 13, 14, 19 as unparsed. v2 fixes only that label rule. Both runs are reported.
- The LoRA runs on Tinker's servers. Sending free text there breaks BR-C-9 / SRS-COND-6, which is why the result went into the rules instead.

## Cost

- Training, two runs, 3,132,408 tokens x USD 0.737/M = USD 2.31.
- Eval sampling, 7 passes at about USD 0.013 each: under USD 0.09.
- Total, from token counts and Tinker's published prices: about USD 2.40. The SDK does not return a bill; check the Tinker console for the charged amount.

## Serving

The LoRA is eval-only, served by Tinker sampling; no GGUF or Ollama export. What ships is the rules parser, on the phone, under 1 ms, no network.

Per-item results: `conditions-tinker.json`.
