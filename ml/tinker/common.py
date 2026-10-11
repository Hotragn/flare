"""Shared helpers: key loading (never printed), paths, prompt format, rule JSON."""

from __future__ import annotations

import json
import os
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
OUT = HERE / "out"
# The founder's .env lives in the main checkout, not in worktrees.
ENV_CANDIDATES = [REPO / ".env", Path("/Users/hotragn/Documents/Claude Code/HacktoberFest/flare/.env")]

BASE_MODEL = os.environ.get("FLARE_TINKER_BASE", "Qwen/Qwen3.5-4B")
MEMBERS = ["Fuego", "Amor", "Shilp", "Ammo"]
STEPS = [(1, "the full walk"), (2, "the park loop"), (3, "a quick lap"), (4, "just say hi")]


def load_key() -> None:
    """Map TINKER or TINKER_API_KEY from .env into the SDK's env var, in process only. Never printed."""
    if os.environ.get("TINKER_API_KEY"):
        return
    for p in ENV_CANDIDATES:
        if not p.exists():
            continue
        vals: dict[str, str] = {}
        for line in p.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            vals[k.strip()] = v.strip().strip('"').strip("'")
        for name in ("TINKER_API_KEY", "TINKER"):
            if vals.get(name):
                os.environ["TINKER_API_KEY"] = vals[name]
                return
    raise SystemExit("no Tinker key found in .env (TINKER or TINKER_API_KEY)")


SYSTEM = (
    "You turn a friend's reply to an outing invite into rules. Output only JSON: "
    'a list of {"type","value"} objects, or the string "unparsed", or "error:not_in_group".\n'
    "Types: with (member name), after (HH:MM 24h), back_by (HH:MM 24h), max_walk (minutes), "
    "max_step (1-4), min_step (1-4).\n"
    "Group members: Fuego, Amor, Shilp, Ammo. Plan steps, biggest first: 1 the full walk, "
    "2 the park loop, 3 a quick lap, 4 just say hi.\n"
    "Bare hours 1 to 7 mean PM, 8 to 11 mean AM, 12 means noon. 'close by' and 'not far' mean max_walk 10. "
    "A plain yes is []. Anything with OR between options, vague, or impossible is \"unparsed\". "
    'A name not in the group is "error:not_in_group".'
)


def messages(text: str) -> list[dict]:
    return [{"role": "system", "content": SYSTEM}, {"role": "user", "content": f"Reply: {text}"}]


def encode_answer(expect) -> str:
    """Canonical target string. null -> "unparsed" (the eval's unparsed form)."""
    if expect is None:
        return '"unparsed"'
    if isinstance(expect, str):
        return json.dumps(expect)
    return json.dumps([{"type": r["type"], "value": r["value"]} for r in expect], separators=(",", ":"))


def _try_json(s: str):
    try:
        return True, json.loads(s)
    except Exception:
        return False, None


def decode_answer(s: str):
    """Model text back to the eval's Simple form; anything malformed counts as unparsed (null)."""
    s = s.strip()
    if s.startswith("```"):
        s = s.strip("`").strip()
        if s.startswith("json"):
            s = s[4:].strip()
    ok, v = _try_json(s)
    if not ok:
        for open_, close in (("[", "]"), ('"', '"')):
            i, j = s.find(open_), s.rfind(close)
            if i != -1 and j > i:
                ok, v = _try_json(s[i : j + 1])
                if ok:
                    break
    # Lenient on one wrapper: ["error:not_in_group"] or ["unparsed"] reads as the bare string.
    if ok and isinstance(v, list) and len(v) == 1 and isinstance(v[0], str):
        v = v[0]
    if not ok or v == "unparsed":
        return None
    if isinstance(v, str):
        return v
    if isinstance(v, list) and all(isinstance(r, dict) and "type" in r and "value" in r for r in v):
        return [{"type": r["type"], "value": r["value"]} for r in v]
    return None
