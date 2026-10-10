# Flare: Requirements traceability matrix

The matrix is [05-rtm.csv](05-rtm.csv), one row per SRS requirement (159 rows). It is generated and checked by [tools/trace.py](tools/trace.py).

## Columns

| Column | Filled by | Meaning |
| --- | --- | --- |
| req_id | Analyst | SRS id |
| priority | Analyst | P0 (Sun 10 AM RC), P1 (before the DEV deadline) |
| verify | Analyst | T test, D demonstration, I inspection, A analysis |
| requirement | Analyst | The "shall" statement |
| prd_source | Analyst | PRD, business rule or founder source |
| business_rules | Tool | BR ids found in the row |
| stories | Tool | Backlog stories (and epics) the row traces to |
| acceptance_criteria | Tool | The ACs of those stories, copied from 05-backlog.md |
| design | Design | Screen, component or spec id |
| code | Engineering | Module path or PR |
| test | QA | Test id or file |
| proof | QA, Ops | Link to output, screenshot, video or audit printout |

## Rules for later roles

- Fill the design, code, test and proof columns in the CSV. The tool keeps them when it regenerates.
- Never edit the analyst columns in the CSV; change 01-srs.md and re-run the tool.
- Run before every commit that touches requirements, the PRD or the backlog:

```bash
python3 docs/requirements/tools/trace.py
```

It exits 1 and lists problems when an SRS row names an unknown rule or story, or when any business rule, PRD requirement or backlog story is not traced.

## Last run (Sat 2026-10-10)

```
SRS requirements: 159 (P0 140, P1 19)
Business rules: 84 defined, 84 traced
PRD requirements: 105 defined, 105 traced
Backlog stories: 61 defined, 61 traced
Traceability check passed.
```

The first run found 33 gaps (13 rules, 18 PRD requirements and 2 stories untraced). All were closed by adding SRS-ID-7, RES-8, COND-9, SOL-4, TIME-1, PLAN-10, PLAN-11, CMP-7, ACC-6, HOT-3, OFF-6, PRIV-8 and FLD-5, and by citing missing sources on existing rows.
