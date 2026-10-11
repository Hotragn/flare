# Eval: conditions (Tinker LoRA)

Base model: Qwen/Qwen3.5-4B (Apache-2.0). LoRA rank 32, 92 steps on 3000 synthetic examples. Date: 2026-10-11. Scoring: same() from evals/harness/tasks/conditions.ts, called through ml/tinker/rules_bridge.ts.

| Set | Rules parser (app, baseline) | Qwen3.5-4B zero-shot | LoRA v1 (label bug) | LoRA v2 (final) |
| --- | --- | --- | --- | --- |
| core_40 | 40/40 | 24/40 | 37/40 | 40/40 |
| hard_20 | 18/20 | 10/20 | 18/20 | 19/20 |
| cr_a1_min_step | 4/4 | 0/4 | 4/4 | 4/4 |
| fresh_hard_40 | 15/40 | 20/40 | 38/40 | 38/40 |

Sets: core_40 and hard_20 from docs/requirements/fixtures/conditions-60.json; cr_a1_min_step from evals/datasets/conditions-cr-a1.json; fresh_hard_40 is ml/tinker/data/fresh_hard_40.json, 40 new phrasings written by a separate agent that never saw the training templates. None of these were trained on. Model answers use greedy sampling (temperature 0, 40 tokens max).

## Where the LoRA and the rules parser differ

| Set | Text | Expected | LoRA | Rules | Right |
| --- | --- | --- | --- | --- | --- |
| hard_20 | count me in once I'm done with lunch around 1 | `[{"type": "after", "value": "13:00"}]` | `[{"type": "after", "value": "13:00"}]` | `null` | lora |
| fresh_hard_40 | as long as Amor joins | `[{"type": "with", "value": "Amor"}]` | `[{"type": "with", "value": "Amor"}]` | `null` | lora |
| fresh_hard_40 | cant go without shilp lol | `[{"type": "with", "value": "Shilp"}]` | `[{"type": "with", "value": "Shilp"}]` | `null` | lora |
| fresh_hard_40 | sure, assuming Fuego's in | `[{"type": "with", "value": "Fuego"}]` | `[{"type": "with", "value": "Fuego"}]` | `null` | lora |
| fresh_hard_40 | in if both fuego and shilp show | `[{"type": "with", "value": "Fuego"}, {"type": "with", "value": "Shilp"}]` | `[{"type": "with", "value": "Fuego"}, {"type": "with", "value": "Shilp"}]` | `null` | lora |
| fresh_hard_40 | tell ammo to come and im there | `[{"type": "with", "value": "Ammo"}]` | `[{"type": "with", "value": "Ammo"}]` | `null` | lora |
| fresh_hard_40 | can't do anything til 3 | `[{"type": "after", "value": "15:00"}]` | `[{"type": "after", "value": "15:00"}]` | `null` | lora |
| fresh_hard_40 | gotta finish laundry so 2:45 at the earliest | `[{"type": "after", "value": "14:45"}]` | `[{"type": "after", "value": "14:45"}]` | `null` | lora |
| fresh_hard_40 | only once its past 1:30 | `[{"type": "after", "value": "13:30"}]` | `[{"type": "after", "value": "13:30"}]` | `null` | lora |
| fresh_hard_40 | im stuck at work until 5 | `[{"type": "after", "value": "17:00"}]` | `[{"type": "after", "value": "17:00"}]` | `null` | lora |
| fresh_hard_40 | my shift starts at 6 so i gotta be back before then | `[{"type": "back_by", "value": "18:00"}]` | `[{"type": "back_by", "value": "18:00"}]` | `null` | lora |
| fresh_hard_40 | curfew is 5:30 lol | `[{"type": "back_by", "value": "17:30"}]` | `[{"type": "back_by", "value": "17:30"}]` | `null` | lora |
| fresh_hard_40 | have to wrap up by noon | `[{"type": "back_by", "value": "12:00"}]` | `[{"type": "back_by", "value": "12:00"}]` | `null` | lora |
| fresh_hard_40 | got a thing at 3, need to be back for it | `[{"type": "back_by", "value": "15:00"}]` | `[{"type": "back_by", "value": "15:00"}]` | `null` | lora |
| fresh_hard_40 | my knee's bad, 15 mins walking tops | `[{"type": "max_walk", "value": 15}]` | `[{"type": "max_walk", "value": 15}]` | `null` | lora |
| fresh_hard_40 | 20 min walk at most | `[{"type": "max_walk", "value": 20}]` | `[{"type": "max_walk", "value": 20}]` | `null` | lora |
| fresh_hard_40 | nothing far pls | `[{"type": "max_walk", "value": 10}]` | `[{"type": "max_walk", "value": 10}]` | `null` | lora |
| fresh_hard_40 | i can walk 25 minutes, no more | `[{"type": "max_walk", "value": 25}]` | `[{"type": "max_walk", "value": 25}]` | `null` | lora |
| fresh_hard_40 | just wanna say hi honestly | `[{"type": "max_step", "value": 4}]` | `[{"type": "max_step", "value": 4}]` | `null` | lora |
| fresh_hard_40 | a quick lap is all i've got in me | `[{"type": "max_step", "value": 3}]` | `[{"type": "max_step", "value": 3}]` | `null` | lora |
| fresh_hard_40 | nothing bigger than the park loop | `[{"type": "max_step", "value": 2}]` | `[{"type": "max_step", "value": 2}]` | `null` | lora |
| fresh_hard_40 | home by 5 and nothing more than a 10 min walk | `[{"type": "back_by", "value": "17:00"}, {"type": "max_walk", "value": 10}]` | `[{"type": "back_by", "value": "17:00"}, {"type": "max_walk", "value": 10}]` | `[{"type": "back_by", "value": "17:00"}]` | lora |
| fresh_hard_40 | quick lap, gotta leave by 4:15 | `[{"type": "max_step", "value": 3}, {"type": "back_by", "value": "16:15"}]` | `[{"type": "max_step", "value": 3}, {"type": "back_by", "value": "16:15"}]` | `[{"type": "back_by", "value": "16:15"}]` | lora |
| fresh_hard_40 | sure thing | `[]` | `[]` | `null` | lora |

## Read this before trusting the numbers

- hard_20 headroom is small. The app parser already gets 18/20 (the lab 07 parser it grew from got 15/20). The LoRA gets one more item; hard_20 alone can't tell the two apart.
- fresh_hard_40 is the set that shows a gap (rules 15/40, LoRA 38/40). It was written by another agent from the fixture rules, blind to the templates, but the template author (this run) had read hard_20 and core_40, and some template ideas overlap fresh items in spirit ("curfew", "at the earliest", "nothing far"). Exact and near copies (token Jaccard >= 0.6) of every eval text were dropped from training data. Treat 38/40 as an upper-side estimate, not a field number.
- v1 to v2 was informed by eval errors. v1 failed "after 2" and "earliest 3" on core_40/hard_20. The cause was a generator label bug ("after 13", "after 14", "after 19" labelled unparsed, though they are valid 24 h times). v2 fixes only that label rule; no eval phrasing was added. Both runs are reported.
- LoRA misses: "sit somewhere close" (drops max_step 4), "quarter to 5" (reads 17:15), "half hour walk max" (reads a step). None of those forms were in the templates.
- The rules parser runs on the phone in under 1 ms with no network. The LoRA runs on Tinker's servers. Free text leaving the phone breaks BR-C-9 / SRS-COND-6, so this model is not a drop-in for the app.

## Cost

- Training, two runs (v1 and v2), 3,132,408 tokens x USD 0.737/M = USD 2.31.
- Eval sampling (base, v1, v2): USD 0.029 (counted from prompt and sampled tokens).
- Total, from token counts and Tinker's published prices: about USD 2.34. The SDK does not return a bill; check the Tinker console for the charged amount.

## Serving

Eval-only, served by Tinker sampling. Not exported to GGUF or Ollama: the hub has no Qwen3.5-4B base pulled, and fetching base weights plus a merge toolchain was not done in this pass.

Per-item results: `conditions-tinker.json`.
