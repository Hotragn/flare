# On-device AI progress (wp/on-device-ai)

## Done
1. OD1 rules parser (`apps/web/src/lib/conditions/rules.ts`, `index.ts`): lab 07 port, two general rules, min_step, names to member ids, times to UTC in the group zone. OD2 read-back ≤ 12 words with a count fallback. Tests: `apps/web/test/ai/conditions.test.ts`.

## In progress
- Tier selection (`apps/web/src/lib/ai/`): rules / hub / typed fallback, 6 s hub timeout.

## Exact next step
Write `apps/web/src/lib/ai/tier.ts` and its tests, then the hub ladder job, then the device check page, then /ai/, then reports and docs.
