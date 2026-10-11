# Handoff 11: Tinker LoRA for the conditions parser

From: S3 (ML, fine-tuning), branch `tinker`. To: engineering lead, ODAI, ML. Date: Sun 2026-10-11.

## Result in one line

A Qwen3.5-4B LoRA trained on Tinker matches the rules parser on core_40 (40/40), gets one more hard_20
item (19/20 vs 18/20), and reads far more new phrasings (fresh_hard_40: 38/40 vs 15/40). It runs on
Tinker's servers only, so it does not meet BR-C-9 and is not a drop-in for the app.

## What was built

| Item | Where |
| --- | --- |
| Data generator (templates, seeded) and stats | ml/tinker/gen_data.py, ml/tinker/out/data_stats.json, out/train.jsonl |
| Training on Tinker, cost estimate first | ml/tinker/train.py, out/run.json (v2), out/run_v1.json |
| Eval: same() scorer from the eval runner via a Node bridge | ml/tinker/eval.py, ml/tinker/rules_bridge.ts |
| New held-out set, 40 items, written blind to the templates | ml/tinker/data/fresh_hard_40.json |
| Report | evals/reports/conditions-tinker.md, .json (ml/tinker/report.py) |
| Model card | docs/ml/model-card-conditions-lora.md |
| Pinned deps (all on or before 2026-09-26) | ml/tinker/requirements.txt |

## Numbers

| Set | Rules parser | Base zero-shot | LoRA v1 | LoRA v2 |
| --- | --- | --- | --- | --- |
| core_40 | 40/40 | 24/40 | 37/40 | 40/40 |
| hard_20 | 18/20 | 10/20 | 18/20 | 19/20 |
| CR-A1 min_step | 4/4 | 0/4 | 4/4 | 4/4 |
| fresh_hard_40 | 15/40 | 20/40 | 38/40 | 38/40 |

Note: the app parser is already at 18/20 on hard_20, not the 15/20 in
evals/reports/conditions-rules-lab07-baseline.md (that report ran the older lab 07 parser).

Cost: about USD 2.34 (two training runs, about 3.1 M tokens at USD 0.737/M, plus USD 0.03 sampling).
Estimated at USD 1.18 per run before training. The SDK returns no bill; the Tinker console has the charge.

## Serving

Eval-only, served by Tinker sampling. No GGUF or Ollama export: the hub has no Qwen3.5-4B pulled and
downloading base weights needs a yes from the founder.

## How to rerun

```
uv venv -p 3.12 .venv && uv pip install --exclude-newer 2026-09-26 -r ml/tinker/requirements.txt
cd ml/tinker
python gen_data.py            # deterministic, seed 7
python train.py --estimate    # no API calls
python train.py               # needs TINKER or TINKER_API_KEY in the main checkout's .env
python eval.py rules && python eval.py base && python eval.py lora && python report.py
```

## Open items for the next owner

1. Decide if the fresh_hard_40 gap is worth acting on. Cheapest path that keeps BR-C-9: add the
   phrasing families the LoRA learned (until/til, curfew, at the earliest, tops, "can't go without X")
   to the rules parser, using fresh_hard_40 as a new eval set.
2. If a model is wanted on the hub: pull the base, download the adapter, convert to GGUF, add it to
   Ollama. Needs a yes for the downloads.
3. Review the fresh_hard_40 labels the writing agent flagged as debatable: "im stuck at work until 5"
   and "can't do anything til 3" (after), "my shift starts at 6 so i gotta be back before then", "got a
   thing at 3, need to be back for it" and "curfew is 5:30 lol" (back_by), "nothing far pls" and "half
   hour walk max" (max_walk), "back by 26" (unparsed).
