"""Combine out/eval_{rules,base,lora}.json and out/run.json into evals/reports/conditions-tinker.{md,json}."""

from __future__ import annotations

import json
from datetime import datetime, timezone

import common
from train import PRICE

SETS = ["core_40", "hard_20", "cr_a1_min_step", "fresh_hard_40"]
NAMES = {"rules": "Rules parser (app, baseline)", "base": "Qwen3.5-4B zero-shot", "lora_v1": "LoRA v1 (label bug)",
         "lora": "LoRA v2 (final)"}
MODELS = ["rules", "base", "lora_v1", "lora"]


def main() -> None:
    ev = {k: json.loads((common.OUT / f"eval_{k}.json").read_text()) for k in MODELS}
    run = json.loads((common.OUT / "run.json").read_text())
    stats = json.loads((common.OUT / "data_stats.json").read_text())
    pr = PRICE[common.BASE_MODEL]
    run_v1 = json.loads((common.OUT / "run_v1.json").read_text())
    train_usd = (run["estimate"]["train_tokens"] + run_v1["estimate"]["train_tokens"]) / 1e6 * pr["train"]
    eval_usd = 0.0
    for k in ("base", "lora_v1", "lora"):
        u = ev[k]["usage"]
        eval_usd += u["prefill_tokens"] / 1e6 * pr["prefill"] + u["sample_tokens"] / 1e6 * pr["sample"]

    # items where the LoRA and the rules parser disagree on pass/fail
    by = {k: {(r["set"], r["text"]): r for r in ev[k]["items"]} for k in ev}
    flips = []
    for key, r in by["lora"].items():
        rp = by["rules"][key]["pass"]
        if r["pass"] != rp:
            flips.append({"set": key[0], "text": key[1], "expect": r["expect"], "lora": r["got"],
                          "rules": by["rules"][key]["got"], "winner": "lora" if r["pass"] else "rules"})

    lines = [
        "# Eval: conditions (Tinker LoRA)",
        "",
        f"Base model: {common.BASE_MODEL} (Apache-2.0). LoRA rank {run['config']['rank']}, "
        f"{run['config']['steps']} steps on {stats['examples']} synthetic examples. "
        f"Date: {datetime.now(timezone.utc).strftime('%Y-%m-%d')}. Scoring: same() from "
        "evals/harness/tasks/conditions.ts, called through ml/tinker/rules_bridge.ts.",
        "",
        "| Set | " + " | ".join(NAMES[k] for k in MODELS) + " |",
        "| --- | --- | --- | --- | --- |",
    ]
    for s in SETS:
        lines.append(f"| {s} | " + " | ".join(ev[k]["score"][s] for k in MODELS) + " |")
    lines += [
        "",
        "Sets: core_40 and hard_20 from docs/requirements/fixtures/conditions-60.json; cr_a1_min_step from "
        "evals/datasets/conditions-cr-a1.json; fresh_hard_40 is ml/tinker/data/fresh_hard_40.json, 40 new "
        "phrasings written by a separate agent that never saw the training templates. None of these "
        "were trained on. Model answers use greedy sampling (temperature 0, 40 tokens max).",
        "",
        "## Where the LoRA and the rules parser differ",
        "",
        "| Set | Text | Expected | LoRA | Rules | Right |",
        "| --- | --- | --- | --- | --- | --- |",
    ]
    for f in flips:
        lines.append(f"| {f['set']} | {f['text']} | `{json.dumps(f['expect'])}` | `{json.dumps(f['lora'])}` | "
                     f"`{json.dumps(f['rules'])}` | {f['winner']} |")
    lines += [
        "",
        "## Read this before trusting the numbers",
        "",
        "- hard_20 headroom is small. The app parser already gets 18/20 (the lab 07 parser it grew from got "
        "15/20). The LoRA gets one more item; hard_20 alone can't tell the two apart.",
        "- fresh_hard_40 is the set that shows a gap (rules 15/40, LoRA 38/40). It was written by another agent "
        "from the fixture rules, blind to the templates, but the template author (this run) had read hard_20 "
        "and core_40, and some template ideas overlap fresh items in spirit (\"curfew\", \"at the earliest\", "
        "\"nothing far\"). Exact and near copies (token Jaccard >= 0.6) of every eval text were dropped from "
        "training data. Treat 38/40 as an upper-side estimate, not a field number.",
        "- v1 to v2 was informed by eval errors. v1 failed \"after 2\" and \"earliest 3\" on core_40/hard_20. "
        "The cause was a generator label bug (\"after 13\", \"after 14\", \"after 19\" labelled unparsed, though "
        "they are valid 24 h times). v2 fixes only that label rule; no eval phrasing was added. Both runs are "
        "reported.",
        "- LoRA misses: \"sit somewhere close\" (drops max_step 4), \"quarter to 5\" (reads 17:15), \"half hour "
        "walk max\" (reads a step). None of those forms were in the templates.",
        "- The rules parser runs on the phone in under 1 ms with no network. The LoRA runs on Tinker's servers. "
        "Free text leaving the phone breaks BR-C-9 / SRS-COND-6, so this model is not a drop-in for the app.",
        "",
        "## Cost",
        "",
        f"- Training, two runs (v1 and v2), {run['estimate']['train_tokens'] + run_v1['estimate']['train_tokens']:,} "
        f"tokens x USD {pr['train']}/M = USD {train_usd:.2f}.",
        f"- Eval sampling (base, v1, v2): USD {eval_usd:.3f} (counted from prompt and sampled tokens).",
        f"- Total, from token counts and Tinker's published prices: about USD {train_usd + eval_usd:.2f}. "
        "The SDK does not return a bill; check the Tinker console for the charged amount.",
        "",
        "## Serving",
        "",
        "Eval-only, served by Tinker sampling. Not exported to GGUF or Ollama: the hub has no Qwen3.5-4B base "
        "pulled, and fetching base weights plus a merge toolchain was not done in this pass.",
        "",
        "Per-item results: `conditions-tinker.json`.",
    ]
    (common.REPO / "evals/reports/conditions-tinker.md").write_text("\n".join(lines) + "\n")
    out = {
        "task": "conditions",
        "tier": "tinker-lora",
        "base_model": common.BASE_MODEL,
        "sampler_path_note": "private Tinker checkpoint; path kept in ml/tinker/out/run.json",
        "config": run["config"],
        "data": {k: stats[k] for k in ("examples", "dropped", "rule_counts", "rules_parser_cross_check")},
        "scores": {k: ev[k]["score"] for k in ev},
        "usage": {k: ev[k]["usage"] for k in ("base", "lora_v1", "lora")},
        "cost_usd_estimate": round(train_usd + eval_usd, 3),
        "differ": flips,
        "items": {k: ev[k]["items"] for k in ev},
    }
    (common.REPO / "evals/reports/conditions-tinker.json").write_text(json.dumps(out, indent=2) + "\n")
    print("\n".join(lines[:12]))


if __name__ == "__main__":
    main()
