# Website and FE6/FE7 bugs (wp/website)

Format: ID, date, area, symptom, cause, fix, proof. The lead renumbers into docs/BUGLOG.md.

## BUG-WEB-1: Device-check pages fail axe (serious and critical)

- **Date:** 2026-10-10
- **Area:** FE7 accessibility pass, `/check/` (owners ODAI and MAP; reported, not fixed here)
- **Symptom:** `node apps/web/test/site/a11y.ts` on the build: `/check/capability/` has a form field with no label (critical), 5 low-contrast nodes (serious) and an 13 x 13 px switch; `/check/compass.html` has a scrollable log that keyboard users can't focus (serious) and a 24 x 24 px checkbox; `/check/` has 4 low-contrast nodes in dark mode.
- **Cause:** The kit was imported from lab spike 04 for one-off use on Sunday morning, before the design system.
- **Fix:** Not changed: the files are another area's and the kit is used once by the team, not by guests. The pass reports `/check/` as advisory and blocks on every other page.
- **Proof:** 32 page views, 22 findings, all 14 serious or critical ones on `/check/`; 0 on the app and website pages.

## BUG-WEB-2: The a11y runner printed nothing when run from this repo

- **Date:** 2026-10-10
- **Area:** FE7 tooling
- **Symptom:** `node apps/web/test/site/a11y.ts` exited 0 with no output.
- **Cause:** The "run as script" check compared `import.meta.url` with `file://${argv[1]}`; the repo path has spaces, which the URL encodes as `%20`.
- **Fix:** Compare `fileURLToPath(import.meta.url)` with `path.resolve(argv[1])`.
- **Proof:** The runner now prints one line per finding and the summary line.
