"""LoRA fine-tune on Tinker: reply text -> rule JSON (same answer form as the conditions eval).

Usage:
  python train.py --estimate          # token count and USD estimate only, no API calls
  python train.py                     # train, save sampler weights, write out/run.json

Prices (USD per million tokens, Tinker docs models page, read 2026-10-11), Qwen3.5-4B:
train 0.737, prefill 0.33, sample 1.005. The run stops before calling the API if the
estimate for training plus all evals is over --budget.
"""

from __future__ import annotations

import argparse
import json
import time

import common

PRICE = {"Qwen/Qwen3.5-4B": {"train": 0.737, "prefill": 0.33, "sample": 1.005}}


def tokenizer():
    from transformers import AutoTokenizer

    return AutoTokenizer.from_pretrained(common.BASE_MODEL)


def prompt_tokens(tok, text: str) -> list[int]:
    s = tok.apply_chat_template(common.messages(text), tokenize=False, add_generation_prompt=True,
                                enable_thinking=False)
    return tok.encode(s, add_special_tokens=False)


def example_tokens(tok, text: str, expect) -> tuple[list[int], list[float]]:
    p = prompt_tokens(tok, text)
    c = tok.encode(common.encode_answer(expect) + "<|im_end|>", add_special_tokens=False)
    return p + c, [0.0] * len(p) + [1.0] * len(c)


def load_rows() -> list[dict]:
    return [json.loads(line) for line in (common.OUT / "train.jsonl").read_text().splitlines()]


def estimate(tok, rows, epochs: int, eval_items: int, eval_models: int) -> dict:
    lens = [len(example_tokens(tok, r["text"], r["expect"])[0]) for r in rows]
    train_tokens = sum(lens) * epochs
    avg_prompt = sum(len(prompt_tokens(tok, r["text"])) for r in rows[:200]) / 200
    eval_prefill = avg_prompt * eval_items * eval_models
    eval_sample = 40 * eval_items * eval_models  # max_tokens cap per answer
    pr = PRICE[common.BASE_MODEL]
    usd = train_tokens / 1e6 * pr["train"] + eval_prefill / 1e6 * pr["prefill"] + eval_sample / 1e6 * pr["sample"]
    return {
        "examples": len(rows),
        "epochs": epochs,
        "train_tokens": train_tokens,
        "mean_tokens_per_example": round(sum(lens) / len(lens), 1),
        "eval_prefill_tokens_upper": int(eval_prefill),
        "eval_sample_tokens_upper": eval_sample,
        "prices_usd_per_mtok": pr,
        "estimate_usd": round(usd, 3),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--estimate", action="store_true")
    ap.add_argument("--epochs", type=int, default=2)
    ap.add_argument("--batch", type=int, default=64)
    ap.add_argument("--lr", type=float, default=4e-4)
    ap.add_argument("--rank", type=int, default=32)
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--budget", type=float, default=10.0)
    a = ap.parse_args()

    tok = tokenizer()
    rows = load_rows()
    # evals: core 40 + hard 20 + CR-A1 4 + fresh 40 = 104 items, for base and LoRA
    est = estimate(tok, rows, a.epochs, eval_items=104, eval_models=2)
    print(json.dumps(est, indent=2))
    if est["estimate_usd"] > a.budget:
        raise SystemExit(f"estimate {est['estimate_usd']} USD is over budget {a.budget}; stopping")
    if a.estimate:
        return

    import random

    import tinker
    from tinker import types

    common.load_key()
    svc = tinker.ServiceClient()
    tc = svc.create_lora_training_client(base_model=common.BASE_MODEL, rank=a.rank, seed=a.seed)

    data = []
    for r in rows:
        toks, w = example_tokens(tok, r["text"], r["expect"])
        data.append(types.Datum(
            model_input=types.ModelInput.from_ints(toks[:-1]),
            loss_fn_inputs={"target_tokens": toks[1:], "weights": w[1:]},
        ))
    rng = random.Random(a.seed)
    steps_per_epoch = len(data) // a.batch
    total = steps_per_epoch * a.epochs
    log = []
    step = 0
    t0 = time.time()
    for ep in range(a.epochs):
        order = list(range(len(data)))
        rng.shuffle(order)
        for b in range(steps_per_epoch):
            batch = [data[i] for i in order[b * a.batch:(b + 1) * a.batch]]
            lr = a.lr * (1 - step / total)
            fb = tc.forward_backward(batch, "cross_entropy")
            op = tc.optim_step(types.AdamParams(learning_rate=lr))
            res = fb.result()
            op.result()
            # loss:sum is summed over weighted tokens; report per answer token
            n_tok = sum(sum(d.loss_fn_inputs["weights"].tolist()) for d in batch)
            loss = res.metrics.get("loss:sum", float("nan")) / max(1.0, n_tok)
            log.append({"step": step, "epoch": ep, "lr": lr, "loss_per_token": round(loss, 5)})
            if step % 5 == 0 or step == total - 1:
                print(f"step {step}/{total} lr {lr:.2e} loss/token {loss:.4f} ({time.time() - t0:.0f}s)")
            step += 1

    saved = tc.save_weights_for_sampler(name="flare-conditions-lora").result()
    run = {
        "base_model": common.BASE_MODEL,
        "sampler_path": saved.path,
        "config": {"rank": a.rank, "lr": a.lr, "schedule": "linear to 0", "batch": a.batch, "epochs": a.epochs,
                   "steps": total, "seed": a.seed, "loss": "cross_entropy on answer tokens only",
                   "optimizer": "AdamW (Tinker defaults: beta1 0.9, beta2 0.95, wd 0)"},
        "estimate": est,
        "wall_seconds": round(time.time() - t0),
        "log": log,
    }
    (common.OUT / "run.json").write_text(json.dumps(run, indent=2) + "\n")
    print("saved sampler weights; run written to out/run.json")


if __name__ == "__main__":
    main()
