"""Score rules parser, base model zero-shot and the LoRA on the held-out sets.

Scoring is the conditions eval's own same() (evals/harness/tasks/conditions.ts), called
through rules_bridge.ts, so a model answer passes exactly when a parser answer would.

Usage:
  python eval.py rules            # app rules parser, no API calls
  python eval.py base             # Qwen3.5-4B zero-shot on Tinker sampling
  python eval.py lora             # sampler weights from out/run.json
Writes out/eval_<name>.json.
"""

from __future__ import annotations

import json
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor

import common


def sets() -> dict[str, list[dict]]:
    fx = json.loads((common.REPO / "docs/requirements/fixtures/conditions-60.json").read_text())
    cr = json.loads((common.REPO / "evals/datasets/conditions-cr-a1.json").read_text())
    fresh = json.loads((common.HERE / "data/fresh_hard_40.json").read_text())
    return {"core_40": fx["core_40"], "hard_20": fx["hard_20"], "cr_a1_min_step": cr["min_step_4"],
            "fresh_hard_40": fresh["items"]}


def bridge(mode: str, payload):
    out = subprocess.run(["node", str(common.HERE / "rules_bridge.ts"), mode], input=json.dumps(payload),
                         capture_output=True, text=True, check=True, cwd=common.REPO)
    return json.loads(out.stdout)


def model_answers(which: str, texts: list[str]) -> tuple[list, list[str], dict]:
    import tinker
    from tinker import types

    from train import prompt_tokens, tokenizer

    common.load_key()
    svc = tinker.ServiceClient()
    if which == "base":
        sc = svc.create_sampling_client(base_model=common.BASE_MODEL)
    else:
        run = json.loads((common.OUT / "run.json").read_text())
        sc = svc.create_sampling_client(model_path=run["sampler_path"])
    tok = tokenizer()
    params = types.SamplingParams(max_tokens=40, temperature=0.0, stop=["<|im_end|>"])
    usage = {"prefill_tokens": 0, "sample_tokens": 0}

    def one(t: str):
        p = prompt_tokens(tok, t)
        r = sc.sample(prompt=types.ModelInput.from_ints(p), num_samples=1, sampling_params=params).result()
        seq = r.sequences[0].tokens
        return len(p), len(seq), tok.decode(seq, skip_special_tokens=True)

    t0 = time.time()
    with ThreadPoolExecutor(max_workers=16) as ex:
        res = list(ex.map(one, texts))
    for p, s, _ in res:
        usage["prefill_tokens"] += p
        usage["sample_tokens"] += s
    usage["wall_seconds"] = round(time.time() - t0, 1)
    raw = [x[2] for x in res]
    return [common.decode_answer(x) for x in raw], raw, usage


def main() -> None:
    which = sys.argv[1] if len(sys.argv) > 1 else ""
    if which not in ("rules", "base", "lora"):
        raise SystemExit("usage: python eval.py rules|base|lora")
    data = sets()
    items = [(s, c) for s, cs in data.items() for c in cs]
    texts = [c["text"] for _, c in items]
    usage = None
    if which == "rules":
        got, raw = bridge("parse", texts), None
    else:
        got, raw, usage = model_answers(which, texts)
    passes = bridge("score", [{"got": g, "expect": c["expect"]} for g, (_, c) in zip(got, items)])
    rows = []
    for i, ((s, c), g, ok) in enumerate(zip(items, got, passes)):
        row = {"set": s, "text": c["text"], "expect": c["expect"], "got": g, "pass": ok}
        if raw is not None:
            row["raw"] = raw[i]
        rows.append(row)
    score = {s: f"{sum(r['pass'] for r in rows if r['set'] == s)}/{len(cs)}" for s, cs in data.items()}
    out = {"model": which, "base_model": common.BASE_MODEL, "score": score, "usage": usage, "items": rows}
    common.OUT.mkdir(exist_ok=True)
    (common.OUT / f"eval_{which}.json").write_text(json.dumps(out, indent=2) + "\n")
    print(which, json.dumps(score), json.dumps(usage) if usage else "")


if __name__ == "__main__":
    main()
