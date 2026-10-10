# Flare: Product requirements (PRD)

Owner: Product. Version 1.1, Sat 2026-10-10 (change request: Plan mode, Sparks, Hot spots, rest loop, Fix the map). Requirement IDs (FR-, NFR-) are referenced by the backlog (05-backlog.md) and must not be renumbered.

## 1. Problem

Friends who want to meet outside don't, because asking is awkward, nobody wants to arrive alone, plans stall in the chat, some can't use the spot, and phones lose signal where the good places are. See 01-brd.md.

## 2. Vision

**Snap where you are. If enough friends quietly say yes, it's on.**

A good session is about 5 seconds of screen and an hour outside. The place, the season, the light and the people are the point. The app gets out of the way.

## 3. Target users

- **Host:** someone already outside, or about to be, who wants company without the risk of asking in public.
- **Invitee:** a friend in the same chat who decides in seconds, privately.
- **Invitee with needs:** a friend with low vision, limited mobility, or who needs a restroom nearby.
- Personas and journeys: 04-personas-journeys.md.

## 4. Success metric

**Headcount:** people physically together because of a Flare (host plus arrivals). Every other metric (light rate, Ember save rate, screen seconds) serves it. Definitions: 07-kpis.md.

## 5. Non-goals

Accounts, passwords, profiles, feeds, followers, streaks, points, badges, comments, ratings, a "No" button, proof that you went outside, AI-written itineraries, money in the product, mesh radios or hardware, SOS or safety features, mobility-aid navigation.

## 6. The "less tech, more nature" test

Every feature passes this test before it ships:

1. Does it get someone outside or together sooner? If not, cut it.
2. How many seconds of screen does it add for each person? Write the number down.
3. Can it work with the screen off (audio, haptics, lock screen)? Prefer that.
4. Does it disappear when the Flare is Gone?

## 7. Core concepts

| Term | Meaning |
| --- | --- |
| Group | A set of friends sharing one link or Telegram chat. No accounts. A group key lives in the link fragment. |
| Flare | One invite to meet now at one spot. |
| Quorum | Yes-count needed to light. Default 2 (host plus 1). The host may pick 2, 3 or 4. |
| Kindling, Lit, Ember, Gone | The four states (section 8). |
| Spark | One line in a person's own words, left after a Flare by someone who showed up. Opt-in. |
| Tier | Where an AI job ran: phone, hub (our laptop) or rules. |
| Plan | A planned ask with a deadline, a 4-step ladder and the same private yes (section 11). |
| Ladder | The 4 steps of a Plan, biggest first. |

## 8. State machine (Flare mode)

All times are relative to the moment the host sends (t0).

| State | Enters when | What everyone sees | Leaves when |
| --- | --- | --- | --- |
| **Kindling** | Host sends at t0 | Photo, short invite, spot name, walking time, "Need N more" | Quorum reached (to Lit) or t0 + 30 min (to Ember) |
| **Lit** | Yes-count (including host) reaches quorum, with all accepted conditions satisfiable | "It's lit." Host line, spot, compass | Host taps Done, or t0 + 4 h (to Gone) |
| **Ember** | Not lit at t0 + 30 min | "Smaller plan: 15 min at {bench}." Quorum becomes 2 (host plus 1) | One yes (to Lit, counted as an Ember save) or t0 + 60 min (to Gone) |
| **Gone** | Done, timeout, or Ember expired | Lit Flares: "Thanks for coming." Unlit: "Not this time." Same text for everyone | Terminal. Data deletion starts (FR-PRIV-5) |

Rules:

- **FR-STATE-1** Once Lit, a Flare stays Lit. Later "can't make it" taps lower the expected count but never change the state.
- **FR-STATE-2** "Need N more" counts only yeses whose conditions can be met together (FR-COND-4).
- **FR-STATE-3** Unlit Flares end with the identical "Not this time" for everyone, so nobody can tell who didn't answer.
- **FR-STATE-4** The Ember spot is the nearest bench (OSM `amenity=bench` or `leisure=picnic_table`) within 400 m of the original spot that fits the needs of everyone who said yes. If none qualifies, use the original spot.
- **FR-STATE-5** State changes are decided on the server by one clock. Phones show what the server says; an offline phone shows the last known state and the time it was known.
- **FR-STATE-6** The host can cancel during Kindling. That ends in "Not this time" for everyone.

## 9. Functional requirements

### 9.1 Create (host)

- **FR-CRE-1** Opening the app goes straight to the camera. One tap takes the photo.
- **FR-CRE-2** The spot is the phone's location at capture, snapped to the nearest named OSM feature within 150 m ("Ford Woods Park, by the pond"). If none is found, use reverse geocoding to a street name. Never show raw coordinates.
- **FR-CRE-3** The AI drafts an invite of 6 words or fewer and a spoken scene of 20 words or fewer from the photo (FR-AI-1). Both appear for review; the host can edit or accept. "Send" sends.
- **FR-CRE-4** Quorum defaults to 2. One tap cycles 2, 3, 4. No other settings on this screen.
- **FR-CRE-5** Send produces three outputs at once: the link, the Telegram post (if the group uses the bot), and the plain-text version (FR-CH-4).
- **FR-CRE-6** Target: 15 screen seconds or less from open to sent.
- **FR-CRE-7** The host line defaults to "{Host} is waiting at {spot}." The host can change it.

### 9.2 Respond (invitee)

- **FR-RES-1** The link opens in Safari with no install and no account. It shows: photo, invite line, spot, walking time from the invitee's location (if they allow location), "Need N more", and one button: "I'm in".
- **FR-RES-2** "I'm in" is private. Nobody else sees who tapped. The only public signal is the count.
- **FR-RES-3** "Add a condition" is a small text link under the button. Free text, typed or dictated (FR-COND).
- **FR-RES-4** There is no No button. Not answering is the only way to decline.
- **FR-RES-5** After "I'm in", the screen says "You're in. We'll buzz you when it's lit." and can be closed. A web push notification (if allowed) or the Telegram bot announces Lit.
- **FR-RES-6** Target: 10 screen seconds or less from opening the link to "I'm in".
- **FR-RES-7** Before Lit, a person can take back their yes ("Take it back"). After Lit, the button becomes "Can't make it" (FR-STATE-1).

### 9.3 Conditions

- **FR-COND-1** Supported condition types: `with(person)` ("only if Amor comes"), `after(time)`, `back_by(time)`, `max_walk(minutes)`, and for Plans `max_step(n)` (FR-PLAN-6).
- **FR-COND-2** The phone parses free text into rules (FR-AI-2) and reads them back in one sentence: "Got it: only with Amor, back by 5 PM. Right?" with "Yes" and "Fix it".
- **FR-COND-3** Only the structured rule is sent. The free text never leaves the phone.
- **FR-COND-4** The solver picks the largest group whose rules can all be met. Ties go to more people, then the earlier start. A yes whose rules can't be met still counts toward nothing and is never shown as a no.
- **FR-COND-5** Unparseable text gets "I didn't catch that. Try 'after 2' or 'only with Amor'." and the yes stays unconditional only if the person confirms.

### 9.4 Lit and getting there

- **FR-LIT-1** On Lit, every yes gets a notification or bot message: "It's lit. {Host} is at {spot}."
- **FR-LIT-2** The Lit screen shows the host line, spot, walking time, the access line (FR-ACC-1) and two buttons: "Find them" (compass) and "I'm here".
- **FR-LIT-3** Everything needed after Lit (spot, compass target, access line, host line) is saved on the phone at the moment of Lit, so it works with no signal (FR-OFF-1).
- **FR-LIT-4** "I'm here" is tapped by the arriving person or by the host (+1 for each arrival, including friends without a phone). Headcount = host + arrivals, capped at yes-count + 3 (yes-count includes the host).
- **FR-LIT-5** The host taps "Done" when the group leaves. If nobody does, Gone at t0 + 4 h.

### 9.5 Talking compass

- **FR-CMP-1** The compass points from the person to the host's spot (or, if the host shares live location, to the host). It shows an arrow and distance, and speaks: "Fuego, 400 meters, slightly left."
- **FR-CMP-2** Speech repeats when the bearing changes by 30° or more, the distance halves, or every 60 s, whichever comes first. A haptic tick plays when facing within 15° of the target.
- **FR-CMP-3** It works with the screen locked where iOS allows audio to continue, and with no map tiles and no signal (target saved at Lit).
- **FR-CMP-4** Copy says what it is: "Finds your friend. Not for navigation or emergencies."
- **FR-CMP-5** The host's live location is opt-in, shared only while Lit, and only to people who said yes. It is never stored after Gone.

### 9.6 Access

- **FR-ACC-1** Access line: within 200 m of the spot, show counts and nearest distance from OSM: benches, restrooms, drinking water, and whether the walking route from the invitee has mapped steps. Example: "Bench 40 m · Restroom 180 m · No steps mapped".
- **FR-ACC-2** Needs profile, set once, stored only on the phone: avoid steps, max distance between rests (100, 200, 400 m), need a restroom within 300 m.
- **FR-ACC-3** If the spot fails a person's needs, their "I'm in" shows "This spot may not suit you. Count me in for a closer one?" If they agree, their yes counts only toward an Ember at a spot that fits. Nobody else learns why.
- **FR-ACC-4** Spoken scene: the invite photo carries the AI scene description (20 words or fewer) as alt text, read by VoiceOver.
- **FR-ACC-5** The whole respond flow and the compass work with VoiceOver, Dynamic Type up to the largest size, Reduce Motion, and without colour as the only signal.

### 9.7 Nature line

- **FR-NAT-1** Each Flare shows one line worth noticing, built only from real data: sunset time ("Sunset 6:57 PM"), a named natural feature from OSM within 200 m (water, a named tree, woods), or the season. Never invented. No AI-written facts.

### 9.8 After (Sparks)

- **FR-SPK-1** After Done, each person who tapped "I'm here" may write one line (140 characters or fewer) in their own words. No AI writing, no AI editing.
- **FR-SPK-2** Sparks are opt-in, encrypted with the group key, tied to the place name (not the pin), and shown on later Flares and Plans at the same place (FR-HOT-3).
- **FR-SPK-3** The Spark prompt appears once and can be dismissed. It never reminds.

### 9.9 Channels

- **FR-CH-1** Link page (core): works in any chat. Full experience in Safari. Installable to the Home Screen.
- **FR-CH-2** Telegram bot: posts the invite to the group with a live "Need N more"; private yes via an inline button that opens a private chat or the link; conditions by private message; posts "It's lit"; deletes its own posts at Gone. Members tap Start once.
- **FR-CH-3** Until the founder approves wider use, the bot posts only in the private "Flare test" group.
- **FR-CH-4** Plain text, 200 bytes or fewer, for SMS or satellite texting: `FLARE K7Q2 Ford Woods Park pond. Need 1 more. Reply IN K7Q2. Ends 3:40PM`. A reply of `IN K7Q2` relayed by any group member through the link page counts as a yes.
- **FR-CH-5** iMessage and WhatsApp use the link with a rich preview (photo blurred, invite line, "Need N more"). The preview image must not reveal the exact location.

### 9.10 No signal

- **FR-OFF-1** After Lit, the phone stores the spot, compass target, access line, host line and nature line. The Lit screen works in airplane mode.
- **FR-OFF-2** An outbox stores taps made offline ("I'm here", "Done", a Spark) and sends them when signal returns. Each has an idempotency key; repeats are ignored.
- **FR-OFF-3** On-phone AI works offline after a one-time download on Wi-Fi.
- **FR-OFF-4** OSM data is fetched live and cached for 7 days. A ready pack for the Fairlane area ships with the app.
- **FR-OFF-5** The app shows "Offline. Saved at 2:14 PM." when it is working from stored data.

### 9.11 AI jobs

| ID | Job | Input | Output | Fallback tiers |
| --- | --- | --- | --- | --- |
| FR-AI-1 | Photo to invite + spoken scene | Photo | Invite (6 words or fewer), scene (20 words or fewer) | Phone (Gemma 4 E2B in browser) → hub (Gemma 4 E4B via Ollama) → rules ("Outside at {spot}. Come?") |
| FR-AI-2 | Conditions to rules | Free text | JSON rules (FR-COND-1) | Phone → hub → regex rules for common phrases |
| FR-AI-3 | Needs check summary | Needs profile + OSM features | Pass or fail per need | Rules only (deterministic, no model) |
| FR-AI-9 | Plan ladder draft | Ask text, weather, sunset, nearby OSM places | 4 steps (name, place id, minutes) | Phone → hub → template ladder |
| FR-AI-10 | Rest-loop request to constraints | Free text | Duration, rest gap, preferences | Phone → hub → form |
| FR-AI-11 | Map photo to OSM tags | Photo | Tags from the allow-list | Phone → hub → manual form |

- **FR-AI-4** Every output is validated against a schema and length limit. Invalid output falls to the next tier.
- **FR-AI-5** Never describe faces, identities, age, race, or bodies. The prompt forbids it and a filter removes person words beyond "a person" or "people".
- **FR-AI-6** The tier that ran is recorded per job (as a counter) and shown in a small "made on this phone" note.
- **FR-AI-7** The phone tier is chosen by a runtime capability check (WebGPU present, adapter limits, memory hints, a timed warm-up), never by phone model name.
- **FR-AI-8** The model download is opt-in, on Wi-Fi, with size shown first. If it fails or stalls, the app keeps working on the next tier.

### 9.12 Privacy

- **FR-PRIV-1** Photos are encrypted on the phone with the group key. The key lives only in the link fragment (after `#`), which browsers do not send to the server.
- **FR-PRIV-2** Free-text conditions and needs profiles never leave the phone.
- **FR-PRIV-3** Who said yes is held only for the solve and to send Lit messages. It is never shown to others, and is deleted at Gone.
- **FR-PRIV-4** No accounts, no names on the server. Display names are encrypted with the group key.
- **FR-PRIV-5** Within 5 minutes of Gone, the server deletes the Flare record, the photo ciphertext, yes records, rules and live locations. Only counters remain (07-kpis.md) plus opt-in encrypted Sparks.
- **FR-PRIV-6** A deletion audit script lists every store and returns the count of remaining records per Flare. The post shows its output after the field test.
- **FR-PRIV-7** The privacy page states the limits honestly: Telegram sees what's posted in Telegram; in small groups people can sometimes guess who said yes; SMS and satellite texts are outside our control.

### 9.13 Capability page

- **FR-CAP-1** A page at `/check` shows, for the phone it runs on: iOS and Safari version, WebGPU yes/no and adapter info, storage estimate, geolocation, compass (device orientation), speech synthesis, web push, which AI tier would run, and a timed test of each. One button copies the report.

### 9.14 Website

- **FR-WEB-1** Pages: Home (what Flare is, in one screen), How it works (the four states), Privacy (promises and limits, the audit), Accessibility (statement, what we tested, known gaps), Run it yourself (self-hosting steps, license).
- **FR-WEB-2** The site follows the same copy rules and loads in under 2 s on a mid-range phone on 4G.

## 10. Non-functional requirements

- **NFR-1 Speed:** link page interactive in 2 s or less on iPhone 13 over 4G; "I'm in" acknowledged in 500 ms or less (optimistic UI).
- **NFR-2 Size:** link page JavaScript 150 KB gzipped or less before any model.
- **NFR-3 Accessibility:** WCAG 2.2 AA for every screen; VoiceOver flows tested on a real iPhone.
- **NFR-4 Reliability:** state changes survive a server restart. Duplicate taps are harmless.
- **NFR-5 Security:** no secrets in the client; the bot token and database credentials live only on the server.
- **NFR-6 Open source:** code under AGPL-3.0 (founder preference) so modified servers must publish source and the deletion promise stays checkable. The architect confirms.
- **NFR-7 Brand and feel:** full brand, motion and sound, premium on every phone. Motion respects Reduce Motion; sound respects the silent switch.
- **NFR-8 Copy:** buttons 3 words or fewer; messages 12 words or fewer; warm, a bit playful, always clear.

## 11. Plan mode (P0)

A Plan is a planned ask for a later time with a deadline to answer, a ladder of four options from big to small, private conditions, and a solver that picks the biggest group at the highest step. It uses the same engine, channels, privacy and access rules as a Flare. Version 1.1 change: Plan mode moved from Later to P0 (founder change request, Oct 10).

### 11.1 States (Plan)

All times are absolute (the host picks them). D = answer deadline. S = start time. D must be at least 10 minutes after creation and at least 10 minutes before S.

| State | Enters when | What everyone sees | Leaves when |
| --- | --- | --- | --- |
| **Kindling** | Host sends | Ask line, ladder, start time, deadline, "Need N more" | D reached (to Lit, Ember or Gone) |
| **Lit** | At D, the solver finds a group of at least quorum at some step | "It's on: {step} at {time}." The chosen step only | Host taps Done, or S + step duration + 60 min (to Gone) |
| **Ember** | At D, no group reaches quorum at any step, but at least 2 people (host included) fit step 4 | "Smaller plan: {step 4} at {time}." | Immediately Lit at step 4 with those people |
| **Gone** | Done, timeout, cancel, or nothing fits at D | Lit: "Thanks for coming." Otherwise: "Not this time." | Terminal. Deletion (FR-PRIV-5) |

- **FR-PLAN-1** A Plan is lit only at D, not before, so late yeses can still raise the step. Exception: if every invited person has said yes before D with no conditions, it lights early at the top fitting step.
- **FR-PLAN-2** Default quorum 3 (host included). Host may pick 2 to 6.
- **FR-PLAN-3** The ladder has exactly 4 steps, step 1 the biggest. Each step has a name, a place (OSM feature or "home"), a duration in minutes, and an access summary. Example: 1 "Ford Woods loop, 60 min"; 2 "Park loop, 30 min"; 3 "Short walk, 15 min"; 4 "20 min on the porch".
- **FR-PLAN-4** The ladder is drafted from weather, sunset and nearby places (FR-AI-9) and the host can edit any step in place. A deterministic template fills any step the AI can't.
- **FR-PLAN-5** Step durations must end before sunset unless the host turns that check off; the app says "Ends after sunset" next to any step that doesn't.

### 11.2 Answering a Plan

- **FR-PLAN-6** Same private "I'm in" as a Flare, plus conditions. Conditions add a fifth type: `max_step(n)` ("just the short one" means step 3 or smaller, "porch only" means step 4).
- **FR-PLAN-7** The read-back names the step: "Got it: step 3 or smaller, back by 5 PM. Right?"
- **FR-PLAN-8** "Need N more" shows the count needed at the highest step that could still light.

### 11.3 Solver (Plan)

- **FR-PLAN-9** At D, for each step from 1 to 4, find the largest set of yeses whose conditions all hold at that step. Pick the step and set by: most people first, then the higher step (smaller number), then the earlier start. The set must be at least quorum, except under Ember (FR-PLAN-11).
- **FR-PLAN-10** Needs check per step: each phone checks its own needs profile against each step's place and reports pass or fail per step id. A failed step behaves like `max_step` for that person. No reason is sent.
- **FR-PLAN-11** If no step reaches quorum but at least 2 people fit step 4, the Plan lights at step 4 (counted as an Ember save).

### 11.4 I'm fading

- **FR-PLAN-12** Any person in the solved group of a Lit Plan can privately tap "I'm fading" until S + 50% of the step duration.
- **FR-PLAN-13** Each fade moves the Plan down one step (never below 4) and re-runs the solver at the new step with the same people. Each person can fade once per Plan.
- **FR-PLAN-14** Everyone sees "Smaller plan: {step}." Nobody sees who faded or how many fades there were.
- **FR-PLAN-15** If the new step changes the place, the compass target and saved offline data update for everyone.

### 11.5 Sunday use

The founder sends a real Plan ("Fairlane walk at 11?") after the release-candidate deploy, with a deadline before 11 AM. Plan mode must therefore be in the 10 AM release candidate.

## 12. Hot spots (P0)

- **FR-HOT-1** A group's Hot spots list shows place names where the group lit a Flare or Plan, with the number of times and the most recent Spark. Ordered by count, then most recent.
- **FR-HOT-2** Stored as one blob per group, encrypted on the phone with the group key. The server cannot read place names. Updated by the host's phone at Gone.
- **FR-HOT-3** "Your group met here N times." shows on a new Flare or Plan at a place when N is 1 or more, with one Spark if any. (Version 1.1: threshold lowered from 2 to 1 so the test day shows real history.)
- **FR-HOT-4** Opening the list is optional and never prompted. It adds 0 s unless opened.

## 13. Bench to Bench rest loop (P1)

- **FR-REST-1** Input in plain words, typed or spoken: "Knee's bad, 40 minutes, want trees". The phone parses it to: duration (minutes), max distance between rests (metres, defaults from the needs profile), preferences (trees, water, quiet), avoid steps (from needs). Read back for confirmation.
- **FR-REST-2** The loop starts and ends at the chosen spot, follows OSM paths a person can walk (`highway=footway|path|pedestrian|living_street|residential`, excluding `highway=steps` when avoid steps is on), and passes a bench (or picnic table) at least every max-rest-distance metres.
- **FR-REST-3** Total walking time at 3 km/h (slow pace) is within ±20% of the requested duration, not counting rest stops.
- **FR-REST-4** If no loop meets the rest limit, say so: "No loop keeps benches that close. Try 300 m?" Never return a loop that breaks the limit.
- **FR-REST-5** Output: a large-print card (A4 or Letter, 18 pt minimum body text, high contrast) with a simple sketch, numbered turns in words, each bench with distance from the last, restrooms and water. Printable from the share sheet as PDF.
- **FR-REST-6** The card is the walking interface; no screen use is needed on the walk. The app also offers the same turns as spoken audio.

## 14. Fix the map (P1)

- **FR-MAP-1** On a walk or after, a person photographs a bench, restroom, drinking fountain, or steps that OSM is missing or has wrong.
- **FR-MAP-2** The AI drafts OSM tags from the photo (for example `amenity=bench`, `backrest=yes`, `material=wood`) using only keys from a fixed allow-list. Location comes from the phone.
- **FR-MAP-3** A person reviews every tag: keep, change or remove. Nothing is saved without a review.
- **FR-MAP-4** Output is an export only: OSM Note text (location plus description) or an `.osm` change file. **Nothing is sent to OpenStreetMap from the app.** Publishing waits for the founder's yes.
- **FR-MAP-5** The photo is not included in the export and is deleted after drafting.
