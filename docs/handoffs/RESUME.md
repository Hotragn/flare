# Resume note

## Now: Sun 2026-10-11, 11:55 PM ET. Read this first.
- **Live:** 0e7a81825764. Smoke passes. Lighthouse is 100 on all 5 pages, mobile and desktop. npm test passes 830/830. /app 149.1 KB, /g 148.2 KB.
- **Main is stable for the 1:00 AM freeze.** Nothing is open on any branch, and every subagent branch is merged.
- **Fresh-eyes rounds** (AI testers with no context): 5, 6, 5, 6, 6, 6, then 7 after the fixes. Details in docs/research/fresh-eyes-2026-10-11.md.
- **Post:** docs/post/draft.md. docs/post/REVIEW.md lists the founder's holes and decisions: Mastra (LADDER_AGENT is off live), ATUS microdata (a next step), the repo going public, the session scrub, DigitalOcean.
- **Left for after the deadline:**
  - the host's screens should show the photo and the words
  - the host should see when a friend adds a condition
  - stop asking returning users for their name again
  - the desktop QR code carries the full invite link
  - "Here: 1" is the host's headcount by design, but testers read it as "1 arrived". Relabel it

## Now: Sun 2026-10-11, ~10:35 PM ET. Read this first.
Freeze 1:00 AM ET. Deadline Mon 06:59 UTC.

**Live: 68afd9b (smoke passes).** All six live bugs from field test 1 are fixed and live:
- 1, photo fit: 73% covered before, 0% after; e2e:photo-fit passes.
- 2/3, conditions: 10min, bare hours, with you, missed words, rule chips.
- 4, share is called in the tap with a Copy link fallback (e2e:share 27/27, Chrome and WebKit).
- 5, the honest Sent line.
- 6, the service worker loads pages network-first and takes over at once (e2e:sw-update 8/8, founder's iPhone confirmed).
- The Near-X grammar.

Also live:
- Since launch totals (GET /api/v1/stats, counting from 02:16 UTC; x-flare-test groups excluded).
- site-motion and app-motion, both merged (/app 148.3 KB, /g 147.9 KB).
- The nav wraps at 375 px.
- The hero was recaptured.
- Automations: Again, Telegram direct send, auto I'm here.

**Cut:** Sounds of the spot (lab: 8 of 12 voices at best, so it failed the bar). It appears only as a row in the AI page's "Measured, not shipped".
**Off:** Remember this (REMEMBER_THIS); the post gets one next-step line.
**Post:** docs/post/draft.md (post-rework merged, 1,713 words, 7 of 8 images), with holes listed at its top.

**Running:**
- Fresh-eyes round 6, a no-context tester on live (includes the WhatsApp-poll question).
- The Why it matters rework on the site subagent (BLS ATUS 2025, WHO 2025, the chart system). Our own ATUS microdata series needs the founder's yes for the bls.gov downloads.

**After the freeze:** fill [NEW TONIGHT] (done) and [ROUND 6]; the founder fills the other holes; recapture the hero GIF; update REVIEW.md.

## Now: Sun 2026-10-11, ~9:15 PM ET, usage-limit pause (resets 9:50 PM ET). Read this first.
Freeze 1:00 AM ET. Deadline Mon 06:59 UTC. Order: live bugs 1 to 4, then site clarity, then the rest.

**Main (live, deploy started for 2751410 + format fix):**
- 7792e2c Automations: Again on Home (last crew size, no photo, place words), Telegram-linked Send posts directly with no share sheet, auto I'm here within 30 m on 2 good fixes with a 10 s Undo.
- 2751410 Live bugs 2 and 3, conditions:
  - "10min" and the other delay phrasings are read as a delay;
  - a bare hour picks the next one coming;
  - "with you" means the host;
  - missed words are said back ("I didn't catch: ...");
  - tap-to-fill chips from the time of day and the host;
  - cond.didntCatchNow replaces the fixed hint on screen. cond.didntCatch (SRS-COND-8) is unchanged and is still what parseError returns.
  - Tests: apps/web/test/ai/conditions-live.test.ts, 10 tests including a fast-check property. blind_40 30/40 before and after; core 40/40, hard_20 20/20, fresh 40/40 (ml/tinker/out/eval_after_fix.json).
  - TODO after the reset: live smoke, then a manager status line with the friend's sentence before and after.

**Worktree branches (merge in this order):**
1. Photo fit, live bug 1 (agent a3799e92ab8ab5a63, worktree-agent-a3799e92ab8ab5a63): I1Invite, H2Develop, H3Send and PhotoPrint, the dark-photo display filter, the private chip on one line and remembered once closed, the e2e:photo-fit overlap gate under 25% at 390x664, 375x667 and 390x844, and before/after shots in docs/frontend/evidence/photo-fit/. The manager wants the 390x664 before/after shots once it's live. "Fuego is at Near Heather Drive" grammar (fix 4) is NOT done yet: it's the lead's job, for invite.where, invite.whereWalk, lit.notice, push.lit and sms.lit, with a test over street, park and bench spots.
2. Share, live bug 4 (agent a26567a1d6d5b923c, worktree-agent-a26567a1d6d5b923c): navigator.share synchronous in the tap after the Flare exists, a real wa.me anchor, Copy link fallback with a toast, WebKit slow-network test, docs/frontend/evidence/share-matrix.md (honest about real devices).
3. site-motion (agent a1ac31aa2d2a5e6f7, branch site-motion, a3e295f mergeable): Why it matters (4 charts from primary sources; Surgeon General numbers NOT used, hhs.gov 403), Start in a minute, Crew space, Running now (copy-lint bans "right now"), Try it on your photo, the scroll story. Lighthouse mobile home perf was 99 and being tuned.
4. app-motion (paused, worktree-agent-a5311b695b3086d89 at 4119624, rebased on 7792e2c). After merging:
   - wire H5HostKindling `ember`, H0Home `at` = homeAt, and wind later;
   - rerun npm test, e2e demo/sparks/loop, axe and perf;
   - take the after shots and GIFs (tools/motion/).
   - Budget on its last full build: 146.7 / 146.8 KB.
5. post-rework (worktree-agent-a0e24f31091a79c08 at 5e2e6a5): docs/post only, about 1,585 words, 6 of 8 images, holes listed in its commit. It's paused; the holes get filled after the freeze.

**Still to do:** the Near-X grammar; Sounds of the spot (waiting on lab numbers); Remember this stays OFF unless the consent tests pass by 1 AM; fresh-eyes round 6 (testers use their own dark photo, plus the WhatsApp-poll question, answers quoted verbatim); gates after the merges (Lighthouse 100, axe 0, budget under 150 KB, CSP, smoke); post holes after the freeze.

## Now: Sun 2026-10-11, ~16:10 ET (read this first)
- **Live:** https://flare-outside.onrender.com (Render free tier, auto-deploy off; `npm run deploy:render -- --yes`). The hub runs on this Mac against live (`FLARE_SERVER_URL=wss://flare-outside.onrender.com npm run hub`); restart it after hub code changes.
- **Done today:**
  - Gemini cloud tier (ADR-0026)
  - ElevenLabs warm voice and Voice Spark (ADR-0027)
  - Voice Flares (ADR-0028)
  - Crew Atlas (ADR-0029)
  - automations (ADR-0030)
  - Sentry route performance and errors (ADR-0021 amended)
  - website feature cards and Built with
  - fresh-eyes rounds 1 to 3, all fixed
  - page audit (axe 0 on 88 views, Lighthouse 100)
  - Plan and Voice e2e
  - media recapture (`scripts/capture-media.ts`)
  - the post draft (`docs/post/draft.md`)
- **Open for the founder:**
  - fill the [FIELD]s in the post: quote, video, image uploads, Entire links, Sentry screenshot;
  - make the repo public;
  - fix DigitalOcean billing ([PENDING DO BILLING]);
  - decide on Google billing (paid terms stop prompts being used to improve Google products);
  - delete the stale untracked folders `apps/web/static/scenic/` and `scenery/*-640|1280*`.
- **Queued:** zod → zod/mini (about 16 KB of JS headroom); the remaining fresh-eyes items (docs/research/fresh-eyes-2026-10-11.md); round 4 results.
- **Backlog with status:** docs/engineering/07-sunday-backlog.md.

## Older notes

Updated: Sat 2026-10-10, before the usage-limit pause (reset 3:50 PM ET).

## Done (committed)
- Research scan (docs/research/00), product docs v1.1 with CR-1 (docs/product/), analyst specs (docs/requirements/, trace.py passes), architect open questions OQ-1 and OQ-2 (handoff 02), brand (brand/, docs/brand/, handoff 03).
- brand/tools refactor: shared geometry and text code moved to brand/tools/shared.mjs; build.mjs imports it; `npm run build` still produces all assets.

## In progress: brand share-image fix (founder feedback, Oct 10)
Founder asked for:
1. 2 or 3 directions for the DEV cover (1000 x 420): an illustrated golden-hour outdoor scene (horizon, maple leaves, bench or path) with the flame states living in the scene, visible paper grain, a tighter and bigger tagline.
2. Pick the strongest and apply it to the OG image (1200 x 630).
3. Check the app icon at 60 and 120 px next to real iOS icons; make sure the gold dot doesn't turn to mush.
4. Small fix, then update handoff 03 and commit.

Planned directions: A "Golden hour" illustrated scene; B "Cut paper" layered hills on birch; C "Bold type" maple field with a huge tagline. Script: brand/tools/covers.mjs (to write), output to brand/export/social/directions/.

## Next role after that: product designer (UI/UX)
Full brief is in the founder's message (Oct 10). Deliverables go in design/ and docs/design/: design brief and UX scan, flows and IA (Flare and Plan), wireframes, hi-fi screens in real code (design/prototype/) for every state in light, dark and sun mode with PNG exports, clickable prototype of the key moments, website design (mobile and desktop), design system tokens (CSS + JSON) and components, accessibility annotations, then handoff 04 for motion and copy.

Stack research done: svelte 5.57.2, @sveltejs/kit 3.0.1, vite 8.3.4, bits-ui 2.19.5 (accessible headless primitives), playwright-core 1.64.0 using the installed Google Chrome for screenshots (no browser download). Alternative considered: react 19.3.0 + react-aria-components 1.22.1. Leaning Svelte + Bits UI because SRS-PERF-2 caps link-page JS at 150 KB gzipped. Architect confirms in a decision record.

## Exact next step (superseded below)
Write brand/tools/covers.mjs with the three directions, render them, review the PNGs, pick one.

## Update: brand share-image fix DONE (committed)
Golden-hour direction shipped to DEV cover and OG; icon fixed after the home-screen check.

## Product design: in progress
Done: docs/design/01-brief-and-ux-scan.md, 02-flows-and-ia.md (screen ids H1..H6, I0..I12, P1..P7, O0..O8, W1..W6); design/system/build-tokens.mjs -> tokens.css/json; design/prototype scaffold (SvelteKit 3.0.1, Svelte 5.57.2, Vite 8.3.4, Bits UI 2.19.5, TS 6.0.3, overrides fix BUG-007, 0 vulns).
Lab inputs (Oct 10): photo AI runs on the hub (gemma4:e4b, ~3.0 s per photo), no in-browser vision on iPhone; design the draft as arriving in ~3 s, typed six-word fallback when the hub is unreachable. Flame: lab recommends a 1.9 KB WebGL shader with CSS fallback (prototype uses SVG/CSS; note for engineering). Fairlane pack 6.7 KB.
Remaining: src/lib/styles/app.css, components (Flame, Button, Icon, PhotoPrint, TypeWords, NeedCount, AccessLine, NatureLine, Sheet, TextField, QuorumToggle, Banner, Compass, StepLadder, ListRow, TopBar, Screen), screens registry + one component per screen id, routes (/screens, /screens/[id], /proto, /components, /site), scripts/export.mjs (playwright-core + Chrome: hi-fi PNGs per screen/state/theme, wireframes via data-wire), scripts/a11y.mjs (axe-core), docs/design/03..07, handoff 04 (motion and copy).

## Progress (product design)
- Components done: Flame, Button, Icon, PhotoPrint, TypeWords, NeedCount, InfoLines, Screen (with overlay slot), Sheet (Bits Dialog + inline), TextField, Choice (Bits ToggleGroup), Compass, Ladder, SampleScene. sample.ts holds shared copy and data.
- Screens done: H1 to H6 (src/lib/screens), registry.ts, /screens/[id] route, /screens/manifest.json, scripts/export.mjs (44 PNGs + 6 wireframes, 0 page errors), scripts/contact.mjs, scripts/shot.mjs.
- Gotchas: screen prop is `view`, not `state` (clashes with $state rune); imports use #lib/...ts with extension (BUG-008).

## Progress update (latest)
- Hearth (flame + ground + sparks + horizon) and Scenery (golden-hour scene) components done; used on H4, H5, H6, I4, I6, I8, I9, I10, I12.
- Invitee screens I0 to I12 written and registered; `npm run check` 0 errors; export run: 91 screens + 16 wireframes, 0 page errors.
- Contact sheet of invitee screens rendered to the scratchpad but NOT yet reviewed visually.

## Progress update (latest)
- All 33 screens done and registered (H1-H6, I0-I12, P1-P7, O0, O1, O2, O4, O5, O6, O8). Full export: 189 hi-fi PNGs + 33 wireframes, 0 page errors, svelte-check 0/0.
- Founder feedback folded in: FlameMeter (live flame + count) on I1, H2, I9, P4; Spark history line on the invite; compass uses the pin-flame pointer, tightening distance rings, facing glow; stronger UI grain (static/brand/paper-grain-ui-256.png).

## Product design: DONE
Handoff: docs/handoffs/04-product-design.md. All checks pass (svelte-check 0/0, axe 0 violations on 193 targets, focus audit 0 small targets, copy lint 0 problems, JS 51 KB gz).

## Exports cleanup: DONE (commit 5d90fc6)
History rewritten before any push to drop design/exports; full exports are git-ignored and regenerate with `cd design/prototype && npm run build && npm run export`. Curated 27 screens in docs/design/screens (JPEG).

## In progress: 4c Motion & sound + 4d UX writer, run in parallel as subagents in separate git worktrees
- Motion owns: design/motion/, docs/design/motion.md, docs/handoffs/05-motion.md, prototype components Flame/FlameMeter/Hearth/Compass/PhotoPrint/TypeWords/Button, src/routes/+layout.svelte (View Transitions), src/lib/motion/*, static/sounds/*, motion tokens in design/system/build-tokens.mjs, test pages /lab/fps and /lab/haptics.
- Copy owns: docs/content/, docs/handoffs/06-copy.md, src/lib/copy/*.json + loader, string changes in src/lib/screens/*.svelte, src/routes/site/+page.svelte, src/lib/sample.ts text.
- After both finish: merge both worktree branches into main, run npm run check, build, export, a11y, focus-audit, copy-lint; write combined summary to the founder.

## Status after the 3:50 PM reset
First motion and copy subagents stopped on the usage limit before changing any files (their worktrees were auto-removed, nothing to merge). Both restarted at the same prompts in fresh worktrees, with instructions to commit early.

## Motion (4c) and copy (4d): DONE and merged
- Copy: e60a92c (handoff 06). Motion: merge 5251239 (handoff 05). Worktrees removed.
- After merge: copy keys wired into motion-owned components (FlameMeter, Compass incl. km and "behind you", Flame names, PhotoPrint, Screen, TextField, Ladder); NeedCount got the count tick; Hearth hills fade on all edges; curated screens refreshed.
- Re-verify on merged main: check 0/0 (713 files), build ok, copy-lint 0 problems (576 strings, 41/41 fixed), export 189 + 33, axe 0 violations (193), focus audit 0 small targets.

## Exact next step now
Founder decisions pending (JS weight +10.5 KB for the shader, sound default on/off, copy decisions table in handoff 06). Next role per founder: architect.


## Architect: DONE (Sat 2026-10-10, evening)
Handoff: docs/handoffs/07-architect.md. Repo scaffold builds, 44 tests pass (Node 24.21.0 and 26.8.1), `npm run ci` green locally and on GitHub Actions (private repo Hotragn/flare), `npm run e2e:hello` passes against real Ollama (3.8 s round trip). docs/architecture/ has 12 docs, 20 ADRs, contracts (OpenAPI, AsyncAPI, telegram.md, plain-text.md). BUG-020 to BUG-029 logged; BUG-029 open (one unexplained CSP report).

## Next role: Engineering lead
Build order is in handoff 07, "What to build". Waiting on the founder: Render deploy (web, Postgres, cron), Telegram webhook, making the repo public.

## Engineering lead: IN PROGRESS (Sat 2026-10-10, 20:00 ET)
Done and committed: spikes E1 (relay faults, heartbeat fix BUG-030/031), E2 (deletion timing, migration 0002), E3 (compass flow 21/21); device-check kit (`npm run device-check`, pages in apps/web/static/check/); ICD types (packages/shared/src/icd/, sealed.ts); BUG-029 fixed (zod jitless). Docs written: docs/engineering/01-work-breakdown.md, 02-interface-control.md, 03-spikes.md.
Exact next step: write docs/engineering/04-dependencies-and-process.md (mermaid dependency graph, branching and review, definition of done), 05-device-checklist.md (15-minute ordered list: capability, fps, haptics, Telegram via `cd lab && node spikes/03-telegram/tg.mjs morning --minutes 15 --taps 10` BEFORE any setWebhook, compass), docs/engineering/README.md, then docs/handoffs/08-engineering-lead.md (CR-E1 hub condition parser not built, CR-E2 phone tier not shipped, CR-A1 approved), run `npm run ci`, commit, push, message the manager.

## Engineering lead: DONE (Sat 2026-10-10, 20:40 ET)
Handoff: docs/handoffs/08-engineering-lead.md. docs/engineering/ 01 to 05 plus notes/ and spike evidence. 52 tests, CI green.
Next: the nine specialists start in parallel per docs/engineering/01-work-breakdown.md; integration 01:00, 05:00, 08:00; device checklist 08:30 (docs/engineering/05-device-checklist.md); RC tag 09:30. Founder approvals still pending: Render deploy, Telegram webhook, repo public.

## Build phase: nine specialists in parallel (started Sat 2026-10-10 ~21:00 ET)
Approved by the manager: plan, CR-E1, CR-E2, MP1. Each specialist runs as a subagent in its own git worktree, branch `wp/<area>`, pushed to origin (private Hotragn/flare). Briefs: docs/engineering/briefs/00-common.md + one per area; URL map: briefs/url-map.md.

| Area | Branch | Brief | Progress file (in its branch) | Handoff |
| --- | --- | --- | --- | --- |
| Core engine | wp/engine | briefs/6b-core-engine.md | docs/engineering/notes/engine-progress.md | 06b-core-engine.md |
| Backend | wp/backend | briefs/6c-backend.md | notes/backend-progress.md | 06c-backend.md |
| Integrations | wp/integrations | briefs/6d-integrations.md | notes/integrations-progress.md | 06d-integrations.md |
| ML | wp/ml | briefs/6e-ml.md | notes/ml-progress.md | 06e-ml.md |
| On-device AI | wp/on-device-ai | briefs/6f-on-device-ai.md | notes/on-device-ai-progress.md | 06f-on-device-ai.md |
| Maps | wp/maps | briefs/6g-maps.md | notes/maps-progress.md | 06g-maps.md |
| Frontend app | wp/frontend | briefs/7a-frontend-app.md | notes/frontend-progress.md | 07a-frontend-app.md |
| PWA and offline | wp/pwa | briefs/7b-pwa-offline.md | notes/pwa-progress.md | 07b-pwa-offline.md |
| Website | wp/website | briefs/7c-website.md | notes/website-progress.md | 07c-website.md |

How to restart one after a usage stop: if its subagent is still listed, SendMessage it "continue from your progress file". Otherwise start a new Agent with isolation "worktree" and the prompt: "You are the <area> specialist for Flare. Run `git fetch origin && git checkout -B wp/<area> origin/wp/<area>` (if the branch exists on origin, else stay on your new branch and rename it), then read docs/engineering/briefs/00-common.md, docs/engineering/briefs/<brief>, and docs/engineering/notes/<area>-progress.md, and continue to done." Work lost is at most the last uncommitted 30 to 45 minutes.

Integration (lead, in the main checkout): at 01:00, 05:00, 08:00 ET merge pushed `wp/*` branches into main in this order: engine, backend, integrations, ml, on-device-ai, maps, pwa, frontend, website; resolve conflicts, swap fakes for real modules, merge docs/engineering/bugs/*.md into docs/BUGLOG.md (renumber BUG-033+), run `npm run ci` and `npm run e2e:hello`, push. RC tag `rc-1` at 09:30 after the device checklist (docs/engineering/05-device-checklist.md, 08:30).


## Build order (manager, Sat 21:00 ET): field-test path first

Usage windows are short (nine agents use a 5-hour window in about 1 to 1.5 hours; windows reset about 8:50 PM, 1:50 AM, 6:50 AM ET). We don't cut scope; we order it. Build your part of the Sunday field-test path first, commit it, then the rest:
1. Create a Flare; private yes plus conditions; Lit / Ember / Gone; a Plan with a deadline and a fade.
2. iMessage links, the Telegram bot, the plain-text format.
3. The hub relay with photo drafts, the typed fallback, the rules parser.
4. The Fairlane pack, access line, compass, Sparks.
5. Offline save at Lit, the outbox.
6. The core screens with motion and sound.
7. Deletion and the audit.

After that (lands Sunday afternoon and evening, before the post): rest-loop routing and the print card, Fix the map, the website, remaining polish and docs depth. Commit after every step above, so a usage stop never costs more than one step.

## Status 22:30 ET
- Core engine: DONE, merged into main (f89219d). Handoff docs/handoffs/06b-core-engine.md. 141 engine tests, coverage 100% lines / 96.8% branches, B14 p99 0.06 ms. ICR-1 applied (ICD-1 v1.1). Bugs merged as BUG-033, BUG-034; next BUGLOG id BUG-035.
- Other eight: running (run 2). Check each via `git log origin/wp/<area>` and its notes/<area>-progress.md.
- PWA: DONE, merged into main. Handoff 07b-pwa-offline.md. 54 tests now in the root run (CR-PW1), ICD-5 v1.1 (CR-PW4). CR-PW2/3 sent to FE. Bugs BUG-035 to 037; next id BUG-038.
- Backend: DONE, merged. Handoff 06c-backend.md. ICR-BE-1 applied (LadderJob, JobResult.ladder, ToHubV11). Bugs BUG-038 to 040; integration found BUG-041, BUG-042 (engine tests). Next id BUG-043.
- ML: DONE, merged. Handoff 06e-ml.md. Bugs BUG-043 to 045. Asks: ODAI warms with real photo prompt + image; WEB adds Gemma attribution. Next id BUG-046.
- Integrations: DONE, merged and wired into main by the lead (apps/server/src/integrations.ts; wired.test.ts). Bugs BUG-046 to 049; next BUG-050. Founder must add TELEGRAM_WEBHOOK_SECRET and TELEGRAM_ALLOWED_CHAT_IDS to .env before setWebhook.

## Integration point 1 DONE (Sun 2026-10-11 02:10 ET)
All nine branches merged into main; specialists stopped (manager: no new subagents; the lead finishes the rest in this session).
- CI: 641 tests (578 root + 37 flow + 26 site), contracts ok, diagrams ok, per-route JS budget: link page 133.6 KB, host app 112.1 KB (scripts/budget.ts now measures per route).
- e2e-hello passes (3.3 s, hub) with one warm-up draft first. Hub photo latency at load 5: median 4.0 s, 4/5 within 6 s; the field Mac must run nothing but the hub (`npm run hub:field`).
- Lead wiring: apps/server/src/integrations.ts (Telegram, push, preview into the server), wired.test.ts.
Next (manager order): 2. finish the frontend field-test path (map pack and parser are on main now; check wire.ts picks them up; e2e against the real server), 3. merge/CI/e2e, 4. QA, a11y, security on the field-test path, 5. deploy prep for 9:30, 6. after the test: website Lighthouse (mobile / at 61), polish, remaining docs and handoffs 07a and 07c.
Open items: ladder label keys duplicated (ladder.tmpl.*, ladder.template.step*, ladder.tpl.*): use ML's ladder.template.step*; CR-FE-2 binary outbox; website ICRs 3-5; maps ICRs 1-3; TELEGRAM_WEBHOOK_SECRET and TELEGRAM_ALLOWED_CHAT_IDS missing from .env (founder).
- Step 2 DONE 02:40: frontend field-test path passes e2e against the real server + real hub + engine + PWA modules: `node apps/web/test/e2e/flow.ts 5 real` 5/5, host open to Sent median 2.7 s, link to You're in 284 ms, 0 page errors (docs/frontend/evidence/flow-real.txt). Server accepts DATABASE_URL=pglite:memory for local runs. Entire CLI 0.11.4 installed to ~/.local/bin; `entire enable` NOT run (writes .claude config; founder runs it).
- Sentry (ADR-0021) and DigitalOcean tier (ADR-0022) DONE 03:20; both off until the founder puts a real DSN and a scoped model key in .env (current values are account tokens; check-env and deploy refuse them). Next: QA/a11y/security on the field-test path, then deploy prep.
- Step 4 QA/a11y/security DONE 03:45: docs/engineering/qa/01-field-path-qa.md. Next: deploy prep (step 5).
- Step 5 deploy prep DONE 04:00: docs/engineering/06-deploy-runbook.md, npm run smoke, deploy skips account tokens. SENTRY_DSN is now a valid DSN (founder); DO key still a PAT (tier off). Remaining before RC: integration point 3 at 08:00, device check 08:30, rc-1 09:30, deploy on YES.
- 05:00 coverage: Plan/Ember/text/Sparks/HotSpots/deletion pass on real stack (npm run e2e:field 27/27, e2e:sparks all pass). Fixed BUG-057 (Short one only), Sparks/Hot spots never written (BUG-058..060). Pre-push now runs lint, types and root tests (15 s). Open: DO key behavior check (manager msg), rest-loop card route /app/loop/ and /app/fix-map/ missing (menu links 404).

## Exact next step (Sun ~06:20 ET, before the 6:50 reset)
- DO key check DONE (d7318f8): 403 on /v2/account, ladder 3.8 s, deploy sends the key only when scoped (ADR-0022).
- IN PROGRESS: `/app/loop/` route at `apps/web/src/routes/app/(more)/loop/+page.svelte`. Flow: words → `parseRest` (lib/conditions/rest.ts, on the phone) → read-back → `askLocation` → `loadNear` + `loadPathsNear` → `nameSpot` → `buildLoop` (map gap: parser `restGapM` → `rest_gap_m`, prefer only trees/water) → card preview `cardLines`, Print card = `cardPdf` download, Read it aloud = `speakTurns`; no loop → "Try {m} m" with `next_gap_m`. New copy keys loop.noLocation, loop.noMap, loop.hint, loop.finding.
- Data fact: Fairlane gives NO loop at Ford Woods / West Road (benches clustered; docs/maps/05-rest-loops.md). Village Green (42.3064, -83.227) gives loops. E2E: `apps/web/test/e2e/loop.ts` (`npm run e2e:loop`): Village Green → loop + PDF starts with %PDF; Ford Woods → "No loop keeps benches that close."
- Then `/app/fix-map/` (draft and export only, lib/map/fixmap.ts, prototype screen for "map.*" keys). If not done by rc-1 (09:30), remove the `/app/fix-map/` row from HostPage.svelte menu items for the RC, finish in the afternoon.

## Status Sun ~07:30 ET
- DONE `/app/loop/` (3bc35dc) and `/app/fix-map/` (ac88bb0). `npm run e2e:loop` 15/15 (loop at Village Green, honest "no loop" at Ford Woods, fix-map review and both exports, 0 OSM/API requests). Every menu link now resolves.
- Field note: at the Ford Woods spot Bench to Bench says no loop; demo it at Village Green (42.3064, -83.227) or say so in the post.
- Next: 08:00 integration point 3 per docs/engineering/06-deploy-runbook.md (add `npm run e2e:loop` to it), 08:30 device check, 09:30 rc-1, deploy on the founder's YES.
- After the test: Lighthouse 61 on mobile `/`, frontend extras, website and maps ICRs, CR-FE-2, field-scan notes into docs/research, scrub Entire session logs (100 emails) before the repo goes public, ML5 tag-drafting hub job for Fix the map.

## Status Sun ~07:30 ET
- ML5 photo-to-tags: hub job, route, contracts, phone photo step DONE (c324bf2, d373d29, b27c525); e2e:loop 20/20 with the real hub. Eval set grown to 11 (v2). PAUSED by the manager for Lighthouse; resumes first after the field test. Open: p95 latency 13.8 s (eval sends 1280 px, phone sends 768 px) and invented amenity on 4/6 no-feature photos. Next steps are in evals/reports/osm-tags-hub.md "Open findings".
- NOW: Lighthouse 100 in all four categories on every website page, mobile and desktop, reports saved as proof. Fix by budget (images, fonts, preload, render-blocking, CLS); keep motion and design.
- DO NOT touch the Telegram bot, webhook or getUpdates: the live test is running from lab/ (about 60 min from ~07:30). The manager will send the chat id for TELEGRAM_ALLOWED_CHAT_IDS.

## Status Sun ~07:50 ET
- Lighthouse DONE (cb32703): 100 in all four categories on the 5 site pages, mobile and desktop, median of 3 runs; 26/30 mobile runs at 100, 4 at 99. Reports in docs/website/lighthouse/.
- Telegram live test PASSED (manager, lab/ tg.mjs): post with buttons, count edits, notify post, deleteMessage(s), deep link /start, "I'm in" answered privately plus the ephemeral message. TELEGRAM_ALLOWED_CHAT_IDS is set in .env. Lab script cleaned up (webhook none, 0 pending). Open: one live "Not now" tap at 08:30 (checklist row 5a). setWebhook still waits for the founder's YES at deploy.
- Founder decision, AFTER deploy, BEFORE the post: Telegram Flare post becomes a branded card via sendPhoto (flame state art, six words, place label, "Need N more", same buttons; edited Kindling → Lit → Ember; deleted at Gone; nothing personal, no real photo). Plus a per-group opt-in "Show photos in this Telegram group", off by default: host phone sends the decrypted photo only for the post, server uploads and keeps nothing, deleted at Gone; disclose in the setting, privacy page and an ADR. Tests: card render, edit on state, opt-in off by default, photo never stored, deleted at Gone; fake Bot API, then one live check in "Flare test".
- Next: 08:00 integration point 3 (runbook), 08:30 device check incl. row 5a, 09:30 rc-1, deploy on YES. Then the Telegram card, then ML5 findings.

- Manager approved Lighthouse (median of 3, all runs listed). Decision: /ai/ stays out of search (app page). ML5 resumes after the field test from evals/reports/osm-tags-hub.md next steps.

## Integration point 3 DONE (Sun ~06:55 ET): all green, details in docs/engineering/qa/01-field-path-qa.md. Next: Telegram branded card plus photo opt-in, then device-check kit ready, then stop and hold the window.

## Status Sun ~07:20 ET
- Telegram DONE before deploy: server branded card (e545952), phone Post in Telegram + telegram object + photo opt-in + ADR-0023, e2e:telegram 14/14, live card post/edit/delete in "Flare test" ok. Runbook 09:55 now has the in-app connect and tap-through.
- Device-check kit verified: `npm run device-check` serves https://10.0.0.196:8443/check/ (kit and compass HTTP 200). Stopped; the founder starts it at 08:30 per 05-device-checklist.md (row 5a: one live "Not now" tap).
- STOP here per the manager: hold the window for iPhone fixes, rc-1 (09:30), deploy on YES, field test. No post-test work.
- Known risk: apps/server/src/env.ts and apps/hub/src/main.ts load the real .env for unset keys, so other e2e scripts inherit the live Telegram token (harmless today: their groups are link groups). e2e:telegram sets FLARE_ENV_FILE to avoid it. Fix after the test.

## Status Sun ~07:50 ET (docs-only work while the founder sleeps)
- DONE: README quick start a stranger can run; docs/README.md index (0 broken links); docs/post/draft.md (template + What I got wrong + What I didn't do, 19 [FIELD] spots, manager-session disclosure); docs/post/media/ 12 real-app images (1.0 MB).
- Not done: screen recording. Playwright video needs its ffmpeg binary (npx playwright install ffmpeg, a download that needs a yes), or record on an iPhone during the field test.
- Logged BUG-065 (P2): Ember screen access line vs Ember bench.
- Holding the rest of the window for the device check, rc-1 and the deploy.

## Status Sun ~08:05 ET
- BUG-065 fixed (small, tested): Ember's access line follows the Ember bench. The screenshot case was correct (Ember at the spot, named West Road). e2e:field 27/27, flow.ts real 5/5 on the final build. Media recaptured.
- Video: the founder records on the iPhone during the field test, per docs/post/shot-list.md (8 shots, about 10 s each, portrait).
- STOPPED again: holding the window for the device check, rc-1 and the deploy.

## Status Sun ~11:30 ET (window resets 11:50)
- main = deploy build. Deploy BLOCKED: Render can't fetch the private repo; founder is granting the Render GitHub app access. Then: `npm run deploy:render -- --yes` (safe to re-run; free Postgres already created), `npm run smoke -- <url>` twice, `npm run telegram:webhook -- --yes`, one live tap in "Flare test". Founder YES given for deploy and setWebhook (via manager).
- Branch `redesign` (pushed): system font (Fraunces only for the six words), Screen `stage` layout (full-bleed photo, scrim, glass sheet, hero slot), invite/send/lit/host lit/ember on the stage, dark Find them, H0 Home (golden hour, weather window from NWS, nearest green spot, Light a Flare / Plan for later). e2e updated for the Light a Flare tap; flow.ts real 3/3 on the branch. Before/after shots: docs/design/redesign/{before,after}/. Direction: docs/design/09-2026-direction.md.
- Next on redesign: After an outing ("You were outside N min together", Spark, Phone away), Crew space (A: people, out now, story, stats, manage incl. remove member with key rotation + ADR-0024 outside-minutes counter), Spark screen restyle, website type check (fonts dropped: re-run Lighthouse), axe on new screens, recapture docs/post/media, then merge to main at green.
- Subagents running in worktrees: S1 Virtual Fairlane simulation (branch `sim`, handoff 09-sim.md), S2 Mastra Plan agent (branch `mastra-plan`, ADR-0025, handoff 10). Later for me: Voice Flares, Crew Atlas.
- Post plan: no outdoor group-test claims unless one happens; build on real-stack runs, iPhone device checks (16 Pro Max, 13), live Telegram checks, deletion audit.

- ~11:48: redesign adds I12 after-outing ("You were outside N min together" → Phone away), CountRing on invite, access chips (Access unknown here), sun/rain icons, Scenery backdrop on Home, Lit "Outside together" line. OPEN: invite backdrop black in capture (photo not shown yet or img issue: debug next); Home green line shows generic season ("Week 3 of fall"): filter like InfoLines.
## DEPLOYED Sun ~11:55 ET: https://flare-outside.onrender.com (Render free; main 340970d)
- smoke x2: all required checks pass (health, db ok, hub connected, push, telegram, cloud tier, pages with CSP, HSTS, traversal refused, safe previews, deletion audit). Photo draft fell to rules both runs at 6.0 s: the hub's model call itself hit 6 s (Ollama shared with subagent evals); recheck when S2 is done.
- Hub running on this Mac against the live server (keeps it awake). setWebhook done: webhook https://flare-outside.onrender.com/api/v1/telegram/webhook, 0 pending, no error. Live tap still needs a human in "Flare test".
- scripts/telegram-lib.ts: process env now overrides .env (so PUBLIC_BASE_URL=https://... works for setWebhook).

- Full ordered backlog with status: docs/engineering/07-sunday-backlog.md

- ~12:15: `npm run smoke -- <url> --hub-off` added. On live it FAILS both DO checks: DigitalOcean returns 402 Payment Required, "This account has been blocked" (reproduced locally with the same key). Founder must fix DO billing; until then "no laptop" falls back to typed words / template. Hub photo path on live: 4.0 s (smoke run 2).
