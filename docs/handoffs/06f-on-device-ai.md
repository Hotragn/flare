# Handoff 06f: On-device AI to the engineering lead

Branch `wp/on-device-ai`, written 2026-10-10 by the on-device AI specialist. Read [docs/ai-runtime/README.md](../ai-runtime/README.md) first.

## Start here

- Conditions: `import { parse, readBack, readBackChips, parseError } from "#lib/conditions/index.ts"` (ICD-7).
- Photo draft with tiers: `draftPhoto(jpeg, { fetch, online: () => navigator.onLine, store: createTierStore() })` from `#lib/ai/tier.ts`. Show `outcome.label`; on `tier: "rules"` show `outcome.message` and the typed field (`#lib/ai/typed.ts`: `checkTyped`, `typedChips`).
- Plan: `draftLadder`, `editStep`, `checkLadder` (`#lib/ai/ladder.ts`); `checkPlanTimes`, `endsAfterSunset`, `planAnswer`, `stepsAllowed` (`#lib/ai/plan.ts`). FE renders the screens.
- Capabilities: `detect()`, `refreshPersisted()`, `shaderOk(canvas)` from `#lib/capabilities/index.ts` (ICD-8).
- Hub on Sunday: `npm run hub:field`.

## What was delivered

| WP | Delivered | Files |
| --- | --- | --- |
| OD1 | Rules parser: lab 07 port, the report's two general rules (negated "far", "home ... at T"), `min_step` (CR-A1) with Plan step names, names to member ids, times to UTC in the group zone, Plans-only step rules | `apps/web/src/lib/conditions/` |
| OD2 | Read-back ≤ 12 words from the copy deck, steps first (SRS-PLAN-10), several names in one fragment, a count line when 4 rules don't fit, chips per rule | same |
| OD3 | ICD-8 `detect()` (feature checks only, 4.3 ms in Chrome), `shaderOk()`; device check page: new cards "Flare features", "Photo resize", "Flame shader gate"; tests prove no dead buttons or links | `apps/web/src/lib/capabilities/`, `apps/web/static/check/capability/index.html` |
| OD4 | Typed fallback: six-word check, emoji and `#` stripped, template line per spot, up to 4 map-pack chips, works offline | `apps/web/src/lib/ai/typed.ts` |
| Tiers | Automatic hub / rules choice for photo and ladder, 7.5 s and 9.5 s phone timeouts over the 6 s and 8 s server budgets, offline short-circuit, relay drop and server errors fall back at once, `enforce()` again on the phone, last tier per feature kept without content | `apps/web/src/lib/ai/tier.ts`, `ladder.ts` |
| FE5 | Plan logic as a module: BR-P-1 times, BR-P-4 ladder edits, BR-P-9 sunset flag, Plan answers with step names, steps a member's rules allow | `apps/web/src/lib/ai/plan.ts` |
| Hub | Ladder-draft job per asyncapi (quoted ask, B2 guard, template minutes on bad minutes), one job at a time, per-job budget that aborts at the server's deadline and drops stale jobs (BUG-ODAI-1) | `apps/hub/src/ladder.ts`, `client.ts`, `ollama.ts` |
| OD5 (P1) | Rest-loop request parser: minutes, rest gap (snapped down to 100, 200 or 400 m, or from the needs profile, else 200 m), trees / water / restrooms, no steps; read-back ≤ 12 words plus chips | `apps/web/src/lib/conditions/rest.ts` |
| ML4 | `npm run hub:field`: caffeinate while running, warm (main.ts), restart with 1 to 30 s backoff, health line every 30 s with load average | `apps/hub/field/field.ts` |
| /ai/ | "AI on this phone": what runs where, never leaves the phone, last run per feature with reason, phone capabilities, measured-not-shipped list, a try-it field on the real parser | `apps/web/src/routes/ai/+page.svelte` |
| Docs | Runtime, privacy guarantees with proofs, performance per device class, measured not shipped | `docs/ai-runtime/` |

## Proof

| Check | Command | Result |
| --- | --- | --- |
| Whole CI | `npm run ci` | green; 18 test files, 108 tests; web JS 87.2 KB gz of 150 KB; 37 diagrams |
| core_40 (SRS-COND-2, ≥ 36) | `npx vitest run apps/web/test/ai/conditions.test.ts` | 40/40 |
| hard_20 (SRS-COND-4) | same | 18/20 (lab: 15). Misses: "count me in once I'm done with lunch around 1", "sit somewhere close" (gets max_walk, misses max_step 4) |
| min_step phrases (CR-A1) | same | 4/4: "only the long one", "the full walk or nothing", "at least the park loop", "step 2 or bigger" |
| Read-back ≤ 12 words | same | every parsed fixture phrase; 4-rule answers use "Got it: 4 rules, listed below. Right?" |
| Parse speed | Node | 0.13 ms (core) and 0.09 ms (hard) per phrase |
| Typed words never leave the phone | `apps/web/test/ai/privacy.test.ts`; `npm run build && node apps/web/test/e2e/privacy.ts` | 0 network calls for 60 phrases; Chrome: 0 requests while typing 4 conditions, 0 marker hits in requests or storage |
| Tier fallbacks | `apps/web/test/ai/tier.test.ts` | hub, server-says-rules, timeout (150 ms test budget), relay drop, offline (0 requests), person words, 500, garbage: all correct |
| Device check in Chrome on this Mac | `node apps/web/test/e2e/check-mac.ts` | detect 4.3 ms, resize median 106 ms to 23 KB, shader 59.9 fps (pass), sent to the kit endpoint |
| Hub ladder + photo jobs | `apps/hub/test/ladder.test.ts`, `budget.test.ts` | ladder end to end, sequential with photo; stale job never reaches Ollama |
| Real Gemma, tonight's load | `node apps/hub/field/bench.ts --server http://localhost:8843 --photos <dir>` | before the fixes (load 17 to 22): 0/5 photos on the hub, ladder median 8.2 s. After the per-job budget (load 21 to 46): 4/5 photos on the hub, median 4.1 s, the 5th timed out cleanly at 6.0 s. Compact ladder prompt: median 4.9 s, 5/5 usable, 5/5 within 8 s. Details in docs/ai-runtime/performance.md |
| Rest-loop parser (OD5) | `apps/web/test/ai/rest.test.ts` | 6 tests, including the backlog example |
| hub:field soak | `npm run hub:field` against a local server on 8843 | 273 min, 0 drops, 1 restart (a deliberate kill, back in 1 s), model loaded on every health line |
| Copy | `cd design/prototype && node scripts/copy-lint.mjs` | 631 strings, 0 problems |

## Copy keys added (all new, none changed)

`readback.chip.minStep`, `readback.many`, `develop.empty`, `ladder.err.minutes`, `ladder.err.total`, `ladder.err.name`, `ladder.tpl.1` to `ladder.tpl.4`, `ai.where.title`, `ai.feature.photo|conditions|ladder`, `ai.run.photo|conditions|ladder`, `ai.never.title|typed|place|photo`, `ai.try.title|note|took`, `ai.last.title|none|line`, `ai.why.offline|network|timeout|hub_down|unusable|server_error`, `ai.phone.title|yes|no`, `ai.cap.camera|resize|compass|speech|push|pushInstall`, `ai.measured.title|body|link|row`, `ai.reason.buffer|quality|noBetter|kernel`, `loop.frag.min|gap|trees|water|restrooms|noSteps`. `docs/content/02-copy-deck.md` and `03-checks.md` were regenerated by copy-lint.

## Interface change requests

1. **ICD hub protocol: add the ladder job to the shared zod schemas** (`packages/shared/src/hub-protocol.ts`). asyncapi already has `ladderJob` and `result.ladder`; the zod mirror has neither, so a server that parses hub results with `JobResult` strips `ladder` (zod objects drop unknown keys). The hub validates ladder jobs with its own schema in `apps/hub/src/ladder.ts` until this lands. Exact diff:

```diff
 export const JobHeader = z.object({
   type: z.literal("job"),
   id: z.string().uuid(),
   kind: z.literal("photo-draft"),
   bytes: z.number().int().positive().max(2_000_000),
   mime: z.literal("image/jpeg"),
 });
+
+export const LadderJob = z.object({
+  type: z.literal("job"),
+  id: z.string().uuid(),
+  kind: z.literal("ladder-draft"),
+  ask: z.string().min(1).max(80),
+  total_minutes: z.number().int().min(40).max(600),
+  weather: z.object({ rain_likely: z.boolean(), temp_f: z.number().int() }).partial().optional(),
+});

 export const JobResult = z.object({
   type: z.literal("result"),
   id: z.string().uuid(),
   ok: z.boolean(),
   draft: z.object({ invite: z.string().min(1), alt: z.string().min(1) }).optional(),
+  ladder: z
+    .array(z.object({ step: z.number().int().min(1).max(4), label: z.string(), minutes: z.number().int() }))
+    .length(4)
+    .optional(),
   error: z.enum(["model_unavailable", "unusable_answer", "timeout", "bad_image"]).optional(),
   ms: z.number().int().nonnegative(),
   model: z.string(),
 });
@@
-export const ToHub = z.discriminatedUnion("type", [JobHeader, Ping]);
+export const ToHub = z.union([JobHeader, LadderJob, Ping]); // two "job" kinds share type
```

2. **Lead's config files (additive, already on this branch):** `vitest.config.ts` includes `apps/web/test/**/*.test.ts`; root `tsconfig.json` includes `apps/web/src/lib/{ai,conditions,capabilities}/**/*.ts`, `apps/web/test/**/*.ts` and `apps/hub/field/**/*.ts`; root `package.json` adds `"hub:field": "node apps/hub/field/field.ts"`; `apps/hub/package.json` adds `zod 4.6.5`.

3. **Server (BE):** `POST /api/v1/drafts/ladder` isn't on the server yet. The phone side and the hub job are ready; the server needs to send `ladder-draft` jobs, wait 8 s, and answer `tier: rules` with the template ladder otherwise (`templateMinutes` in `apps/hub/src/ladder.ts` and `templateLadder` in `apps/web/src/lib/ai/ladder.ts` give the same minutes).

## Things to know

- **Sunday hub laptop must be quiet.** Tonight, with nine agents on the Mac (load average 17 to 33), one Gemma photo call took 6.0 s and every photo fell to the template. Lab 02 measured 3.0 s on an idle Mac. Watch the `load` field in the hub:field health line; above about 10, expect templates.
- **Ladder prompt is compact on purpose** (`{"labels": [...], "minutes": [...]}`, num_predict 96): the list-of-objects shape took a median 8.2 s and missed the 8 s budget 3 times in 5. The guard accepts both shapes. When ML's prompt modules land in packages/shared/src/prompts, keep the output short.
- The /ai/ page bundles the copy deck (about 84 KB raw JS for that node). Within the 150 KB gz budget; a per-route copy split would cut it if FE also imports the deck.
- `parse()` for a Flare drops step rules (BR-C-1); "porch only" on a Flare is "didn't catch".
- min_step semantics follow ADR-0016 (holds when chosen step ≤ n); max_step follows BR-C-8 (chosen ≥ n). `stepsAllowed()` encodes both.
- Times earlier than now stay on today's date ("after 2" said at 3 PM already holds).
- Bugs: docs/engineering/bugs/on-device-ai.md (BUG-ODAI-1, BUG-ODAI-2).

## Not done, and why

- **Safari on this Mac:** not run. Driving it needs safaridriver, which the brief forbids. Hand steps are in performance.md.
- **iPhone performance rows:** filled on Sunday from the device check (the cards and the kit endpoint are ready).
- **Rest loop builder and print card (E16-S2, S3):** not mine; OD5 (the request parser) is done and ready for it.
