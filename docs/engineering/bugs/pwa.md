# PWA and offline bugs

## BUG-PWA-1: build fails on `$service-worker`
- Date: 2026-10-10. Area: PWA.
- Symptom: `vite build` stopped with `module_removed_service_worker`.
- Cause: SvelteKit 3.0.1 removed `$service-worker`. Lists now come from `$app/manifest` (`immutable`, `assets`, `prerendered`, as `{ path }` relative to the base) and `version` from `$app/env`.
- Fix: service-worker.ts imports the new modules and makes the paths absolute.
- Proof: `npm run build` builds `service-worker.js`; e2e check 3 finds `/`, `/hello/` and the map pack in the cache.

## BUG-PWA-2: zod made the service worker 31 KB
- Date: 2026-10-10. Area: PWA.
- Symptom: web JS went from 62.7 KB to 93.2 KB gzipped after the service worker landed.
- Cause: `NoticeText.safeParse` pulled all of zod into the worker bundle.
- Fix: `isNoticeText` in lib/push/notice.ts mirrors the schema; a test checks it agrees with zod on 12 samples.
- Proof: service worker 6,356 bytes gzipped; `npm run budget` 68.8 KB of 150.

## BUG-PWA-3: web unit tests can't load without a SvelteKit sync
- Date: 2026-10-10. Area: PWA.
- Symptom: vitest failed with `Failed to load tsconfig '$app/tsconfig'` for files under apps/web.
- Cause: apps/web/tsconfig.json extends `$app/tsconfig`, which exists only after `svelte-kit sync`.
- Fix: run `npx -w apps/web svelte-kit sync` first (the root `typecheck` already does); apps/web/test/pwa has its own tsconfig for types.
- Proof: 54 tests pass after a sync.
