# Handoff 11: Tinker LoRA for the conditions parser, then rules taught by it

From: S3 (ML, fine-tuning), branch `tinker`. To: engineering lead, ODAI, ML. Date: Sun 2026-10-11.

## Result in short

The fine-tune showed us what people say; we taught the phone's rules, so the words still never leave
the phone.

1. A Qwen3.5-4B LoRA trained on Tinker read far more new phrasings than the rules parser (fresh_hard_40:
   38/40 vs 15/40). It runs on Tinker's servers only, so it breaks BR-C-9 and can't ship.
2. The phrasing families it handled went into the on-phone rules parser. The rules now get core_40 40/40,
   hard_20 20/20, CR-A1 4/4, all under 1 ms per parse with no network.
3. On a second blind set written before the rules changed (blind_40), the rules went from 20/40 to 30/40.
   The LoRA gets 38/40, so there is still a gap.

## What was built

| Item | Where |
| --- | --- |
| Data generator (templates, seeded) and stats | ml/tinker/gen_data.py, ml/tinker/out/data_stats.json, out/train.jsonl |
| Training on Tinker, cost estimate first | ml/tinker/train.py, out/run.json (v2), out/run_v1.json |
| Eval: same() scorer from the eval runner via a Node bridge (`FLARE_RULES` picks the parser copy) | ml/tinker/eval.py, ml/tinker/rules_bridge.ts |
| Rules parser families (ICD-7 contract unchanged) | apps/web/src/lib/conditions/rules.ts |
| Unit tests, one per family, plus timing | apps/web/test/ai/conditions-families.test.ts |
| Dev set, debatable labels marked | evals/datasets/conditions-fresh-40.json |
| Second blind set, untouched by tuning | evals/datasets/conditions-blind-40.json |
| Report | evals/reports/conditions-tinker.md, .json (ml/tinker/report.py) |
| Model card | docs/ml/model-card-conditions-lora.md |
| Pinned deps (all on or before 2026-09-26) | ml/tinker/requirements.txt |

## Numbers

| Set | Rules before | Rules after | Base zero-shot | LoRA v1 | LoRA v2 |
| --- | --- | --- | --- | --- | --- |
| core_40 | 40/40 | 40/40 | 23/40 | 37/40 | 40/40 |
| hard_20 | 18/20 | 20/20 | 10/20 | 18/20 | 19/20 |
| CR-A1 min_step | 4/4 | 4/4 | 0/4 | 4/4 | 4/4 |
| fresh_hard_40 | 15/40 | 40/40 (dev set) | 20/40 | 38/40 | 38/40 |
| blind_40 | 20/40 | 30/40 | 25/40 | not run | 38/40 |

- fresh_hard_40 picked the families, so "Rules after" 40/40 there only shows coverage. blind_40 is the
  fair number.
- On the 3,000 template texts the rules agree with the label on 44% before and 75.5% after, and on all 212
  negatives (plain yes, vague, OR, impossible times, outside names) before and after.
- The app parser was at 18/20 on hard_20 before this work, not the 15/20 in
  evals/reports/conditions-rules-lab07-baseline.md (that report ran the older lab 07 parser).
- Tests: root vitest 61 files / 616 tests pass; flow vitest 6 files / 56 pass; tsc clean.

Cost: about USD 2.40 (two training runs, about 3.1 M tokens at USD 0.737/M, plus under USD 0.09 for
seven eval passes). Estimated at USD 1.18 per run before training. The SDK returns no bill; the Tinker
console has the charge.

## Serving

The LoRA is eval-only, served by Tinker sampling; no GGUF or Ollama export (no Qwen3.5-4B on the hub, and
downloading base weights needs a yes from the founder). What ships is the rules parser.

## How to rerun

```
uv venv -p 3.12 .venv && uv pip install --exclude-newer 2026-09-26 -r ml/tinker/requirements.txt
cd ml/tinker
python gen_data.py            # deterministic, seed 7 (now also drops near copies of fresh_40 and blind_40)
python train.py --estimate    # no API calls
python train.py               # needs TINKER or TINKER_API_KEY in the main checkout's .env
python eval.py rules && python eval.py base && python eval.py lora && python report.py
FLARE_RULES=<path to an older parser index.ts> python eval.py rules rules_before
```

## Open items for the next owner

1. The 10 blind_40 misses are listed in the report (for example "start no earlier than 12:30", "anytime
   past 1:45", "dont wanna walk more than 25 mins", "need Shilp there or I'm out"). They were not fixed on
   purpose: fixing them would spend the only held-out set. Write a new blind set first, then teach them.
2. Review the debatable labels marked in conditions-fresh-40.json (9) and conditions-blind-40.json (2),
   for example "im stuck at work until 5" read as after 17:00 and "curfew" read as back_by.
3. Copy owner: the families add new rule shapes but no new user-facing strings; read-backs are unchanged.
4. If a model is wanted on the hub later: pull the base, download the adapter, convert to GGUF, add it to
   Ollama. Needs a yes for the downloads.
