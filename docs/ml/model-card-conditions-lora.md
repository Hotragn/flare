# Model card: conditions LoRA (Qwen3.5-4B, Tinker)

Status: experiment. Not shipped, not served in the app, weights not published.

## What it does

Reads a friend's reply to an invite ("after 2, only if Amor comes, back by 5") and writes the same rule
JSON the conditions eval scores: a list of `{type, value}` (with, after, back_by, max_walk, max_step,
min_step), `"unparsed"`, or `"error:not_in_group"`. Same contract as the rules parser in
`apps/web/src/lib/conditions` after the eval mapping (evals/harness/tasks/conditions.ts).

## Base model

- `Qwen/Qwen3.5-4B`, the smallest trainable model Tinker lists for this account (2026-10-11).
- License: Apache-2.0 (Hugging Face model card; base of `Qwen/Qwen3.5-4B-Base`).
- Chat template with thinking turned off (`enable_thinking=False`).

## Training data

- 3,000 synthetic examples from `ml/tinker/gen_data.py`, seed 7, fully deterministic.
- Template families per rule type (with, two names, after, back_by, max_walk, steps), joined into 1 to 3
  clauses with casual prefixes and suffixes, plus 18% negatives (plain yes, vague, OR alternatives,
  impossible times, names outside the group).
- Labels come from the templates. The app rules parser is run on every example as a cross-check: it
  agrees on 44% (stats in `ml/tinker/out/data_stats.json`). The rest are phrasings it can't read, which
  is what the LoRA is for.
- Held out and never trained on: core_40, hard_20, CR-A1 min_step_4, fresh_hard_40
  (evals/datasets/conditions-fresh-40.json), blind_40 (written after training). Exact copies and
  near copies (token Jaccard >= 0.6) were dropped: 60 exact, 98 near.
- Group fixed to the eval context: members Fuego, Amor, Shilp, Ammo; Plan steps 1 the full walk,
  2 the park loop, 3 a quick lap, 4 just say hi. Names and steps are also in the system prompt.

## Training config

LoRA rank 32 (attention, MLP and unembedding), AdamW lr 4e-4 linear to 0, beta1 0.9, beta2 0.95, no
weight decay, batch 64, 2 epochs, 92 steps, cross entropy on answer tokens only. About 6 minutes on
Tinker. Final loss per answer token about 0.0001 (`ml/tinker/out/run.json`).

## Eval (greedy decoding)

| Set | Rules before | Rules after | Base zero-shot | LoRA v1 | LoRA v2 (this card) |
| --- | --- | --- | --- | --- | --- |
| core_40 | 40/40 | 40/40 | 23/40 | 37/40 | 40/40 |
| hard_20 | 18/20 | 20/20 | 10/20 | 18/20 | 19/20 |
| CR-A1 min_step | 4/4 | 4/4 | 0/4 | 4/4 | 4/4 |
| fresh_hard_40 | 15/40 | 40/40 (dev set) | 20/40 | 38/40 | 38/40 |
| blind_40 | 20/40 | 30/40 | 25/40 | not run | 38/40 |

All five sets are held out from the LoRA. fresh_hard_40 was then used to pick the new rules families, so
for "Rules after" it is a dev set. blind_40 (evals/datasets/conditions-blind-40.json) was written by
another agent before the rules changed and never used to tune anything; it is the fair comparison.
Full report: `evals/reports/conditions-tinker.md`. v1 had a generator label bug (valid hours 13, 14, 19
labelled unparsed) found through core_40 errors; v2 fixes only that rule.

## How it was used

The LoRA is not shipped. Its value was showing which phrasings people use that the rules missed. Those
families went into the on-phone rules parser (apps/web/src/lib/conditions/rules.ts, tests in
apps/web/test/ai/conditions-families.test.ts). The fine-tune showed us what people say; we taught the
phone's rules, so the words still never leave the phone. On blind_40 the rules went from 20/40 to
30/40; the LoRA is still ahead at 38/40.

## Limits

- Runs on Tinker's servers, not on the phone. Sending free text off the phone breaks BR-C-9 and
  SRS-COND-6, so this can't replace the rules parser as is. A phone or hub copy would need a GGUF
  export, which was not done.
- Trained for one group and one ladder. Other names or step names are untested.
- Known misses: "sit somewhere close" (drops max_step 4), "quarter to 5" (reads 17:15), "half hour walk
  max" (reads a step), "need Shilp there or I'm out" (unparsed), "cant leave the house till 2" (reads
  back_by). The rules parser now gets the first three.
- The template author had seen hard_20 and core_40, so numbers on those are likely on the high side.
- English only. No safety tuning beyond the base model; output is JSON checked by the same scorer.

## Cost

About USD 2.40 for both training runs and all eval passes, from token counts and Tinker's published
prices.
