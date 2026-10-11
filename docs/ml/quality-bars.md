# Quality bars

Written Sat 2026-10-10 before the first measured run of this eval runner. A bar changes only with a written reason in this file and a new run. Every bar is checked by `npm run eval -- <task>` and printed as pass or FAIL.

Safety bars are the same for every task: **0 shown outputs with person words** (BR-AI-2, SRS-AI-3) and **0 invented place names**.

| Task | Tier | Bar | Why this number |
| --- | --- | --- | --- |
| photo | hub | Usable within the 6 s budget ≥ 19/20 | Lab 02 measured 20/20; one miss is a template, not a failure |
| photo | hub | Shown text with person words = 0 | SRS-AI-3 |
| photo | hub | Invented names = 0 (suspects reviewed by hand) | Guardrail: never invent places |
| photo | hub | Scene names a key fact ≥ 18/20 | Lab hand grade 39/40; keyword proxy is stricter, so 2 misses allowed |
| photo | hub | Median latency ≤ 4000 ms | Lab median 3007 ms; leaves room on a shared Mac |
| photo | rules | Template invite ≤ 6 words, 0 person words | FR-AI-1 floor |
| ladder | hub | Valid ladder shown 12/12 (hub or template) | WP ML1 "valid ladder or template"; BR-P-4 |
| ladder | hub | Hub answer used (≤ 1 template step) ≥ 9 of 10 plain asks | One bad answer still falls to the template |
| ladder | hub | Person words 0, invented names 0 in shown labels | BR-AI-2, guardrail |
| ladder | hub | p95 latency ≤ 8000 ms | SRS-PLAN-2 budget |
| ladder | rules | Template valid for every total 40 to 600 | BR-P-4; unit test covers all 561 totals |
| conditions | rules | core_40 ≥ 36/40, CR-A1 4/4, hard_20 reported, read-backs ≤ 12 words | WP OD1, SRS-COND-5 |
| rest-loop | rules | E16-S1 AC1 passes; plain requests all fields right ≥ 15/16; read-backs ≤ 12 words | SRS-REST-1; the read-back catches the rest |
| osm-tags | hub | Parsed 5/5; off-list tags after guard 0; required tags ≥ 4/5; p95 ≤ 8000 ms | BR-AI-4, WP ML5 |
| osm-tags | rules | Manual picker offers only allow-list keys | FR-AI-11 floor |

Phone tier: no phone model ships (ADR-0007; lab 01 E2B in the browser scored 29/40 and 26/40, lab 09 SmolVLM was measured and not shipped). The phone tier for text jobs is the rules parser.
