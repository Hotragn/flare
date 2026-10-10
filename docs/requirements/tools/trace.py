#!/usr/bin/env python3
"""Build and check Flare's requirements traceability matrix.

Reads docs/requirements/01-srs.md, docs/requirements/03-business-rules.md,
docs/product/03-prd.md and docs/product/05-backlog.md. Writes
docs/requirements/05-rtm.csv, keeping any values later roles have filled in
the design, code, test and proof columns. Exits 1 if any link is broken.

Usage: python3 docs/requirements/tools/trace.py [--check]
  --check  verify only; don't rewrite the CSV
"""
import csv
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SRS = ROOT / "docs/requirements/01-srs.md"
BR = ROOT / "docs/requirements/03-business-rules.md"
PRD = ROOT / "docs/product/03-prd.md"
BACKLOG = ROOT / "docs/product/05-backlog.md"
RTM = ROOT / "docs/requirements/05-rtm.csv"

FIELDS = ["req_id", "priority", "verify", "requirement", "prd_source", "business_rules",
          "stories", "acceptance_criteria", "design", "code", "test", "proof"]
LATER = ["design", "code", "test", "proof"]


def srs_rows():
    rows = []
    for line in SRS.read_text().splitlines():
        m = re.match(r"\|\s*(SRS-[A-Z0-9]+-\d+)\s*\|(.*)\|\s*$", line)
        if not m:
            continue
        cells = [c.strip() for c in m.group(2).split("|")]
        if len(cells) != 5:
            raise SystemExit(f"Malformed SRS row: {m.group(1)} has {len(cells)} cells")
        req, pri, src, story, ver = cells
        rows.append({"req_id": m.group(1), "requirement": req, "priority": pri,
                     "source": src, "story": story, "verify": ver})
    return rows


def expand_ranges(text, prefix):
    """Expand 'FR-PLAN-12 to 14' and 'BR-S-1 to BR-S-6' into explicit ids."""
    out = set()
    pat = re.compile(rf"({prefix}[A-Z0-9]*-)(\d+)(?:\s*to\s*(?:{prefix}[A-Z0-9]*-)?(\d+))?")
    for m in pat.finditer(text):
        a = int(m.group(2))
        b = int(m.group(3)) if m.group(3) else a
        for i in range(a, b + 1):
            out.add(f"{m.group(1)}{i}")
    return out


def stories_in(text):
    out = set()
    for m in re.finditer(r"E(\d+)-S(\d+)(?:\s*to\s*S(\d+))?", text):
        e, a = m.group(1), int(m.group(2))
        b = int(m.group(3)) if m.group(3) else a
        for i in range(a, b + 1):
            out.add(f"E{e}-S{i}")
    for m in re.finditer(r"\bE(\d+)\b(?!-S)", text):
        out.add(f"E{m.group(1)}")
    return out


def main():
    check_only = "--check" in sys.argv
    errors = []
    rows = srs_rows()
    ids = [r["req_id"] for r in rows]
    dupes = {i for i in ids if ids.count(i) > 1}
    if dupes:
        errors.append(f"Duplicate SRS ids: {sorted(dupes)}")

    br_ids = set(re.findall(r"\|\s*(BR-[A-Z]+-\d+)\s*\|", BR.read_text()))
    prd_text = PRD.read_text()
    prd_ids = set(re.findall(r"\*\*((?:FR|NFR)-[A-Z0-9]+-?\d*[a-z]?)\*\*", prd_text))
    prd_ids |= set(re.findall(r"\|\s*(FR-AI-\d+)\s*\|", prd_text))
    backlog = BACKLOG.read_text()
    story_ids = set(re.findall(r"\*\*(E\d+-S\d+)\b", backlog))
    epic_ids = set(re.findall(r"^## (E\d+)\.", backlog, re.M))
    ac_by_story = {}
    current = None
    for line in backlog.splitlines():
        m = re.match(r"\*\*(E\d+-S\d+)\b", line)
        if m:
            current = m.group(1)
            ac_by_story.setdefault(current, [])
        elif current and re.match(r"- AC\d+:", line.strip()):
            ac_by_story[current].append(line.strip()[2:])
        elif line.startswith("## "):
            current = None

    used_br, used_prd, used_story = set(), set(), set()
    old = {}
    if RTM.exists():
        with RTM.open() as f:
            for r in csv.DictReader(f):
                old[r["req_id"]] = r

    out = []
    for r in rows:
        text = " ".join([r["requirement"], r["source"], r["story"]])
        brs = expand_ranges(text, "BR-")
        prds = expand_ranges(text, "FR-") | expand_ranges(text, "NFR-")
        sts = stories_in(r["story"] + " " + r["source"])
        for b in brs:
            if b not in br_ids:
                errors.append(f"{r['req_id']}: unknown business rule {b}")
        for s in sts:
            if s.startswith("E") and "-S" in s and s not in story_ids:
                errors.append(f"{r['req_id']}: unknown story {s}")
            if "-S" not in s and s not in epic_ids:
                errors.append(f"{r['req_id']}: unknown epic {s}")
        if not sts and r["story"].lower() != "all":
            errors.append(f"{r['req_id']}: no story")
        used_br |= brs
        used_prd |= prds
        used_story |= sts
        acs = []
        for s in sorted(sts):
            m = re.search(rf"{re.escape(s)}\s+(AC\d+(?:,\s*AC\d+)*)", r["story"])
            wanted = re.findall(r"AC\d+", m.group(1)) if m else None
            for ac in ac_by_story.get(s, []):
                if wanted is None or ac.split(":")[0] in wanted:
                    acs.append(f"{s} {ac}")
        row = {
            "req_id": r["req_id"], "priority": r["priority"], "verify": r["verify"],
            "requirement": r["requirement"], "prd_source": r["source"],
            "business_rules": " ".join(sorted(brs)), "stories": " ".join(sorted(sts)),
            "acceptance_criteria": " | ".join(acs) if acs else "(see story)",
        }
        for k in LATER:
            row[k] = old.get(r["req_id"], {}).get(k, "")
        out.append(row)

    # Reverse coverage: every story, rule and PRD requirement is traced.
    covered_stories = {s for s in used_story if "-S" in s}
    covered_epics = {s for s in used_story if "-S" not in s}
    for s in sorted(story_ids):
        if s not in covered_stories and s.split("-")[0] not in covered_epics:
            errors.append(f"Story {s} has no SRS requirement")
    for b in sorted(br_ids - used_br):
        errors.append(f"Business rule {b} is not referenced by any SRS requirement")
    for p in sorted(prd_ids - used_prd):
        errors.append(f"PRD requirement {p} is not referenced by any SRS requirement")

    if not check_only:
        with RTM.open("w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=FIELDS)
            w.writeheader()
            w.writerows(out)

    print(f"SRS requirements: {len(rows)} (P0 {sum(r['priority'].startswith('P0') for r in rows)}, "
          f"P1 {sum(r['priority'].startswith('P1') for r in rows)})")
    print(f"Business rules: {len(br_ids)} defined, {len(used_br & br_ids)} traced")
    print(f"PRD requirements: {len(prd_ids)} defined, {len(used_prd & prd_ids)} traced")
    print(f"Backlog stories: {len(story_ids)} defined, "
          f"{len([s for s in story_ids if s in covered_stories or s.split('-')[0] in covered_epics])} traced")
    if errors:
        print(f"\n{len(errors)} problem(s):")
        for e in errors:
            print(" -", e)
        sys.exit(1)
    print("Traceability check passed.")


if __name__ == "__main__":
    main()
