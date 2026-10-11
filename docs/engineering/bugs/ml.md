# Bugs: ML

## BUG-ML-1
- **Date:** 2026-10-10
- **Area:** ML, `packages/shared/src/prompts/rest-loop.ts`
- **Symptom:** "two hours, steps are fine" read as no duration (eval R10).
- **Cause:** The number-word list had no one-digit words, so "two hours" did not match.
- **Fix:** Added two, three, four to `NUM_WORDS` and the pattern.
- **Proof:** `npm run eval -- rest-loop`: plain requests 15/16 before, 16/16 after.

## BUG-ML-2
- **Date:** 2026-10-10
- **Area:** ML, `evals/harness/tasks/photo.ts`
- **Symptom:** "Park'" from the sign text 'Scentral Park' flagged as an invented name.
- **Cause:** The word pattern kept the closing quote, so the allow-list lookup missed.
- **Fix:** Trim quotes from each word before the lookup; test in `evals/test/harness.test.ts`.
- **Proof:** Test "suspect names skip sentence starts, sign text and quotes" passes.

## BUG-ML-3
- **Date:** 2026-10-10
- **Area:** ML, ladder prompt v1
- **Symptom:** 6 of 12 ladder drafts over the 8 s budget (p95 8.8 s), so they fell to the template.
- **Cause:** The v1 answer shape (`{"steps":[{step,label,minutes}...]}`) cost about 90 output tokens.
- **Fix:** Prompt v2 asks for `{"labels":[...],"minutes":[...]}`; `num_predict` 160 to 80; the guard accepts both shapes.
- **Proof:** `npm run eval -- ladder`: 12/12 hub answers used, p95 6.5 s.
