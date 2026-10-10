# Flare: Voice and tone

Owner: Copy (UX writing). Version 1.0, Sat 2026-10-10. Builds on the voice table in [docs/brand/01-strategy.md](../brand/01-strategy.md). Every string lives in [design/prototype/src/lib/copy/deck.json](../../design/prototype/src/lib/copy/deck.json); [02-copy-deck.md](02-copy-deck.md) lists them, [03-checks.md](03-checks.md) shows the automated checks.

## Contents of docs/content

| File | What it is |
| --- | --- |
| 01-voice-and-tone.md | This guide: voice, tone by moment, rules, do and don't, inclusive language review |
| [02-copy-deck.md](02-copy-deck.md) | Every string (576 keys) with kind, words, grade, where it shows and its source. Generated |
| [03-checks.md](03-checks.md) | Lint, no-slop checklist, readability, SMS byte table, fixed strings, unwired keys. Generated |
| [04-privacy-statement.md](04-privacy-statement.md) | Full privacy statement, both coordinate variants marked. Generated from the same keys as the website |
| [05-accessibility-statement.md](05-accessibility-statement.md) | Full accessibility statement. Generated from the same keys as the website |
| [06-channels.md](06-channels.md) | Telegram bot, push, SMS and satellite, share sheet and link previews, as whole messages with their behavior |

## The voice in one line

A friend who's already outside, texting you: short, warm, a bit playful, and never pushy.

Flare speaks as "we" (the app and the people who run it) and to "you". The Telegram bot speaks as "I", because a bot in a group chat is a someone, and "we" from a bot reads like a company.

## Five rules

1. **Say the concrete thing.** "15 min at the bench by the lot", not "a shorter plan nearby". Every claim has a number, a place or a source.
2. **Short.** Buttons 3 words or fewer. Every UI string 12 words or fewer, checked on real sample values, not just templates. Website and statements: 25 words or fewer per sentence.
3. **Nobody is put on the spot.** No names next to answers, no counts of fades, no reasons for an Ember-only yes. The same words for everyone when it doesn't happen.
4. **No pressure, no guilt, no hype.** No exclamation marks, no "hurry", no "you missed", no "amazing". The flame does the celebrating; the words stay calm.
5. **Honest about limits.** Say what the app can't do in the same plain words as what it can ("Not for navigation or emergencies", "Telegram sees what's posted in Telegram").

## Tone by moment

The voice stays the same; the tone moves with the moment. Fixed strings (from the SRS, marked with their id) are never reworded.

| Moment | Tone | Say | Don't say | Why |
| --- | --- | --- | --- | --- |
| Inviting (H1 to H4) | Light, quick, out of the way | "Snap where you are" · "Send it" · "Phone in your pocket. We'll buzz you when it's lit." | "Create your first Flare event" · "Launch your Flare now!" | The host is outside. Every word costs a second of screen. |
| Answering (I1 to I4) | Easy, private, zero risk | "I'm in" · "Add a condition" · "Nobody sees who said yes. Only the count." | "RSVP" · "Will you attend?" · "Decline" | No No button exists (SRS-RES-5), so the copy never asks a yes-or-no question. |
| Waiting (H5, I4) | Patient, factual | "Need 1 more." (BR-Q-4) · "Gets smaller in 18 min if it doesn't catch." | "Only 1 more friend needed, hurry!" · "Still waiting…" | A count and a time. No countdown pressure. |
| Lit (I6, H6, push) | Warm, settled | "It's lit. Fuego is at Ford Woods Park, by the pond." (SRS-LIT-1) | "Congratulations, your event is confirmed!" | The sparks and the sound carry the joy. The words carry the place. |
| Getting there (I7, I8) | Calm, spoken-first | "Fuego, 400 meters, slightly left." (SRS-CMP-1) · "3 of you are here. Say hi." | "Navigate to destination" · "Arrived!" | Heard with the phone in a pocket; names before numbers. |
| Shrinking (I9, P5, P6) | Kind, matter-of-fact | "Smaller plan: 15 min at the bench by the lot." (SRS-EMB-2) · "Everyone sees 'Smaller plan.' Not who asked." | "Your Flare failed. Try again?" · "Someone is tired." | Smaller is a good outcome, not a downgrade. Never hints at who. |
| Gone (I10, P7) | Quiet, final, the same for all | "Not this time." (SRS-ST-3) · "Its photo and answers are deleted within 5 minutes." | "Nobody could make it." · "Better luck next time!" | Identical words for everyone, so nobody can tell who didn't answer. |
| After (I11, I12) | Grateful, brief | "Thanks for coming." · "One line about today?" | "Rate your hangout" · "Share your memories!" | One optional line, once. No reminders (BR-K-3). |
| Errors | Plain, what happened and what to do | "Didn't send. Check your signal and try again." · "Groups max out at 12." (SRS-ID-5) | "Error 503: network unavailable" · "Oops! Something went wrong" | What broke, then the next step, in under 12 words. No blame. |
| Offline | Reassuring, with a time | "Offline. Saved at 2:14 PM." (SRS-OFF-2) · "Saved. It sends when you're back online." | "No connection." · "You're offline!" | The saved time tells people what they can trust. |
| Permissions | Ask for one thing, say why, offer a way around | "Show your walk time?" · "Your location stays on this phone. We use it for walk time." · "Not now" | "Flare needs access to your location to work." | Every ask has a working path without it (SRS-COMP-2). |
| Privacy | Specific, unshowy | "Only you see this. Your needs stay on your phone." · "Telegram and our server see this text. We keep only the rule." | "Your privacy is our top priority." · "Bank-grade security" | Say where the data goes and when it's deleted. Promise only what the code does. |
| Accessibility | Respectful, specific, equal | "This spot may not suit you" (FR-ACC-3) · "No steps mapped" (BR-A-4) | "Accessible route" · "Step-free" · "For disabled users" | We describe the map, not the person. Access features are for everyone. |

## Mechanics

- **Contractions:** yes (it's, you're, we'll). They sound like a person.
- **Numbers:** always digits ("3", "15 min", "200 m"). Units: min, m, km, PM. Spoken text says "meters" and "kilometers".
- **Times:** "2:14 PM" in the app; "3:40PM" (no space) in the plain-text SMS to save bytes.
- **Punctuation:** periods on full sentences, none on buttons, labels or chips. Straight apostrophes in the app (fixed strings use them). Curly quotes “ ” for quoted speech on the website. No exclamation marks. No em dashes; a period or a comma does the job. Middle dot " · " joins short facts on one line.
- **Ellipsis "…":** only for something in progress ("Writing six words…"), never for suspense.
- **Capitals:** sentence case everywhere. Product nouns are capitalized: Flare, Plan, Spark, Hot spots, Bench to Bench. States are capitalized when named as states (Kindling, Lit, Ember, Gone) and lower case in sentences ("It's lit.").
- **Names:** first names only. Samples use Fuego, Amor, Shilp and Ammo; "Kai" stands in for someone outside the group.
- **Questions:** only when the person decides something ("Count me in for a closer one?"). Never a question that has a "no" answer on screen.

## Do and don't

| Do | Don't |
| --- | --- |
| "Need 1 more." | "1 more friend needed to light this Flare!" |
| "Gets smaller in 18 min if it doesn't catch." | "Time is running out!" |
| "Smaller plan: Short walk." | "Plan downgraded because someone is tired." |
| "In a group this small, friends may guess." | "Completely anonymous." |
| "Couldn't reach our laptop. Write your own?" | "AI is temporarily unavailable." |
| "Made on our laptop" | "Powered by AI magic" |
| "Its photo and answers are deleted within 5 minutes." | "Nothing is kept." (counters are kept, so it isn't true) |
| "That's a lot of taps. Try again in 1 minute." | "Rate limit exceeded." |
| "Hold your phone flat to get a direction." | "Calibrate your compass." |
| "No steps mapped" | "Step-free" |
| "Finds your friend. Not for navigation or emergencies." | "Never get lost again." |

## Writing a new string

1. Add it to deck.json with a key, `kind`, `where`, and `fixed` if a requirement sets it. Add `sample` values if the template needs them.
2. Use it in code with `t("key", { vars })`. Never type copy into a component.
3. Run `node scripts/copy-lint.mjs`. It fails on length, banned words, dashes, filler, urgency, guilt, vague claims, ableist idioms, gendered words, hardcoded copy, unknown keys, and any grade over 8 without a written reason.

## Inclusive language review

Reviewed by hand on Oct 10, on top of the automated word lists in 03-checks.md (0 hits on every list).

| Area | What we checked | Result and decisions |
| --- | --- | --- |
| Ableist idioms | blind spot, crazy, lame, sanity check, tone-deaf, "see" as an order | 0 hits. "I8 3 of you are here. Look up." became "Say hi." because "look up" is an instruction that assumes sight; the person may be using VoiceOver. "Nobody sees who" stays: it describes what the screen shows to others, not what the reader must do. |
| Disability wording | person-first or the term people use for themselves; no "suffers from", "wheelchair-bound", "the disabled" | The website says "an older adult with a mobility impairment" (was "a mobility-impaired senior") and uses the CDC's own terms "mobility disability" and "vision disability" when citing CDC numbers. The heading "Built for friends who need more" became "Built for friends with access needs", which is specific and doesn't rank people. |
| Describing places, not people | access copy states map facts | "Steps mapped", "No steps mapped", "Nearest bench 320 m". Never "accessible" or "step-free" (BR-A-4), because OSM can be wrong and the person decides what works. |
| Private needs | nobody learns why | I5 says "Only you see this. Your needs stay on your phone." Other people's screens never change because of someone's needs (SRS-ACC-4). |
| Gender | no gendered defaults or pronouns | 0 hits. The bot and the app use names or "you". The prototype's tour note "In her own words" is outside these files and is listed in handoff 06 for the design role. |
| Age and culture | no "kids", "seniors", slang that excludes | "Say hi" and "Pocket it" are plain everyday English; no regional slang. |
| Speech | text written to be heard | Compass lines put the name first, then distance, then direction, and spell out "meters". |
| Photo descriptions | AI never describes people | BR-AI-2 filter; the accessibility statement says descriptions can miss things. |
