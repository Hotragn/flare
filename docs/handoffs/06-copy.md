# Handoff 06: Copy (UX writing) to Engineering, Architect and the merge

From: UX writer and content designer. Date: Sat 2026-10-10. Works in parallel with Motion (handoff 05). Next: merge both branches, then the architect and engineering.

## What was delivered

| Path | Contents |
| --- | --- |
| design/prototype/src/lib/copy/deck.json | The code-ready copy deck: 576 keys covering all 33 screens and their states, errors, empty, loading and offline states, permission prompts (camera, location for host and friend, motion, notifications, microphone), push, the Telegram bot, plain-text SMS and satellite, share sheet, link previews, the website, and the privacy and accessibility statements. Each key has `kind`, `where`, and `fixed` (the requirement it comes from) or `status`/`owner` when it waits on someone |
| design/prototype/src/lib/copy/index.ts | Typed loader: `t("need.more", { n: 2 })` → "Need 2 more."; singular forms (`one`) when `n` is 1; `dot()` joins facts with " · "; `variant("privacy.coords")`; `readback([...])`. Wrong keys fail `npm run check`; a missing variable throws |
| design/prototype/scripts/copy-lint.mjs | Rewritten. Checks lengths on filled samples, no-slop and inclusive word lists, 41 fixed strings, hardcoded copy in code, unknown keys, Flesch-Kincaid grades, and SMS bytes for every Fairlane spot. Writes docs/content/02 to 05. Exits 1 on any problem |
| design/prototype/scripts/readability.mjs | Flesch-Kincaid grade, dependency-free, also a CLI |
| docs/content/01-voice-and-tone.md | Voice, five rules, tone by moment (inviting, answering, waiting, lit, getting there, shrinking, gone, after, errors, offline, permissions, privacy, accessibility), mechanics, do and don't, inclusive language review |
| docs/content/02-copy-deck.md | Every string with kind, words, grade, where and source (generated) |
| docs/content/03-checks.md | Lint result, no-slop checklist with hit counts, readability averages and every string over grade 8 with its reason, SMS byte table, fixed-string table, unwired keys by owner (generated) |
| docs/content/04-privacy-statement.md | Full privacy statement: promises, what we keep and for how long, honest limits, audit, sources. Both coordinate variants, marked (generated from the same keys as the website) |
| docs/content/05-accessibility-statement.md | Full accessibility statement: what we built, target, what we tested with numbers, known gaps, sources, feedback (generated) |
| docs/content/06-channels.md | Telegram bot (group post with live count, Plan post, private replies, private chat, condition read-back, Lit, cleanup, refusal outside the allow-list, /start, /help), push table, SMS forms, share sheet, Open Graph |
| Prototype | All 33 screens, the website, InfoLines and NeedCount read the deck; 0 hardcoded copy. Website now carries the full privacy section (promises, 8-row "what we keep" list, 7 limits, audit) and the full accessibility statement (tested, known gaps, sources) |
| docs/BUGLOG.md | BUG-009 to BUG-013 |
| docs/design/08-copy-deck.md | Now points to docs/content/ |

## Proof

| Check | Result |
| --- | --- |
| `npm run check` | 699 files, 0 errors, 0 warnings (after BUG-010) |
| `npm run build` | static site written |
| `node scripts/copy-lint.mjs` | 576 strings, fixed 41/41, 390 keys used in code, 0 hardcoded, **Problems: 0** |
| No-slop and inclusive lists | 0 hits on all 10 lists (banned words, dashes, exclamation marks, filler, urgency, guilt, vague claims, "step-free", ableist idioms, gendered words) |
| Lengths | Longest button 3 words; longest UI string 12 words (with real sample values); longest prose sentence 23 words |
| Readability | 336 strings of 4+ words graded: average grade 2.0 (UI 1.4, prose 3.8). 5 over grade 8, each with a reason in 03-checks.md (link names, the OSM attribution, a two-source citation, a spoken "kilometers" line, the WCAG target line). The 233 strings of 1 to 3 words aren't graded: one long word decides their score |
| SMS bytes | 23 named spots in the pinned Overpass result: worst case 89 bytes (Henry Ford Academy & Windmill Park), all 1 segment, all GSM-7, none truncated. Stress cases (180-character street, 120 é's) truncate to exactly 200 bytes with valid UTF-8 |
| `PORT=5322 node scripts/a11y.mjs` | 193 targets, 0 violations |
| `PORT=5322 node scripts/focus-audit.mjs` | 92 states, 0 targets under 44 px |
| Screenshots | I1, I6 (smaller), I7 (offline), I9, I12, H4 dark, H6, O0, O4, P5, P6, site at 390 and 1440: no sideways scroll, no clipped text (automated check plus a visual look) |

## Key decisions and why

1. **One source for copy.** Screens call `t()`; nobody types a string into a component. That's how the 5 drifted strings in BUG-009 happened, and the lint now makes it impossible.
2. **Fixed strings are untouchable and checked.** 41 strings from the SRS, BR and PRD are matched word for word. Where a fixed string is split across two elements (SRS-REST-4), both halves are checked.
3. **Limits are checked on filled samples, not templates.** "It's lit. {host} is at {spot}." is 7 words as a template and 11 with "Ford Woods Park, by the pond". The 12-word rule applies to what people read.
4. **Honest privacy beats a clean promise.** "Nothing about it was kept" became "Its photo and answers are deleted within 5 minutes", because counters are kept. The website lists 7 limits, including two the earlier copy didn't mention: the photo goes to our laptop for the six words, and conditions sent to the bot pass through Telegram and our server.
5. **Small groups get told the truth at the moment it matters.** P6 says "In a group this small, friends may guess." when the chosen set is 3 or fewer (R19), not only on the privacy page.
6. **Gone is the same for everyone, and after Lit it's "Thanks for coming."** (PRD 8). I12 now uses it after Done; "Go. They're at the pond." is the variant after I8.
7. **"Look up" became "Say hi."** on I8: an instruction that assumes sight, on a screen built for VoiceOver users too.
8. **Link previews default to "safe".** The server can't read the invite line (it's sealed), so the preview says "A Flare from a friend · Need 1 more. Open it to say yes in private." The BR-CH-4 version is in the deck as variant "full", for the architect to approve or drop.
9. **The bot is "I", the app is "we".** A bot saying "we" in a group chat reads like a company.

## Decisions needed (architect, engineering, founder)

| # | Who | Question | What the copy does now |
| --- | --- | --- | --- |
| 1 | Architect | **OQ-1: does the server hold spot coordinates?** | Both privacy variants are written. `meta.variants["privacy.coords"] = "A"` (server holds them until Gone, decision 10) is in force on the website and in 04-privacy-statement.md. If the decision record adopts OQ-1, set it to "B"; the website switches with no other change |
| 2 | Architect | **OQ-2: private note when a fade breaks someone's own condition, and `min_step`** | Strings ready and marked pending: "Plan changed to {step}. Still coming?" (`fade.stillComing`, `push.stillComing`) and the read-back fragment "step {k} or bigger" (`readback.rule.minStep`) |
| 3 | Architect | **Conditions sent to the bot by private message reach Telegram and our server as free text**, which BR-C-9 and SRS-COND-6 forbid for the app. Also, resolving "only with Amor" on the server needs readable names (BR-ID-3 says names are ciphertext only) | The bot tells people the first time: "Telegram and our server see this text. We keep only the rule." The privacy page says the same. Needs a rule that the bot parses in memory and stores nothing, and a way to resolve names |
| 4 | Architect | **Telegram posts, Lit pushes and the bot need the host name, spot and six words readable** somewhere, but the server only holds them sealed | Push copy assumes the payload is sealed with the group key and opened by the service worker, with fallbacks ("It's lit. Open Flare to see where."). Telegram: the host's phone would have to hand the readable post to the bot at send time; the privacy page already says Telegram sees what's posted there |
| 5 | Architect | **The photo goes to the hub readable** to get six words (FR-AI-1, SRS-IF-5) | The privacy page says so: "To write the six words, your photo goes to our laptop over an encrypted link." Confirm the hub keeps no copy and whether the route passes through the server; if the hub keeps nothing, we can add "and it isn't stored" |
| 6 | Architect | **Link preview variant** (BR-CH-4 "invite line" vs the server not holding it) | "safe" in force; "full" written |
| 7 | Architect | **"Forget this group" and Sparks:** BR-D-5 says any member's tap deletes them; SRS-ID-6 says only the last member's | Copy follows SRS-ID-6: "You're the last one, so its Sparks go too." Change two strings if BR-D-5 wins |
| 8 | Engineering | **"…" in BR-CH-2 isn't GSM-7**, so a truncated SMS switches to UCS-2 and splits into 3 segments | No Fairlane name gets truncated (largest 89 of 200 bytes). Suggest "..." (3 ASCII bytes) if a change request is acceptable |
| 9 | Engineering | FR-CH-4's example code has 4 characters (K7Q2); BR-CH-3 says 5 | Deck uses 5 (K7Q2M) |
| 10 | Engineering | Bot cleanup: BR-D-3 says delete "at Gone" | Proposal: edit the post to the final line ("Not this time." / "Thanks for coming."), then delete inside the 5-minute window of BR-D-1. If "at Gone" means at once, skip the edit |
| 11 | Engineering | Speech recognition in Safari may run on Apple's servers | Mic prompt says "Apple's speech service turns your words into text." Confirm on the 4 phones Sunday; if it runs on the device, change `perm.mic.body` |
| 12 | Founder | Contact route for accessibility feedback | "Tell us in the comments on our DEV post" until the repo is public |

## Strings to wire after the merge (components this role didn't touch)

All are in deck.json with an `owner` field; 03-checks.md lists them under "Keys not shown by the prototype yet".

| Component (owner) | Keys | Notes |
| --- | --- | --- |
| FlameMeter (motion) | `need.more` "Need {n} more.", `need.lit` "It's lit.", `need.catching` "Catching…", `need.detail` "{n} in, {q} to go ahead. Nobody sees who." | Same words as now; replace the literals with `t()` |
| Compass (motion) | `compass.spoken` "{name}, {meters} meters, {direction}.", `compass.spokenKm` "{name}, {km} kilometers, {direction}." (new, for 1000 m or more), `compass.spokenNoDir`, `compass.ahead` "{name} is straight ahead.", directions `compass.dir.*` (adds "behind you" for bearings over 135°), `compass.distance` "{meters} m", `compass.distanceKm` "{km} km", `compass.noGps` "Can't find you yet.", `compass.finding` "Finding you…", `compass.holdFlat` "Hold your phone flat to get a direction." | Today the component says "to your left" for anything past 45°, including behind; "behind you" is new |
| Flame (motion) | `flame.kindling`, `flame.lit`, `flame.ember`, `flame.gone` | Accessible names; unchanged words |
| PhotoPrint (motion) | `invite.photoFallback` "Invite photo" | |
| Screen.svelte | `app.close` "Close", `app.menu` "Menu" | |
| TextField.svelte | `cond.dictate` "Dictate", `cond.stopDictate` "Stop dictation" | |
| Ladder.svelte | `ladder.afterSunset` "Ends after sunset", `ladder.aria`, `ladder.current`, `ladder.editAria` "Edit step {k}", `ladder.stepMeta` | |
| /proto tour notes | not in the deck (they describe the prototype, not the product) | One note says "In her own words"; make it "In Amor's own words" |

## Strings that need a place in the layout (design or engineering)

Written and final, no screen shows them yet: permission sheets for location (host and friend), motion, notifications (including the Home Screen step) and microphone; H5 cancel confirm; H5 "Add text yes" sheet (SRS-CH-6); H4 "Copy as text"; H6 live-location sheet (SRS-CMP-6); I6 "Can't make it?" sheet; I2 "Say yes without a condition?" (FR-COND-5); O0 "Forget this group" sheet; generic errors (`err.*`); P1's other two deadline errors; P2's step-order error; the Bench to Bench card title and turn templates; the O6 note text. The full list is in 03-checks.md under "Engineering or design to place".

## Things to know

- Edit copy only in deck.json, then run `node scripts/copy-lint.mjs`; it regenerates docs/content/02 to 05. Don't edit those four by hand.
- A grade over 8 fails the lint unless the entry has a `gradeNote` saying why.
- The O8 download size (290 MB) is product design's sample in sample.ts; the real number comes from the model file the lab picks.
- `scripts/a11y.mjs` needs `design/exports/` to exist (BUG-013).
- PORT support (`process.env.PORT ?? 5318`) was added to export.mjs, a11y.mjs and focus-audit.mjs, the same lines the motion role may change.

## Change requests

- CR (small, engineering): BR-CH-2 truncation mark "…" → "...", so a truncated SMS stays in GSM-7 (decision 8 above). Not applied.
- No other changes to earlier phases. Small fixes made in this phase: BUG-009 to BUG-013, and docs/design/07-annex-focus-order.md regenerated by the focus audit (menu names now readable).
