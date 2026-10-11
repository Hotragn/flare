# AI runtime

Owner: on-device AI (work package ODAI). Last updated 2026-10-10.

Flare uses AI in three places. Each one picks a tier on its own and says which tier made the result.

| Feature | Tier 1 | Fallback (always works) | Label shown | Budget |
| --- | --- | --- | --- | --- |
| Six words from a photo | Hub: Gemma 4 E4B on our laptop, through `POST /api/v1/drafts` | Typed field (six words) with map-pack chips | "Made on our laptop" / "Made from a template" | Server waits 6 s for the hub; phone waits 7.5 s |
| Plan ladder (4 steps) | Hub, through `POST /api/v1/drafts/ladder` | Template ladder made on the phone (60 → 60, 30, 15, 10) | same | Server waits 8 s; phone waits 9.5 s |
| Conditions ("after 2, back by 5") | Rules parser on the phone, always | The "I didn't catch that" hint | "Made on this phone" on /ai/ | under 1 ms |

There is no phone model tier. Every in-browser model the lab tried was too big for iPhone Safari or no better than the rules. See [measured-not-shipped.md](measured-not-shipped.md).

## Code map

| Path | What |
| --- | --- |
| `apps/web/src/lib/conditions/rules.ts` | Rules parser (lab 07 port, two general rules, `min_step`). Text to raw rules. |
| `apps/web/src/lib/conditions/index.ts` | ICD-7 `parse()` and `readBack()`: names to member ids, local times to UTC, read-back ≤ 12 words, chips. |
| `apps/web/src/lib/conditions/time.ts` | Group time zone to UTC and back, DST safe, no library. |
| `apps/web/src/lib/ai/tier.ts` | Tier selection: `draftPhoto()`, `callHub()`, timeouts, fallback reasons, last-tier store. |
| `apps/web/src/lib/ai/typed.ts` | OD4 typed fallback: six-word check, template line, map-pack chips. |
| `apps/web/src/lib/ai/ladder.ts` | `draftLadder()`, template ladder, `checkLadder()`, `editStep()` (BR-P-4). |
| `apps/web/src/lib/ai/plan.ts` | FE5 logic: `checkPlanTimes()` (BR-P-1), `endsAfterSunset()` (BR-P-9), `planAnswer()`, `stepsAllowed()`. |
| `apps/web/src/lib/ai/copy.ts` | Copy deck lookup (throws on a missing key or variable). |
| `apps/web/src/lib/ai/measured.ts` | The "measured, not shipped" list shown on /ai/. |
| `apps/web/src/lib/capabilities/index.ts` | ICD-8 `detect()` and `shaderOk()`. Feature checks only. |
| `apps/web/src/routes/ai/+page.svelte` | /ai/ "AI on this phone" status screen. |
| `apps/web/static/check/capability/` | Device check page (cards for Flare features, photo resize, shader gate added). |
| `apps/hub/src/` | Hub: relay client, Ollama calls, photo and ladder jobs, per-job budget. No fs, no child_process. |
| `apps/hub/field/field.ts` | `npm run hub:field`: keep awake, restart the hub, health line every 30 s. |
| `apps/hub/field/bench.ts` | Hub timing check for [performance.md](performance.md). |

## How the tier is chosen (photo)

1. Phone offline (`navigator.onLine` false): typed fallback at once, no request. Message "Offline. Write six words. It sends later."
2. Otherwise the phone posts the 768 px JPEG. The server relays it to the hub and waits 6 s (BR-AI-1).
3. The phone accepts the answer only if `tier` is `hub` and the draft passes `enforce()` again on the phone (6 words, 20 words, no face or identity words).
4. Anything else falls back to the typed field and records why: `hub_down` (server answered with the template), `timeout` (no answer in 7.5 s), `network` (the request failed: spike E1 relay drop), `unusable`, `server_error`.
5. The last tier and reason per feature are kept in localStorage (`flare.ai.tiers.v1`), with no content: feature, tier, time, ms, reason.

## Hub jobs

- One job at a time, in arrival order (Ollama is shared).
- Each job gets the rest of its budget from when it arrived: 6 s photo, 8 s ladder. The Ollama call is aborted at 0, and a job already past its budget is answered `timeout` without calling Ollama (BUG-ODAI-1).
- Photo bytes are zero-filled when the job ends. The hub imports no filesystem or process module (test: `apps/hub/test/hub.test.ts`).
- The ladder job quotes the ask line as data, then checks the answer: exactly 4 labels of 1 to 4 words that pass the person filter; minutes must start at the total, strictly decrease and stay ≥ 5, or the template minutes are used.

## Running it on Sunday

```sh
export FLARE_ENV_FILE="/Users/hotragn/Documents/Claude Code/HacktoberFest/flare/.env"
npm run hub:field            # FLARE_SERVER_URL points at the server; Ctrl-C to stop
```

Each health line shows: uptime, hub pid, server link, drops, restarts, Ollama, model loaded, warm time, load average, last job. Keep the load average under 10: at 16.7 tonight one photo took 6.0 s and missed the budget. Close other apps; run no agents on the hub laptop.

## Tests

`npm test` runs them all. Area tests: `apps/web/test/ai/*.test.ts` (conditions, tiers, capabilities, privacy) and `apps/hub/test/*.test.ts`. Browser proofs (need Google Chrome; `npm run build` first for privacy):

```sh
node apps/web/test/e2e/check-mac.ts     # device check page in Chrome, prints every card
node apps/web/test/e2e/privacy.ts       # network capture while typing conditions on /ai/
```
