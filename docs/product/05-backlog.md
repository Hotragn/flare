# Flare: Prioritized backlog

Priority: **P0** must work in the Sunday 10 AM release candidate. **P1** must ship before the DEV deadline (Mon 06:59 UTC). **P2** Later. Each story lists its PRD requirements, the screen seconds it adds per person, and acceptance criteria (AC) written so QA can test them.

## E1. Flare engine (server): P0

**E1-S1 Create a Flare.** As a host, I send a Flare so friends can join. (FR-CRE-5, FR-STATE-5)
- AC1: POST with encrypted photo, spot name, quorum (2 to 4) returns a Flare id and short code (4 to 5 characters, no ambiguous letters) in under 500 ms.
- AC2: State is Kindling with yes-count 1 (the host).
- AC3: Quorum outside 2 to 4 is rejected with a clear error.

**E1-S2 Timed transitions.** (FR-STATE table)
- AC1: Not lit at t0 + 30 min → Ember with quorum 2 and the Ember spot set (E6-S3).
- AC2: Ember not lit at t0 + 60 min → Gone.
- AC3: Lit Flare → Gone on Done or at t0 + 4 h.
- AC4: Transitions run from a server-side scheduler that survives a restart (test: restart mid-Kindling, transition still fires within 60 s of its time).

**E1-S3 Yes, take back, can't make it.** (FR-RES-2, FR-RES-7, FR-STATE-1)
- AC1: A yes with the same idempotency key twice counts once.
- AC2: Take back before Lit lowers the count; after Lit the state stays Lit.
- AC3: No API returns who said yes to anyone but the solver.

**E1-S4 Solver.** (FR-COND-4, FR-STATE-2)
- AC1: Given yes records with rules, returns the largest set whose rules all hold, tie-broken by size then earliest start.
- AC2: Unit tests cover: no rules; `with` chains (A only with B, B only with C); conflicting times; `max_walk`; a yes that can never be satisfied.
- AC3: "Need N more" equals quorum minus the solver's set size, never below 0.

**E1-S5 Deletion at Gone.** (FR-PRIV-5)
- AC1: Within 5 minutes of Gone, the Flare record, yes records, rules, photo ciphertext and live locations are deleted from every store.
- AC2: Only the counters in 07-kpis.md remain, keyed by an opaque group id.
- AC3: Deletion is enforced in two ways: an explicit delete job and a storage-level expiry (TTL or equivalent) set at creation to t0 + 5 h.

**E1-S6 Deletion audit.** (FR-PRIV-6)
- AC1: A script lists every store and prints remaining records per Flare id and in total.
- AC2: After the field test it prints 0 for every Flare record, photo and rule. Output is saved for the post.

## E2. Host flow (app): P0

**E2-S1 Camera first.** (FR-CRE-1) Adds 2 s.
- AC1: Opening the installed app shows a live camera within 1.5 s on iPhone 13.
- AC2: One tap captures; retake is one tap.
- AC3: If camera permission is denied, show "Pick a photo" and the photo library.

**E2-S2 Spot naming.** (FR-CRE-2)
- AC1: Names the nearest OSM named feature within 150 m; falls back to street name; never shows coordinates.
- AC2: Works offline in the Fairlane pack area.

**E2-S3 Draft and send.** (FR-CRE-3, FR-CRE-4, FR-CRE-6) Adds 4 s.
- AC1: Invite and scene drafts appear within 6 s on the phone tier, 4 s on the hub tier, instantly on the rules tier.
- AC2: Quorum chip cycles 2, 3, 4.
- AC3: Median host time open-to-sent is 15 s or less over 5 trials.

**E2-S4 Share outputs.** (FR-CRE-5, FR-CH-4, FR-CH-5)
- AC1: After Send, the iOS share sheet opens with the link; a "Copy text" action copies the 200-byte plain-text version.
- AC2: The plain text is 200 bytes or fewer in UTF-8 for every spot name in the Fairlane pack (test all).
- AC3: Link preview shows a blurred photo and no coordinates.

**E2-S5 Host controls while Kindling and Lit.** (FR-STATE-6, FR-LIT-4, FR-LIT-5)
- AC1: Cancel during Kindling ends in "Not this time" for all.
- AC2: "+1" adds an arrival; "Done" ends the Flare.

## E3. Invitee flow (link page): P0

**E3-S1 Open and understand.** (FR-RES-1) Adds 5 s.
- AC1: Link page interactive in 2 s or less on iPhone 13 over 4G (Lighthouse mobile, throttled).
- AC2: Shows photo, invite, spot, walking time (if location allowed), "Need N more", "I'm in".
- AC3: Decrypts the photo with the key from the fragment; with a wrong or missing key shows "This link is missing its key."

**E3-S2 I'm in.** (FR-RES-2, FR-RES-5, FR-RES-6) Adds 1 s.
- AC1: Tap shows "You're in." within 500 ms (optimistic), confirmed by the server.
- AC2: Offline tap is queued in the outbox and sent once on reconnect.
- AC3: Median time from link open to "I'm in" is 10 s or less over 5 trials.

**E3-S3 Lit notice.** (FR-LIT-1)
- AC1: Web push (when allowed and supported) or Telegram message arrives within 10 s of Lit.
- AC2: If neither is available, the open link page updates within 10 s.

**E3-S4 Lit screen.** (FR-LIT-2, FR-LIT-3, FR-OFF-1, FR-OFF-5)
- AC1: Shows host line, spot, walking time, access line, nature line, "Find them", "I'm here".
- AC2: In airplane mode after Lit, the screen renders from storage and shows "Offline. Saved at {time}."

## E4. Telegram bot: P0

**E4-S1 Post and count.** (FR-CH-2, FR-CH-3)
- AC1: In the "Flare test" group, a Flare posts the photo, invite and "Need N more" with an "I'm in" button.
- AC2: The count updates in place (message edit) within 5 s of each change.
- AC3: The bot refuses to post in any chat other than the allow-listed "Flare test" group id until the founder approves.

**E4-S2 Private yes and conditions.** (FR-RES-2, FR-COND)
- AC1: "I'm in" registers a private yes; the group message shows only the count.
- AC2: A member can send a condition by private message; the bot replies with the read-back.

**E4-S3 Lit and cleanup.** (FR-LIT-1, FR-PRIV-5)
- AC1: Bot posts "It's lit. {Host} is at {spot}." and privately messages each yes.
- AC2: At Gone, the bot deletes every message it posted for that Flare (Telegram allows bots to delete their own messages within 48 h).

## E5. Conditions: P0 (rules tier), P1 (AI tiers)

**E5-S1 Rules-tier parser.** (FR-COND-1, FR-COND-5) P0.
- AC1: Parses at least these: "only if {name} comes", "with {name}", "after {time}", "back by {time}", "not before {time}", "max {n} min walk", "short one".
- AC2: Test set of 40 phrases; at least 36 parse correctly; failures get the "I didn't catch that" message.

**E5-S2 AI parser on phone and hub.** (FR-AI-2) P1.
- AC1: Same 40-phrase set plus 20 harder phrases; reports accuracy per tier in a table.
- AC2: Output validated against the rule schema; invalid output falls to the rules tier.

**E5-S3 Read-back.** (FR-COND-2, FR-COND-3) P0. Adds 3 s for those who use it.
- AC1: Read-back sentence is 12 words or fewer for one or two rules.
- AC2: Network inspection shows only structured rules sent, never the free text.

## E6. Access: P0

**E6-S1 Needs profile.** (FR-ACC-2) Adds 15 s once, never again.
- AC1: Three settings, stored only in on-device storage; network inspection shows none sent.

**E6-S2 Access line.** (FR-ACC-1)
- AC1: Counts and nearest distance for benches, restrooms, drinking water within 200 m from OSM.
- AC2: Steps: reports "Steps mapped" if any `highway=steps` lies on or within 20 m of the straight-line path, else "No steps mapped". Copy never claims a route is step-free.

**E6-S3 Spot check and Ember routing.** (FR-ACC-3, FR-STATE-4)
- AC1: When the spot fails a need, the phone shows the prompt; agreeing records a yes flagged "Ember only", with no reason sent.
- AC2: Ember spot selection honours every "Ember only" yes's needs (checked on each phone, which reports pass/fail per candidate bench id, not its needs).
- AC3: No screen or bot message differs for others.

**E6-S4 Spoken scene.** (FR-ACC-4)
- AC1: Photo `alt` is the scene text; VoiceOver reads it on the link page.

**E6-S5 Accessibility pass.** (FR-ACC-5, NFR-3)
- AC1: J3 completes on a real iPhone with VoiceOver on, recorded on video.
- AC2: axe-core shows 0 serious or critical issues on every screen.

## E7. Talking compass: P0

**E7-S1 Bearing and distance.** (FR-CMP-1, FR-CMP-3)
- AC1: Uses device orientation (with the iOS permission prompt) and GPS; distance within 10 m of a reference at 100 m, bearing within 20° outdoors.
- AC2: Works in airplane mode with the saved target.

**E7-S2 Speech and haptics.** (FR-CMP-2)
- AC1: Speaks on the triggers in FR-CMP-2, using on-device speech synthesis.
- AC2: Haptic tick when within 15° (where the device supports vibration; iOS Safari limits are documented).

**E7-S3 Host live location.** (FR-CMP-5) P1.
- AC1: Opt-in, only while Lit, only to yeses; deleted at Gone.

## E8. On-device AI tiers: P0 (rules, hub), P1 (phone)

**E8-S1 Capability check.** (FR-AI-7, FR-CAP-1) P0.
- AC1: `/check` reports every item in FR-CAP-1 and a recommended tier, with a "Copy report" button.

**E8-S2 Photo to invite + scene.** (FR-AI-1, FR-AI-4, FR-AI-5) P0 for hub and rules, P1 for phone.
- AC1: Outputs pass schema and length checks on 20 test photos from the Fairlane area.
- AC2: 0 of 20 outputs mention faces, identity, age or bodies.
- AC3: Tier recorded per run.

**E8-S3 Phone-tier download.** (FR-AI-8) P1.
- AC1: Shows size before download; Wi-Fi only by default; resumable or cleanly restartable; failure leaves the app on the next tier.
- AC2: Measured download size, load time and per-job latency on each test phone go into a table.

**E8-S4 "Made on this phone" note.** (FR-AI-6) P0. Adds 0 s (passive).

## E9. Offline and outbox: P0

**E9-S1 Save at Lit.** (FR-OFF-1)
**E9-S2 Outbox.** (FR-OFF-2)
- AC1: Taps made offline send once on reconnect; server ignores duplicates by idempotency key.
**E9-S3 Fairlane pack.** (FR-OFF-4)
- AC1: Benches, restrooms, water, parks, named features and steps within 3 km of Fairlane Town Center ship with the app, with the query and date recorded.
**E9-S4 Plain-text relay.** (FR-CH-4) P1.
- AC1: Host enters "IN K7Q2" received by SMS; it counts as a yes once.

## E10. Sparks: P1

**E10-S1 Leave a Spark.** (FR-SPK-1, FR-SPK-3) Adds 10 s, optional, once.
**E10-S2 Show history at a place.** (FR-SPK-2)
- AC1: "Your group met here N times." appears only when N is 2 or more.

## E11. Brand, motion, sound: P0

**E11-S1 Brand applied** to app and site (from the design role).
**E11-S2 Motion and sound** for Kindling, Lit, Ember, Gone; respects Reduce Motion and the silent switch.
- AC1: Lit has a distinct sound and haptic; total added screen time 0 s.

## E12. Website: P0

**E12-S1 Five pages** per FR-WEB-1. **E12-S2** Lighthouse mobile performance 90+, accessibility 100.

## E13. Field test kit: P0

**E13-S1 Field checklist** (who does what at each step, 11 AM to 3 PM).
**E13-S2 Metrics export:** one command prints the KPI table for the test window.
**E13-S3 Consent capture:** a simple checklist per person for name, face and voice in the post.

## E14. Post assets: P1

**E14-S1 DEV post draft** following the template, with field-test table, tier table, deletion audit output, "what broke".
**E14-S2 Demo video** (no faces or voices without consent).
**E14-S3 Agent session** saved with DevRelay and embedded (made public, scrubbed of keys).

## Later (P2)

Plan mode and the ladder; "I'm fading"; rest-loop routing; Fix the map (OSM contributions, which also need founder approval to publish); Hot spots list; Android-specific testing; more languages; group admin tools.
