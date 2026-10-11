"""Combine out/eval_*.json and out/run*.json into evals/reports/conditions-tinker.{md,json}."""

from __future__ import annotations

import json
from datetime import datetime, timezone

import common
from train import PRICE

SETS = ["core_40", "hard_20", "cr_a1_min_step", "fresh_hard_40", "blind_40"]
NAMES = {
    "rules_before": "Rules before",
    "rules": "Rules after",
    "base": "Qwen3.5-4B zero-shot",
    "lora_v1": "LoRA v1 (label bug)",
    "lora": "LoRA v2",
}
MODELS = ["rules_before", "rules", "base", "lora_v1", "lora"]
EVAL_RUNS = 7  # sampling passes made on Tinker in total (base x3, v1 x1, v2 x3)


def j(v) -> str:
    return f"`{json.dumps(v)}`"


def main() -> None:
    ev = {k: json.loads((common.OUT / f"eval_{k}.json").read_text()) for k in MODELS}
    run = json.loads((common.OUT / "run.json").read_text())
    run_v1 = json.loads((common.OUT / "run_v1.json").read_text())
    stats = json.loads((common.OUT / "data_stats.json").read_text())
    pr = PRICE[common.BASE_MODEL]
    train_tokens = run["estimate"]["train_tokens"] + run_v1["estimate"]["train_tokens"]
    train_usd = train_tokens / 1e6 * pr["train"]
    u = ev["lora"]["usage"]
    one_pass = u["prefill_tokens"] / 1e6 * pr["prefill"] + u["sample_tokens"] / 1e6 * pr["sample"]
    eval_usd = one_pass * EVAL_RUNS  # upper side: early passes had fewer items

    by = {k: {(r["set"], r["text"]): r for r in ev[k]["items"]} for k in ev}

    def misses(k: str, s: str) -> list[dict]:
        return [r for r in ev[k]["items"] if r["set"] == s and not r["pass"]]

    lines = [
        "# Eval: conditions (Tinker LoRA, then rules taught by it)",
        "",
        "The fine-tune showed us what people say; we taught the phone's rules, so the words still never "
        "leave the phone.",
        "",
        f"Base model: {common.BASE_MODEL} (Apache-2.0). LoRA rank {run['config']['rank']}, "
        f"{run['config']['steps']} steps on {stats['examples']} synthetic examples. "
        f"Date: {datetime.now(timezone.utc).strftime('%Y-%m-%d')}. Scoring: same() from "
        "evals/harness/tasks/conditions.ts, called through ml/tinker/rules_bridge.ts.",
        "",
        "| Set | " + " | ".join(NAMES[k] for k in MODELS) + " |",
        "| --- |" + " --- |" * len(MODELS),
    ]
    for s in SETS:
        lines.append(f"| {s} | " + " | ".join(ev[k]["score"].get(s, "not run") for k in MODELS) + " |")
    lines += [
        "",
        "- core_40, hard_20: docs/requirements/fixtures/conditions-60.json. cr_a1_min_step: "
        "evals/datasets/conditions-cr-a1.json.",
        "- fresh_hard_40: evals/datasets/conditions-fresh-40.json, 40 phrasings written by a separate agent "
        "blind to the training templates. Held out from the LoRA. It was then used to pick the new rules "
        "families, so **for \"Rules after\" it is a dev set**, and 40/40 says only that the families cover it.",
        "- blind_40: evals/datasets/conditions-blind-40.json, written by another agent that saw neither the "
        "parser, the templates nor fresh_40, before the parser changes, and read only to score. "
        "**This is the held-out number for the new rules.**",
        "- Rules before = the app parser at commit be95b6a. Model answers: greedy, 40 tokens max. Base "
        "zero-shot moved by one item on core_40 between passes (23 or 24/40) even at temperature 0.",
        "- Synthetic training data as a wider check (3,000 template-labelled texts, not an eval): rules agree "
        "with the template label on 44% before and 75.5% after, and on all 212 negatives (plain yes, vague, "
        "OR, impossible times, outside names) both before and after.",
        "",
        "## What the rules learned (apps/web/src/lib/conditions/rules.ts)",
        "",
        "| Family | Example | Rule |",
        "| --- | --- | --- |",
        "| Times | back no later than quarter to 5 | quarter to / quarter past / half past N |",
        "| W1 with | cant go without shilp, tell ammo to come, as long as Amor joins | softer cues; only names in "
        "the group, so \"tell Mom\" is not an error |",
        "| A1 after | im stuck at work until 5, can't do anything til 3 | busy until T means after T |",
        "| A2 after | 2:45 at the earliest, once its past 1:30 | T at the earliest, past T |",
        "| A3 after | once I'm done with lunch around 1 | done with X around T |",
        "| B1 back_by | curfew is 5:30, 5 at the latest, free until 6, wrap up by noon | |",
        "| B2 back_by | got a thing at 3, need to be back for it | event at T plus a back/leave word, no \"after\" |",
        "| M0-M2 max_walk | half hour walk max, 15 mins walking tops, nothing far | spoken durations; limit word "
        "after the minutes |",
        "| S1-S3 steps | sit somewhere close, just wanna say hi, nothing bigger than the park loop | sit / say hi "
        "is step 4; named-step limits |",
        "| Plain yes | sure thing, sounds good, bet | |",
        "",
        "Each family has unit tests in apps/web/test/ai/conditions-families.test.ts, including the parse time "
        "(under 1 ms per phrase over core, hard and fresh).",
        "",
        "## Still missed on blind_40",
        "",
        "| Text | Expected | Rules after | LoRA v2 |",
        "| --- | --- | --- | --- |",
    ]
    for r in ev["rules"]["items"]:
        if r["set"] != "blind_40":
            continue
        lo = by["lora"][(r["set"], r["text"])]
        if r["pass"] and lo["pass"]:
            continue
        lines.append(f"| {r['text']} | {j(r['expect'])} | {j(r['got'])} | {j(lo['got'])} |")
    lines += [
        "",
        "These are left as they are on purpose: tuning on blind_40 would spend the only held-out set. Write a "
        "new blind set before teaching the rules any of them.",
        "",
        "## LoRA misses on the other sets",
        "",
    ]
    for s in ("core_40", "hard_20", "cr_a1_min_step", "fresh_hard_40"):
        for r in misses("lora", s):
            lines.append(f"- {s}: \"{r['text']}\" expected {j(r['expect'])}, got {j(r['got'])}")
    lines += [
        "",
        "## Read this before trusting the numbers",
        "",
        "- The template author (this run) had read core_40 and hard_20. Exact and near copies (token Jaccard "
        ">= 0.6) of every eval text were dropped from the training data.",
        "- v1 to v2 was informed by eval errors: v1 failed \"after 2\" and \"earliest 3\" because the generator "
        "labelled valid hours 13, 14, 19 as unparsed. v2 fixes only that label rule. Both runs are reported.",
        "- The LoRA runs on Tinker's servers. Sending free text there breaks BR-C-9 / SRS-COND-6, which is why "
        "the result went into the rules instead.",
        "",
        "## Cost",
        "",
        f"- Training, two runs, {train_tokens:,} tokens x USD {pr['train']}/M = USD {train_usd:.2f}.",
        f"- Eval sampling, {EVAL_RUNS} passes at about USD {one_pass:.3f} each: under USD {eval_usd:.2f}.",
        f"- Total, from token counts and Tinker's published prices: about USD {train_usd + eval_usd:.2f}. "
        "The SDK does not return a bill; check the Tinker console for the charged amount.",
        "",
        "## Serving",
        "",
        "The LoRA is eval-only, served by Tinker sampling; no GGUF or Ollama export. What ships is the rules "
        "parser, on the phone, under 1 ms, no network.",
        "",
        "Per-item results: `conditions-tinker.json`.",
    ]
    (common.REPO / "evals/reports/conditions-tinker.md").write_text("\n".join(lines) + "\n")
    out = {
        "task": "conditions",
        "tier": "tinker-lora + rules",
        "base_model": common.BASE_MODEL,
        "sampler_path_note": "private Tinker checkpoint; path kept in ml/tinker/out/run.json",
        "config": run["config"],
        "data": {k: stats[k] for k in ("examples", "dropped", "rule_counts", "rules_parser_cross_check")},
        "scores": {k: ev[k]["score"] for k in MODELS},
        "cost_usd_estimate": round(train_usd + eval_usd, 3),
        "items": {k: ev[k]["items"] for k in MODELS},
    }
    (common.REPO / "evals/reports/conditions-tinker.json").write_text(json.dumps(out, indent=2) + "\n")
    print("\n".join(lines[6:14]))


if __name__ == "__main__":
    main()
