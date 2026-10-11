# On-device AI progress (wp/on-device-ai)

## Done
1. OD1 rules parser and OD2 read-back (`apps/web/src/lib/conditions/`): core_40 40/40, hard_20 17/20, 4 min_step phrases.
2. Tier selection, typed fallback, ladder and Plan logic (`apps/web/src/lib/ai/`: tier.ts, typed.ts, ladder.ts, plan.ts).
3. Hub ladder-draft job (`apps/hub/src/ladder.ts`, client.ts queue).
4. ICD-8 probe (`apps/web/src/lib/capabilities/`), device check cards (Flare features, photo resize, shader gate); Mac Chrome run via `node apps/web/test/e2e/check-mac.ts`: detect 4.3 ms, resize median 106 ms, shader 59.9 fps.

## In progress
- /ai/ status screen.

## Exact next step
Write `apps/web/src/routes/ai/+page.svelte` (+page.ts prerender), then privacy test (network capture), `npm run hub:field`, docs/ai-runtime, handoff.
