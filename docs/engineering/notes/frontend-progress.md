# Frontend progress (wp/frontend)

## Done
1. FE1: prototype components, copy loader (reads design deck directly, slimmed in the bundle), motion, sounds into apps/web; tokens and icons read from design/system and brand/icons; root layout imports zod-csp first; fallback 200.html; error code to copy map (flow/errors.ts).
2. FE3: /g/{id}/ link page (LinkPage.svelte + flow/link.svelte.ts): key check, join with sealed name, optimistic I'm in, condition and read-back, not-suit (Ember only), Lit, Ember, gone, Spark, Plans P4 to P6, Telegram bind, rememberGathering.
3. FE4: Lit and compass (flow/compass.ts): orientation first in the tap, webkitCompassHeading, distance, speech cadence, offline copy.
4. Real PWA modules wired (flow/wire.ts); CR-PW2 head tags, CR-PW3 fallback. bits-ui replaced by native dialog and radios (JS 150.9 to 129.8 KB).
5. FE2: host flow /app/ (HostPage.svelte + flow/host.svelte.ts): camera, draft, spot, send (sealed), share, plain text, text yes, cancel, +1, Done; Plans P1, P2.
Tests: 37 in apps/web/test/flow (npx vitest run --config apps/web/test/flow/vitest.config.ts).

## In progress
6. Catalog /dev/components and /dev/screens with stories in light, dark, sun.

## Next step
Rewrite routes/dev/components and add routes/dev/screens from registry stories; then visual regression (apps/web/test/visual), matrix, budgets, docs/frontend, handoff 07a.
