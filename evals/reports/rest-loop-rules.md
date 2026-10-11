# Eval: rest-loop (rules tier)

Model: none (rules): packages/shared/src/prompts/rest-loop.ts@1. Prompt: n/a (no model; SRS-PRIV-1). Date: 2026-10-11T01:01:18.201Z. Items: 20.

| Bar | Target | Measured | Pass |
| --- | --- | --- | --- |
| E16-S1 AC1 example | pass | pass | yes |
| Plain requests, all fields right | ≥ 15/16 | 16/16 | yes |
| Hard requests (reported) | report | 4/4 | yes |
| Read-backs over 12 words | 0 | 0 | yes |

## Notes

- A wrong field is caught by the read-back: the person sees it and edits it before any loop is built (SRS-REST-1).

Per-item results: `rest-loop-rules.json`.
