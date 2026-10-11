"""Deterministic synthetic training data for the conditions LoRA.

Each example comes from a template family that carries its own label (the template knows what it
means). The app rules parser (apps/web/src/lib/conditions) is then run on every example through
rules_bridge.ts as a cross-check; we report where it agrees and where the template says more than
the parser can read. Those disagreements are the point of the LoRA, so they are kept.

Held out, never trained on: core_40, hard_20 (conditions-60.json), the CR-A1 min_step_4 set and
ml/tinker/data/fresh_hard_40.json. Any generated text equal to an eval text after normalising, or
with token Jaccard >= 0.6 against one, is dropped (counts in out/data_stats.json).

Usage: python gen_data.py [--n 3000] [--seed 7]
"""

from __future__ import annotations

import argparse
import json
import random
import re
import subprocess
from collections import Counter
from pathlib import Path

import common

MEMBERS = common.MEMBERS
OUTSIDERS = ["Bob", "Sarah", "Jake", "Priya", "Marco", "Lena", "Omar", "Kim", "Tess", "Dev"]
WORDS = {1: "one", 2: "two", 3: "three", 4: "four", 5: "five", 6: "six", 7: "seven", 8: "eight",
         9: "nine", 10: "ten", 11: "eleven", 12: "twelve"}


def hm(h: int, m: int = 0) -> str:
    return f"{h:02d}:{m:02d}"


def bare_to_24(h: int) -> int:
    """Fixture convention: bare 1..7 PM, 8..11 AM, 12 noon."""
    return h + 12 if 1 <= h <= 7 else h


def spoken_time(rng: random.Random) -> tuple[str, str]:
    """(surface, HH:MM) under the fixture's bare-hour convention."""
    kind = rng.choices(["bare", "ampm", "half", "colon", "oclock", "noon", "quarter"],
                       [30, 20, 8, 15, 8, 5, 4])[0]
    h = rng.randint(1, 12)
    if kind == "bare":
        return str(h), hm(bare_to_24(h))
    if kind == "ampm":
        ap = rng.choice(["am", "pm"])
        if ap == "am" and h == 12:
            h = 11
        h24 = h + 12 if ap == "pm" and h < 12 else h
        sep = rng.choice(["", " "])
        return f"{h}{sep}{ap}", hm(h24)
    if kind == "half":
        hh = rng.randint(1, 11)
        word = rng.choice([WORDS[hh], str(hh)])
        return f"half {word}", hm(bare_to_24(hh), 30)
    if kind == "colon":
        mm = rng.choice([15, 30, 45, 10, 20, 40])
        return f"{h}:{mm:02d}", hm(bare_to_24(h), mm)
    if kind == "oclock":
        return rng.choice([f"{h} o'clock", f"{h} oclock"]), hm(bare_to_24(h))
    if kind == "quarter":
        hh = rng.randint(1, 11)
        return f"quarter past {rng.choice([WORDS[hh], str(hh)])}", hm(bare_to_24(hh), 15)
    return rng.choice(["noon", "midday", "12"]), "12:00"


def name_form(rng: random.Random, n: str) -> str:
    return n.lower() if rng.random() < 0.2 else n


# ---- clause families: each returns (surface, [rules]) ----

def c_with(rng):
    n = rng.choice(MEMBERS)
    nm = name_form(rng, n)
    t = rng.choice([
        "only if {n} comes", "if {n}'s coming", "if {n} is there", "with {n}", "only with {n}",
        "as long as {n} comes", "if {n} goes", "if {n} goes too", "{n} has to come", "need {n} there",
        "if {n} joins", "only if {n} drives", "if {n}'s in", "if {n} is in", "if {n} is going",
        "provided {n} comes", "assuming {n} shows up", "if {n} tags along", "only if {n} is coming",
        "if {n} can make it", "as long as {n}'s there", "when {n} comes", "if {n} picks me up",
    ])
    return t.format(n=nm), [{"type": "with", "value": n}]


def c_with2(rng):
    a, b = rng.sample(MEMBERS, 2)
    t = rng.choice(["only if {a} and {b} come", "if {a} and {b} are going", "with {a} and {b}",
                    "if both {a} and {b} come", "need {a} and {b} there"])
    return t.format(a=name_form(rng, a), b=name_form(rng, b)), [{"type": "with", "value": a},
                                                                 {"type": "with", "value": b}]


def c_after(rng):
    s, v = spoken_time(rng)
    t = rng.choice([
        "after {t}", "not before {t}", "earliest {t}", "from {t} on", "any time after {t}",
        "free after {t}", "busy till {t}", "busy until {t}", "can't do before {t}", "after my {t} meeting",
        "after my {t} class", "starting {t}", "once I'm off work at {t}", "after I finish work at {t}",
        "when I'm done with lunch at {t}", "once I'm done with my errands around {t}",
        "after the gym around {t}", "only after {t}", "{t} at the earliest", "not until {t}",
        "I work till {t}", "after my shift ends at {t}", "after I pick up the kids at {t}",
        "after my {t} appointment", "from {t}",
    ])
    return t.format(t=s), [{"type": "after", "value": v}]


def c_back(rng):
    s, v = spoken_time(rng)
    t = rng.choice([
        "back by {t}", "home by {t}", "need to leave by {t}", "no later than {t}", "gotta be home at {t}",
        "have to be out by {t}", "done by {t}", "until {t} only", "can stay until {t}", "free until {t}",
        "have to go at {t}", "must leave at {t}", "need to be back for dinner at {t}", "curfew is {t}",
        "gotta be back by {t}", "need to be home by {t}", "out by {t}", "have to head home at {t}",
        "till {t} max", "I need to be gone by {t}", "have to get the kids at {t}", "latest {t}",
        "{t} at the latest", "need to wrap up by {t}", "back home for dinner at {t}",
    ])
    return t.format(t=s), [{"type": "back_by", "value": v}]


def c_walk(rng):
    m = rng.choice([5, 10, 15, 20, 25, 30])
    if rng.random() < 0.3:
        t = rng.choice([
            "close by", "close by only", "nearby only", "not far", "not too far", "somewhere close",
            "can't walk far", "can't walk too far", "don't want to walk far", "keep it close",
            "nothing far", "has to be close", "somewhere nearby", "not far please", "within walking distance, close",
        ])
        return t, [{"type": "max_walk", "value": 10}]
    t = rng.choice([
        "max {m} min walk", "no more than {m} minutes walking", "{m} min walk max", "max {m} minute walk",
        "under {m} min walk", "within {m} minutes walking", "{m} minutes on foot max",
        "not more than {m} mins walk", "at most {m} min walking", "nothing past a {m} min walk",
        "not too far, {m} min tops", "{m} min walk tops", "can walk {m} minutes max",
    ])
    return t.format(m=m), [{"type": "max_walk", "value": m}]


def c_step(rng):
    r = rng.random()
    if r < 0.3:
        t = rng.choice(["porch only", "just the small one", "only the small one", "the smallest one",
                        "whatever's smallest", "smallest one", "just the tiny version", "just say hi",
                        "only to say hi", "just a hello", "just sit somewhere", "sit and chill",
                        "only sitting", "just want to sit"])
        return t, [{"type": "max_step", "value": 4}]
    if r < 0.55:
        t = rng.choice(["short one", "just the short one", "short version", "the quick one",
                        "quick one only", "only a quick lap", "just a quick lap", "the shorter one",
                        "short walk only", "the quick version please", "nothing long, the short one"])
        return t, [{"type": "max_step", "value": 3}]
    if r < 0.7:
        n = rng.randint(1, 4)
        t = rng.choice(["step {n} or less", "step {n} or smaller", "at most step {n}", "step {n} or shorter",
                        "no bigger than step {n}"])
        return t.format(n=n), [{"type": "max_step", "value": n}]
    if r < 0.82:
        n = rng.randint(1, 4)
        t = rng.choice(["step {n} or more", "step {n} or bigger", "at least step {n}", "step {n} or longer",
                        "no smaller than step {n}"])
        return t.format(n=n), [{"type": "min_step", "value": n}]
    if r < 0.92:
        t = rng.choice(["the long one", "just the long one", "full walk only", "the whole walk",
                        "the full loop", "the whole thing or I'm out", "the big one", "longest one please",
                        "the full walk please"])
        return t, [{"type": "min_step", "value": 1}]
    t = rng.choice(["at least the park loop", "the park loop or more", "the park loop or longer",
                    "park loop minimum"])
    return t, [{"type": "min_step", "value": 2}]


FAMILIES = [(c_with, 18), (c_with2, 4), (c_after, 20), (c_back, 20), (c_walk, 12), (c_step, 12)]

PREFIX = ["", "", "", "", "I'm in ", "count me in ", "sure, ", "ok ", "yeah ", "down ", "I can do it ",
          "I'll come ", "in, ", "yes but ", "sounds fun, "]
SUFFIX = ["", "", "", "", "!", " I'm in", " then I'm in", " lol", " pls", " :)", "."]
JOIN = [", ", " and ", ", and ", " but ", ". ", " - ", " also "]


def positive(rng) -> tuple[str, list]:
    k = rng.choices([1, 2, 3], [55, 35, 10])[0]
    rules: list = []
    parts: list[str] = []
    used: set[str] = set()
    tries = 0
    while len(parts) < k and tries < 20:
        tries += 1
        fam = rng.choices([f for f, _ in FAMILIES], [w for _, w in FAMILIES])[0]
        s, r = fam(rng)
        kinds = {x["type"] for x in r}
        if kinds & used and not kinds <= {"with"}:
            continue
        if "with" in kinds and "with" in used:
            continue
        used |= kinds
        parts.append(s)
        rules += r
    text = parts[0]
    for p in parts[1:]:
        text += rng.choice(JOIN) + p
    pre = rng.choice(PREFIX)
    if pre and not text[0].isupper():
        text = pre + text
    elif pre:
        text = pre + text
    text += rng.choice(SUFFIX)
    if rng.random() < 0.3:
        text = text[0].upper() + text[1:]
    if rng.random() < 0.04:
        text = text.upper()
    return text, rules


def negative(rng) -> tuple[str, object]:
    r = rng.random()
    if r < 0.25:  # plain yes
        return rng.choice(["ok", "okay", "sure", "yes", "yep", "yeah", "count me in", "I'm in", "im in", "down",
                           "sounds good", "let's go", "for sure", "bet", "absolutely", "in!", "I'm in!!",
                           "yes please", "totally", "count me in!", "Sure!", "OK"]), []
    if r < 0.45:  # vague
        return rng.choice(["maybe", "idk", "not sure", "we'll see", "probably", "depends", "possibly",
                           "might come", "dunno", "hmm", "let me check", "maybe later", "not sure yet",
                           "ask me later", "could be", "eh", "no idea", "might be late idk"]), None
    if r < 0.65:  # OR alternatives
        a, b = rng.sample(MEMBERS, 2)
        s1, _ = spoken_time(rng)
        s2, _ = spoken_time(rng)
        return rng.choice([
            f"if {a} or {b} comes", f"with {a} or {b}", f"after {s1} or after {s2}",
            f"back by {s1} or {s2}", f"short one or the park loop", f"{a} or {b} has to come",
            f"only if {a} or {b} is there", f"after {s1}, or with {a}",
        ]), None
    if r < 0.8:  # impossible times
        # v2: only hours past 23 are impossible. v1 also labelled 13, 14, 19 and "13pm" unparsed,
        # which are valid 24 h times for the rules parser; that label bug taught "after N" -> unparsed.
        h = rng.choice([24, 25, 26, 27, 30, 36, 40, 48, 99])
        return rng.choice([f"after {h}", f"back by {h}", f"not before {h}", f"home by {h}",
                           f"after {h}:00", "back by 3:75", "after 4:61", f"back by {h}:30"]), None
    o = rng.choice(OUTSIDERS)  # not in group
    return rng.choice([f"only if {o} comes", f"with {o}", f"if {o} is there", f"if {o}'s coming",
                       f"only with {o}", f"if {o} comes too", f"as long as {o} comes"]), "error:not_in_group"


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9: ]", "", s.lower()).strip()


def toks(s: str) -> set[str]:
    return set(norm(s).split())


def held_out_texts() -> list[str]:
    fx = json.loads((common.REPO / "docs/requirements/fixtures/conditions-60.json").read_text())
    cr = json.loads((common.REPO / "evals/datasets/conditions-cr-a1.json").read_text())
    texts = [c["text"] for c in fx["core_40"] + fx["hard_20"] + cr["min_step_4"]]
    fresh = common.HERE / "data" / "fresh_hard_40.json"
    if fresh.exists():
        texts += [c["text"] for c in json.loads(fresh.read_text())["items"]]
    return texts


def rules_parser(texts: list[str]) -> list:
    out = subprocess.run(["node", str(common.HERE / "rules_bridge.ts"), "parse"], input=json.dumps(texts),
                         capture_output=True, text=True, check=True, cwd=common.REPO)
    return json.loads(out.stdout)


def key(v) -> str:
    if v is None or isinstance(v, str):
        return json.dumps(v)
    return "|".join(sorted(f"{r['type']}={r['value']}" for r in v))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=3000)
    ap.add_argument("--seed", type=int, default=7)
    a = ap.parse_args()
    rng = random.Random(a.seed)
    held = held_out_texts()
    held_norm = {norm(t) for t in held}
    held_toks = [toks(t) for t in held]
    seen: set[str] = set()
    rows = []
    drop = Counter()
    while len(rows) < a.n:
        text, label = negative(rng) if rng.random() < 0.18 else positive(rng)
        n = norm(text)
        if n in seen:
            drop["duplicate"] += 1
            if drop["duplicate"] > 50 * a.n:
                break
            continue
        if n in held_norm:
            drop["equals_eval_item"] += 1
            continue
        tk = toks(text)
        if any(len(tk & h) / max(1, len(tk | h)) >= 0.6 for h in held_toks):
            drop["near_eval_item_jaccard_0.6"] += 1
            continue
        seen.add(n)
        rows.append({"text": text, "expect": label})

    parsed = rules_parser([r["text"] for r in rows])
    agree = Counter()
    for r, p in zip(rows, parsed):
        r["rules_parser"] = p
        agree["agrees" if key(p) == key(r["expect"]) else "differs"] += 1
    kinds = Counter()
    for r in rows:
        e = r["expect"]
        if e is None:
            kinds["unparsed"] += 1
        elif isinstance(e, str):
            kinds[e] += 1
        elif not e:
            kinds["plain_yes"] += 1
        else:
            for x in e:
                kinds[x["type"]] += 1

    common.OUT.mkdir(exist_ok=True)
    with (common.OUT / "train.jsonl").open("w") as f:
        for r in rows:
            f.write(json.dumps(r) + "\n")
    stats = {
        "seed": a.seed,
        "examples": len(rows),
        "dropped": dict(drop),
        "rule_counts": dict(kinds),
        "rules_parser_cross_check": dict(agree),
        "rules_parser_agree_rate": round(agree["agrees"] / len(rows), 3),
        "held_out_texts": len(held),
        "differs_examples": [{"text": r["text"], "template": r["expect"], "rules_parser": r["rules_parser"]}
                             for r in rows if key(r["rules_parser"]) != key(r["expect"])][:25],
    }
    (common.OUT / "data_stats.json").write_text(json.dumps(stats, indent=2) + "\n")
    print(json.dumps({k: v for k, v in stats.items() if k != "differs_examples"}, indent=2))


if __name__ == "__main__":
    main()
