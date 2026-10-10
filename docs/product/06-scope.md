# Flare: Scope for this weekend

Version 1.1 (founder change request, Oct 10): Plan mode, Sparks and Hot spots, and hub-tier condition parsing move to P0; rest loop and Fix the map (draft only) move to P1.

Rule: scope is set by product value and screen time, not by hours. Everything **In** is needed for the field test or the post. **Later** items are designed for (the engine must not block them) but not built.

## In (P0: in the Sunday 10 AM release candidate)

| Area | What | Why it earns its screen time |
| --- | --- | --- |
| App | Camera-first create, spot naming, AI draft, quorum chip, send | The only host screen; about 6 to 15 s |
| App | Link page: photo, invite, "Need N more", "I'm in", take back, Lit screen, "I'm here", Done | Core decision in 10 s or less |
| Engine | Kindling, Lit, Ember, Gone with exact timers; solver; one server clock | The product itself |
| Engine | Deletion at Gone (job plus storage expiry) and the audit script | Privacy promise and post proof |
| Channels | Link page for iMessage and WhatsApp; Telegram bot in the "Flare test" group; plain-text copy | Our four testers use two channels |
| Conditions | Rules-tier and hub-tier parser, read-back | Makes quorum honest for people with limits |
| Plan mode | Planned ask with deadline, 4-step ladder, `max_step` conditions, solver, "I'm fading" | The core ask; used for real Sunday morning ("Fairlane walk at 11?") |
| Sparks and Hot spots | One line after a meetup; "met here N times"; Hot spots list | Real history from the test day; about 10 s, optional |
| Access | Needs profile, access line, spot check, Ember routing, spoken scene, VoiceOver pass | Two personas depend on it |
| Compass | Bearing, distance, speech, haptic tick, offline target | Finding friends without staring at a map |
| AI | Capability page `/check`; hub tier (Gemma 4 E4B via Ollama); rules tier; tier recording | Every job works on every phone |
| Offline | Save at Lit, outbox, Fairlane OSM pack | The no-signal persona |
| Nature line | Sunset time, named feature, season | One real line about the place, zero extra taps |
| Brand | Brand, motion, sound on app and site | Premium feel; Lit moment |
| Website | Home, How it works, Privacy, Accessibility, Run it yourself | Second deliverable |
| Field kit | Checklist, KPI export, consent checklist | Sunday 11 AM to 3 PM |

## In (P1: before the DEV deadline, Mon 06:59 UTC)

| Area | What |
| --- | --- |
| AI | Phone tier (Gemma 4 E2B in the browser) for photo to invite and for conditions, on every phone that passes the capability check. Measured table per phone. If it runs reliably by 10 AM Sunday it ships in the RC; otherwise it ships after the test and the post reports both honestly. |
| Compass | Host live location (opt-in, Lit only) |
| Offline | Plain-text `IN code` relay |
| Rest loop | Bench to Bench loop and the large-print card | The card means zero screen on the walk; one tester walks it Sunday |
| Fix the map | Photo, AI-drafted OSM tags, human review, export as Note text or file | Draft only; publishing waits for the founder's yes |
| Post | DEV draft, demo video, embedded agent session, deletion audit output |

## Out (not this product)

Accounts and passwords; feeds, followers, streaks, points, badges, comments, ratings; a "No" button; "prove you went outside"; AI-written itineraries; money, payments or prizes in the product; mesh radios and hardware; SOS or navigation-aid claims; Wikimedia content; closed AI APIs for any AI job.

## Later (designed for, not built)

| Item | Reason it waits |
| --- | --- |
| Publishing map fixes to OSM | Needs the founder's yes and OSM's review norms |
| Wider Telegram use | Waits for founder approval |
| Android-specific testing | No Android phones in the test group |
