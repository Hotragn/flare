"""Combine out/eval_{rules,base,lora}.json and out/run.json into evals/reports/conditions-tinker.{md,json}."""

from __future__ import annotations

import json
from datetime import datetime, timezone

import common
from train import PRICE

SETS = ["core_40", "hard_20", "cr_a1_min_step", "fresh_hard_40"]
NAMES = {"rules": "Rules parser (app, baseline)", "base": "Qwen3.5-4B zero-shot", "lora": "Qwen3.5-4B + LoRA"}


def main() -> None:
    ev = {k: json.loads((common.OUT / f"eval_{k}.json").read_text()) for k in ("rules", "base", "lora")}
    run = json.loads((common.OUT / "run.json").read_text())
    stats = json.loads((common.OUT / "data_stats.json").read_text())
    pr = PRICE[common.BASE_MODEL]
    train_usd = run["estimate"]["train_tokens"] / 1e6 * pr["train"]
    eval_usd = 0.0
    for k in ("base", "lora"):
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
        "| Set | " + " | ".join(NAMES[k] for k in ("rules", "base", "lora")) + " |",
        "| --- | --- | --- | --- |",
    ]
    for s in SETS:
        lines.append(f"| {s} | " + " | ".join(ev[k]["score"][s] for k in ("rules", "base", "lora")) + " |")
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
        "## Cost",
        "",
        f"- Training: {run['estimate']['train_tokens']:,} tokens x USD {pr['train']}/M = USD {train_usd:.2f}.",
        f"- Eval sampling (base + LoRA): USD {eval_usd:.3f} (counted from prompt and sampled tokens).",
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
        "usage": {k: ev[k]["usage"] for k in ("base", "lora")},
        "cost_usd_estimate": round(train_usd + eval_usd, 3),
        "differ": flips,
        "items": {k: ev[k]["items"] for k in ev},
    }
    (common.REPO / "evals/reports/conditions-tinker.json").write_text(json.dumps(out, indent=2) + "\n")
    print("\n".join(lines[:12]))


if __name__ == "__main__":
    main()
