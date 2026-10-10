# Flare: Software requirements specification (SRS)

Structure follows ISO/IEC/IEEE 29148:2018 (section 9.6, SRS content). Version 1.0, Sat 2026-10-10. Owner: Analyst.

## 1. Introduction

### 1.1 Purpose
This SRS states every requirement the Flare app, server, Telegram bot and website must meet for the DEV Hacktoberfest Week 1 entry. Engineers build to it; QA tests against it; the traceability matrix (05-rtm.csv) links each requirement to stories, acceptance criteria, design, code, tests and proof.

### 1.2 Scope
Flare lets a host send a Flare (meet now) or a Plan (meet later) to friends. Friends say yes privately; it happens only if enough say yes; it shrinks instead of failing; it works for friends with low vision or limited mobility and with no signal; and it deletes itself. Products: the **app** (installable web app for iPhone, plus the link page), the **server** (engine, solver, scheduler, API), the **Telegram bot**, and the **website**.

### 1.3 Definitions
See docs/product/10-glossary-and-decisions.md. Additional terms: **gathering** = a Flare or a Plan; **place key** = OSM element id of a spot, else its name; **group key** = symmetric key in the link fragment.

### 1.4 References
- docs/product/03-prd.md (PRD v1.1), 05-backlog.md, 06-scope.md, 07-kpis.md, 09-risks.md
- docs/requirements/03-business-rules.md (BR-*), 04-data-flow-and-dictionary.md, 02-use-cases.md
- docs/requirements/evidence/README.md (pinned numbers)
- WCAG 2.2, https://www.w3.org/TR/WCAG22/
- ISO/IEC/IEEE 29148:2018

### 1.5 Requirement format
Each requirement has: **ID**; a statement using "shall"; **Pri** (P0 = in the Sun 10 AM release candidate; P1 = before the DEV deadline; P2 = later); **Source** (PRD or BR id, or founder); **Story** (backlog story and AC); **V** = verification method (T test, D demonstration, I inspection, A analysis). A requirement is met only when its fit criterion (the number or condition in the statement) is observed.

## 2. Overall description

### 2.1 Product perspective
New, standalone system. External systems: Telegram Bot API, Web Push (Apple Push for Safari), OpenStreetMap Overpass API, the hub (Ollama with Gemma 4 E4B on the team's Mac), on-device model files from a public model host, SMS or satellite messaging (outside the system).

### 2.2 User classes
Host; invitee; invitee with access needs (low vision, limited mobility); Telegram member; text-only member (SMS relay); operator (the team: deploy, audit, metrics). No accounts exist for any class.

### 2.3 Operating environment
- Phones: iPhone 13, 16 Pro Max, 17 Pro, 17 Pro Max. iOS versions unknown until Sunday; behaviour must be chosen by runtime capability detection only.
- Browser: Safari on iOS (link page and installed Home Screen app). Desktop Chrome, Firefox and Safari current versions for development and the website.
- Server: hosted HTTPS service (Render is the candidate; deploy needs the founder's yes).
- Hub: macOS laptop with Ollama and `gemma4:e4b`.

### 2.4 Constraints
DEV rules (new work in the window; template; tag; deadline Mon 06:59 UTC); open models only for AI jobs; no hardware; no end-user accounts; founder approval for every public action; first names only in public materials until consent; writing rules (docs/product/01-brd.md section 6).

### 2.5 Assumptions and dependencies
- AS-1 At least two of the four phones run iOS with Safari web push support for Home Screen apps; otherwise Telegram or the open page carries Lit notices.
- AS-2 OSM data near Fairlane is current enough (pinned Oct 10, 17:07 UTC).
- AS-3 The hub laptop has internet during the field test, or the rules tier is used.
- AS-4 The lab session supplies the phone-tier model choice (MediaPipe Gemma 4 E2B, or a vision model under 600 MB).

## 3. Specific requirements

### 3.1 External interfaces

| ID | Requirement | Pri | Source | Story | V |
| --- | --- | --- | --- | --- | --- |
| SRS-IF-1 | The server shall expose an HTTPS JSON API over TLS 1.2 or later; every write accepts an idempotency key. | P0 | FR-OFF-2 | E9-S2 | T |
| SRS-IF-2 | The bot shall use the Telegram Bot API via webhook to the server, with the bot token held only on the server. | P0 | FR-CH-2, NFR-5 | E4-S1 | I |
| SRS-IF-3 | The server shall send Lit and change notices by Web Push to subscribed members, where the browser supports it. | P0 | FR-RES-5 | E3-S3 | T |
| SRS-IF-4 | The app shall read OSM data from a bundled Fairlane pack first, then the Overpass API with a User-Agent, checking `timestamp_osm_base` is less than 7 days old. | P0 | FR-OFF-4, BUG-004 | E9-S3 | T |
| SRS-IF-5 | The server shall reach the hub over an authenticated HTTPS route; the hub is never exposed without a secret. | P0 | FR-AI-1 | E8-S2 | I |
| SRS-IF-6 | The app shall use the iOS share sheet (Web Share API) for links, text and PDFs. | P0 | FR-CRE-5 | E2-S4 | D |

### 3.2 Functional: groups and identity

| ID | Requirement | Pri | Source | Story | V |
| --- | --- | --- | --- | --- | --- |
| SRS-ID-1 | The system shall create a group with a random 128-bit id and a random 256-bit group key on the creator's phone. | P0 | BR-ID-1 | E1-S1 | T |
| SRS-ID-2 | The group key shall be carried only in the URL fragment and never sent to the server, logged, or put in previews. | P0 | FR-PRIV-1 | E3-S1 AC3 | T |
| SRS-ID-3 | The phone shall create a random member id per group on first open and store it locally. | P0 | BR-ID-2 | E3-S1 | T |
| SRS-ID-4 | Display names shall be stored on the server only as ciphertext under the group key. | P0 | BR-ID-3, FR-PRIV-4 | E3-S1 | T |
| SRS-ID-5 | The system shall reject groups larger than 12 members with "Groups max out at 12." | P0 | BR-S-4 | E1-S4 | T |
| SRS-ID-6 | Any member shall be able to tap "Forget this group", deleting their member id, push subscription and local data, and, if they are the last member, the group's Sparks and Hot spots blob. | P1 | BR-D-5 | E10-S3 | T |
| SRS-ID-7 | Member ids shall be per group (BR-ID-4); for Telegram members the bot shall keep the Telegram-to-member map per BR-ID-5. | P0 | BR-ID-4, BR-ID-5 | E4-S2 | T |

### 3.3 Functional: create a Flare

| ID | Requirement | Pri | Source | Story | V |
| --- | --- | --- | --- | --- | --- |
| SRS-CRE-1 | Opening the installed app shall show a live camera within 1.5 s on iPhone 13 (cold start excluded). | P0 | FR-CRE-1 | E2-S1 AC1 | T |
| SRS-CRE-2 | If camera permission is denied, the app shall offer "Pick a photo" from the library. | P0 | FR-CRE-1 | E2-S1 AC3 | T |
| SRS-CRE-3 | The spot shall be named from the nearest named OSM feature within 150 m, else the street name; coordinates shall never be displayed. | P0 | FR-CRE-2 | E2-S2 | T |
| SRS-CRE-4 | The app shall draft an invite of ≤ 6 words and a scene of ≤ 20 words (SRS-AI-1) and let the host edit or accept both. | P0 | FR-CRE-3 | E2-S3 | T |
| SRS-CRE-5 | The quorum control shall cycle 2, 3, 4 on tap; default 2. It shall be the only setting on the create screen. | P0 | BR-Q-2, FR-CRE-4 | E2-S3 AC2 | T |
| SRS-CRE-6 | The photo shall be encrypted on the phone with the group key before upload. | P0 | FR-PRIV-1 | E1-S1 | T |
| SRS-CRE-7 | Send shall create the Flare and produce the link, the plain-text form (BR-CH-2) and, if the group has the bot, the Telegram post, in one action. | P0 | FR-CRE-5 | E2-S4 | T |
| SRS-CRE-8 | The host line shall default to "{Host} is waiting at {spot}." and be editable before Send. | P0 | FR-CRE-7 | E2-S3 | T |
| SRS-CRE-9 | Median host time from app open to Send shall be ≤ 15 s over 5 trials on each test phone. | P0 | FR-CRE-6 | E2-S3 AC3 | T |

### 3.4 Functional: respond

| ID | Requirement | Pri | Source | Story | V |
| --- | --- | --- | --- | --- | --- |
| SRS-RES-1 | The link page shall open in Safari with no install and no account and show photo, invite, spot, walking time (if location is allowed), "Need N more" and "I'm in". | P0 | FR-RES-1 | E3-S1 | T |
| SRS-RES-2 | A missing or wrong key shall show "This link is missing its key." and no photo. | P0 | E3-S1 AC3 | E3-S1 | T |
| SRS-RES-3 | "I'm in" shall show "You're in." within 500 ms (optimistic) and be confirmed by the server. | P0 | FR-RES-5 | E3-S2 AC1 | T |
| SRS-RES-4 | No response or page shall reveal which members said yes, or when (BR-Q-5). | P0 | FR-RES-2 | E1-S3 AC3 | T |
| SRS-RES-5 | There shall be no No button and no "decline" action anywhere. | P0 | FR-RES-4 | E3-S1 | I |
| SRS-RES-6 | Before Lit, "Take it back" shall remove the member's yes; after Lit the control shall read "Can't make it" and not change state. | P0 | FR-RES-7, BR-F-7 | E1-S3 AC2 | T |
| SRS-RES-7 | Median invitee time from link open to "I'm in" shall be ≤ 10 s over 5 trials on each test phone. | P0 | FR-RES-6 | E3-S2 AC3 | T |
| SRS-RES-8 | "Add a condition" shall appear as a small text link under "I'm in", never as a required step. | P0 | FR-RES-3 | E3-S2 | I |

### 3.5 Functional: conditions

| ID | Requirement | Pri | Source | Story | V |
| --- | --- | --- | --- | --- | --- |
| SRS-COND-1 | The phone shall parse typed or dictated text into rules of the types in BR-C-1 with 0 to 4 rules per yes. | P0 | FR-COND-1, BR-C-2 | E5-S1 | T |
| SRS-COND-2 | The rules-tier parser shall parse ≥ 36 of the 40 phrases in the test set (docs/requirements/fixtures/conditions-60.json, core_40). | P0 | E5-S1 AC2 | E5-S1 | T |
| SRS-COND-3 | The hub-tier parser shall be used when available and report accuracy on core_40 and hard_20 in docs/requirements/fixtures/conditions-60.json. | P0 | FR-AI-2, CR-1 | E5-S2 | T |
| SRS-COND-4 | The phone-tier parser shall report accuracy on the same 60 phrases. | P1 | FR-AI-2 | E5-S2 | T |
| SRS-COND-5 | The phone shall read rules back in ≤ 12 words and save them only after "Yes". | P0 | FR-COND-2, BR-C-10 | E5-S3 AC1 | T |
| SRS-COND-6 | Only structured rules shall leave the phone; network capture shall show no free text. | P0 | BR-C-9, FR-COND-3 | E5-S3 AC2 | T |
| SRS-COND-7 | A `with` rule naming no member shall be refused with "{Name} isn't in this group." | P0 | BR-C-4 | E5-S1 | T |
| SRS-COND-8 | Unparseable text shall show "I didn't catch that. Try 'after 2' or 'only with Amor'." | P0 | FR-COND-5 | E5-S1 | T |
| SRS-COND-9 | Condition evaluation shall follow BR-C-3 and BR-C-5 to BR-C-8 exactly, including the 60-minute Flare duration for `back_by` and the 1.3 detour factor for `max_walk`. | P0 | BR-C-3, BR-C-5 to BR-C-8 | E1-S4 | T |

### 3.6 Functional: solver and state

| ID | Requirement | Pri | Source | Story | V |
| --- | --- | --- | --- | --- | --- |
| SRS-SOL-1 | The solver shall implement BR-S-1 to BR-S-6 exactly and be deterministic. | P0 | FR-COND-4 | E1-S4 | T |
| SRS-SOL-2 | The solver shall pass the unit cases in E1-S4 AC2 and E15-S3 AC2. | P0 | E1-S4, E15-S3 | E1-S4 | T |
| SRS-SOL-3 | "Need N more" shall follow BR-Q-4 and update for all viewers within 5 s of any change. | P0 | FR-STATE-2 | E1-S4 AC3 | T |
| SRS-SOL-4 | The host shall count as 1 yes (BR-Q-1); lighting shall follow BR-Q-3; "Ember only" yeses shall follow BR-Q-6. | P0 | BR-Q-1, BR-Q-3, BR-Q-6 | E1-S4 | T |
| SRS-ST-1 | Flare transitions shall follow BR-F-1 to BR-F-7. | P0 | PRD 8, FR-STATE-1 | E1-S2 | T |
| SRS-ST-2 | Timer transitions shall fire within 30 s of schedule, including after a server restart. | P0 | BR-F-8 | E1-S2 AC4 | T |
| SRS-ST-3 | Unlit gatherings shall end with the identical text "Not this time." for every member. | P0 | FR-STATE-3 | E1-S2 | T |
| SRS-ST-4 | The host shall be able to cancel only in Kindling or Ember. | P0 | BR-F-6, FR-STATE-6 | E2-S5 | T |
| SRS-TIME-1 | Every transition shall be decided by the server clock (BR-TIME-1); phones shall display server times in the group time zone (BR-TIME-2) with the last-confirmed time (BR-TIME-3). | P0 | FR-STATE-5, BR-TIME-1 to BR-TIME-3 | E1-S2, E3-S4 | T |

### 3.7 Functional: Ember

| ID | Requirement | Pri | Source | Story | V |
| --- | --- | --- | --- | --- | --- |
| SRS-EMB-1 | The Ember spot shall be chosen by BR-E-1 to BR-E-4. | P0 | FR-STATE-4 | E6-S3 | T |
| SRS-EMB-2 | Entering Ember shall show "Smaller plan: 15 min at {bench}." to all, with quorum 2. | P0 | BR-E-5 | E1-S2 AC1 | T |
| SRS-EMB-3 | A Flare lit in Ember shall increment `embers_lit`. | P0 | BR-E-6 | E1-S2 | T |

### 3.8 Functional: Plans

| ID | Requirement | Pri | Source | Story | V |
| --- | --- | --- | --- | --- | --- |
| SRS-PLAN-1 | The host shall create a Plan from an ask line, start time S and deadline D, validated by BR-P-1. | P0 | FR-PLAN-2 | E15-S1 AC3 | T |
| SRS-PLAN-2 | The app shall draft a 4-step ladder (BR-P-4) within 8 s on the hub tier or instantly from the template tier, with every step editable. | P0 | FR-PLAN-3, FR-PLAN-4 | E15-S1 AC1, AC2 | T |
| SRS-PLAN-3 | Steps ending after sunset shall show "Ends after sunset" (BR-P-9). | P0 | FR-PLAN-5 | E15-S1 AC4 | T |
| SRS-PLAN-4 | Plan quorum shall be 2 to 6, default 3. | P0 | BR-Q-2 | E15-S1 | T |
| SRS-PLAN-5 | A Plan shall light only per BR-P-2 and BR-P-3. | P0 | FR-PLAN-1, FR-PLAN-9, FR-PLAN-11 | E15-S3 | T |
| SRS-PLAN-6 | Each phone shall check its needs against each step's place and report only pass or fail per step id. | P0 | FR-PLAN-10 | E15-S3 | T |
| SRS-PLAN-7 | "I'm fading" shall follow BR-P-5 to BR-P-7. | P0 | FR-PLAN-12 to 14 | E15-S4 | T |
| SRS-PLAN-8 | After a fade that changes place, the compass target and saved offline data shall update within 10 s on phones with signal. | P0 | FR-PLAN-15 | E15-S4 AC3 | T |
| SRS-PLAN-9 | A Lit Plan shall become Gone per BR-P-8. | P0 | PRD 11.1 | E15-S3 | T |
| SRS-PLAN-10 | Plan answers shall accept `max_step` conditions and the read-back shall name the step ("Got it: step 3 or smaller, back by 5 PM. Right?"). | P0 | FR-PLAN-6, FR-PLAN-7 | E15-S2 AC1 | T |
| SRS-PLAN-11 | A Plan's "Need N more" shall be computed at the highest step that could still light. | P0 | FR-PLAN-8, BR-Q-4 | E15-S2 AC2 | T |

### 3.9 Functional: Lit, arrival, compass

| ID | Requirement | Pri | Source | Story | V |
| --- | --- | --- | --- | --- | --- |
| SRS-LIT-1 | On Lit, every member in the chosen set shall receive "It's lit. {Host} is at {spot}." by push, bot, or the open page within 10 s. | P0 | FR-LIT-1 | E3-S3 | T |
| SRS-LIT-2 | The Lit screen shall show host line, spot, walking time, access line, nature line, "Find them" and "I'm here". | P0 | FR-LIT-2 | E3-S4 AC1 | T |
| SRS-LIT-3 | Headcount shall follow BR-H-1 to BR-H-5. | P0 | FR-LIT-4 | E2-S5 | T |
| SRS-LIT-4 | Done shall end a Lit gathering (BR-F-5, BR-P-8). | P0 | FR-LIT-5 | E2-S5 AC2 | T |
| SRS-CMP-1 | The compass shall show an arrow and distance to the target and speak "{Host}, {distance}, {direction}." | P0 | FR-CMP-1 | E7-S1 | T |
| SRS-CMP-2 | Speech shall repeat when bearing changes ≥ 30°, distance halves, or 60 s pass. | P0 | FR-CMP-2 | E7-S2 AC1 | T |
| SRS-CMP-3 | A haptic tick shall play when facing within 15° of the target, where the platform supports vibration; where it doesn't, a short tone plays instead. | P0 | FR-CMP-2 | E7-S2 AC2 | T |
| SRS-CMP-4 | Distance error shall be ≤ 10 m at 100 m and bearing error ≤ 20° outdoors in open sky. | P0 | E7-S1 AC1 | E7-S1 | T |
| SRS-CMP-5 | The compass shall show "Finds your friend. Not for navigation or emergencies." | P0 | FR-CMP-4 | E7-S1 | I |
| SRS-CMP-6 | Host live location shall be opt-in, shared only while Lit, only to the chosen set, and deleted at Gone. | P1 | FR-CMP-5 | E7-S3 | T |
| SRS-CMP-7 | The compass shall work with no map tiles and no signal, using the target saved at Lit, and keep speaking with the screen locked where iOS allows audio. | P0 | FR-CMP-3 | E7-S1 AC2 | T |

### 3.10 Functional: access

| ID | Requirement | Pri | Source | Story | V |
| --- | --- | --- | --- | --- | --- |
| SRS-ACC-1 | The needs profile (BR-A-1) shall be stored only on the phone. | P0 | FR-ACC-2 | E6-S1 | T |
| SRS-ACC-2 | The access line shall show counts and nearest distance for benches, restrooms and drinking water within 200 m, and "Steps mapped" or "No steps mapped" (BR-A-2, BR-A-4). | P0 | FR-ACC-1 | E6-S2 | T |
| SRS-ACC-3 | When a spot fails a need, the phone shall offer "Count me in for a closer one?" and send only an "Ember only" flag (BR-A-3). | P0 | FR-ACC-3 | E6-S3 AC1 | T |
| SRS-ACC-4 | No screen, message or API response for others shall differ because of another member's needs. | P0 | FR-ACC-3 | E6-S3 AC3 | T |
| SRS-ACC-5 | The invite photo shall carry the scene text as its accessible name. | P0 | FR-ACC-4 | E6-S4 | T |
| SRS-ACC-6 | Needs checks shall be deterministic rules with no model (FR-AI-3) and run on the phone. | P0 | FR-AI-3, BR-A-2 | E6-S3 | T |

### 3.11 Functional: nature line, Sparks, Hot spots

| ID | Requirement | Pri | Source | Story | V |
| --- | --- | --- | --- | --- | --- |
| SRS-NAT-1 | The nature line shall be built only from sunset time (NOAA algorithm), a named OSM natural feature within 200 m, or the season; never from model output. | P0 | FR-NAT-1 | E3-S4 | T |
| SRS-SPK-1 | Sparks shall follow BR-K-1 to BR-K-4. | P0 | FR-SPK-1 to 3 | E10-S1 | T |
| SRS-SPK-2 | "Your group met here N times." shall follow BR-K-5. | P0 | FR-HOT-3 | E10-S2 | T |
| SRS-HOT-1 | The Hot spots list shall follow BR-K-6, ordered by count then most recent. | P0 | FR-HOT-1, FR-HOT-2 | E10-S3 | T |
| SRS-HOT-2 | The server shall hold the Hot spots blob only as ciphertext and store no place names. | P0 | FR-HOT-2 | E10-S3 AC2 | T |
| SRS-HOT-3 | The Hot spots list shall open only when the person chooses it; the app shall never prompt for it. | P0 | FR-HOT-4 | E10-S3 | I |

### 3.12 Functional: channels

| ID | Requirement | Pri | Source | Story | V |
| --- | --- | --- | --- | --- | --- |
| SRS-CH-1 | The bot shall post only in allow-listed chat ids; at release the list holds only "Flare test" (BR-CH-1). Posting elsewhere shall fail closed and log the refusal without content. | P0 | FR-CH-3 | E4-S1 AC3 | T |
| SRS-CH-2 | The bot post shall show photo, invite, "Need N more" and an "I'm in" button, and edit the count in place within 5 s of a change. | P0 | FR-CH-2 | E4-S1 | T |
| SRS-CH-3 | The bot shall accept conditions by private message and reply with the read-back. | P0 | FR-CH-2 | E4-S2 | T |
| SRS-CH-4 | The bot shall delete all its messages for a gathering at Gone. | P0 | BR-D-3 | E4-S3 AC2 | T |
| SRS-CH-5 | The plain-text form shall be ≤ 200 bytes for every spot name in the Fairlane pack (BR-CH-2, BR-CH-3). | P0 | FR-CH-4 | E2-S4 AC2 | T |
| SRS-CH-6 | The host shall be able to enter a relayed `IN <code>` reply, counted per BR-ID-6. | P1 | FR-CH-4 | E9-S4 | T |
| SRS-CH-7 | Link previews shall follow BR-CH-4. | P0 | FR-CH-5 | E2-S4 AC3 | T |

### 3.13 Functional: AI

| ID | Requirement | Pri | Source | Story | V |
| --- | --- | --- | --- | --- | --- |
| SRS-AI-1 | Photo to invite and scene shall run on the best available tier (BR-AI-1). | P0 hub and rules; P1 phone | FR-AI-1 | E8-S2 | T |
| SRS-AI-2 | Every AI output shall be schema- and length-validated; failures fall to the next tier. | P0 | FR-AI-4 | E8-S2 AC1 | T |
| SRS-AI-3 | On 20 Fairlane test photos (including people in frame), 0 outputs shall describe faces, identity, age, race, gender or bodies (BR-AI-2). | P0 | FR-AI-5 | E8-S2 AC2 | T |
| SRS-AI-4 | The tier that ran shall be recorded per job (BR-AI-3) and shown as "Made on this phone", "Made on our laptop" or "Made from a template". | P0 | FR-AI-6 | E8-S4 | T |
| SRS-AI-5 | Tier choice shall use only runtime capability checks, never device model strings. | P0 | FR-AI-7 | E8-S1 | I |
| SRS-AI-6 | The phone-tier model download shall be opt-in, show its size first, default to Wi-Fi only, and leave the app working on the next tier if it fails. | P1 | FR-AI-8 | E8-S3 | T |
| SRS-AI-7 | Plan ladders, rest-loop requests and map tags shall use the tiers in PRD FR-AI-9 to FR-AI-11. | P0 ladder; P1 others | FR-AI-9 to 11 | E15-S1, E16-S1, E17-S1 | T |

### 3.14 Functional: rest loop (Bench to Bench)

| ID | Requirement | Pri | Source | Story | V |
| --- | --- | --- | --- | --- | --- |
| SRS-REST-1 | A request in plain words shall become duration, rest gap, preferences and avoid-steps, read back for confirmation. | P1 | FR-REST-1 | E16-S1 | T |
| SRS-REST-2 | The loop shall start and end at the spot, use only allowed paths (excluding `access=private` and `access=no`), and never exceed the rest gap between consecutive benches. | P1 | FR-REST-2, R20 | E16-S2 AC1 | T |
| SRS-REST-3 | Walking time at 3 km/h shall be within ±20% of the requested duration. | P1 | FR-REST-3 | E16-S2 AC2 | T |
| SRS-REST-4 | When no loop fits, the app shall show "No loop keeps benches that close. Try {next limit} m?" and no loop. | P1 | FR-REST-4 | E16-S2 AC3 | T |
| SRS-REST-5 | The card shall be a PDF with body text ≥ 18 pt, contrast ≥ 7:1, numbered turns, bench distances, restrooms and water, and the line "Check the path. Map data can be wrong." | P1 | FR-REST-5, R20 | E16-S3 AC1 | T |
| SRS-REST-6 | The same turns shall be available as spoken audio. | P1 | FR-REST-6 | E16-S3 | T |

### 3.15 Functional: Fix the map

| ID | Requirement | Pri | Source | Story | V |
| --- | --- | --- | --- | --- | --- |
| SRS-MAP-1 | The app shall draft OSM tags from a photo using only the allow-list keys. | P1 | FR-MAP-1, FR-MAP-2, BR-AI-4 | E17-S1 | T |
| SRS-MAP-2 | Export shall stay disabled until every tag is reviewed (keep, change, remove). | P1 | FR-MAP-3 | E17-S2 | T |
| SRS-MAP-3 | Export shall produce OSM Note text or an `.osm` file only; the app shall make no request to any openstreetmap.org host. | P1 | FR-MAP-4 | E17-S3 AC1 | T |
| SRS-MAP-4 | The photo shall be deleted after drafting and excluded from the export. | P1 | FR-MAP-5 | E17-S3 AC2 | T |

### 3.16 Functional: capability page and website

| ID | Requirement | Pri | Source | Story | V |
| --- | --- | --- | --- | --- | --- |
| SRS-CAP-1 | `/check` shall report iOS and Safari version, WebGPU and adapter limits, storage estimate, geolocation, device orientation, speech synthesis, web push, recommended tier and a timed test of each, with "Copy report". | P0 | FR-CAP-1 | E8-S1 | D |
| SRS-WEB-1 | The website shall have Home, How it works, Privacy, Accessibility, and Run it yourself pages. | P0 | FR-WEB-1 | E12-S1 | I |
| SRS-WEB-2 | The Privacy page shall state the limits in FR-PRIV-7, R19 and R22, and show the latest deletion audit output. | P0 | FR-PRIV-7 | E12-S1 | I |

### 3.17 Performance

| ID | Requirement | Pri | Source | Story | V |
| --- | --- | --- | --- | --- | --- |
| SRS-PERF-1 | The link page shall be interactive in ≤ 2.0 s (Lighthouse mobile, simulated 4G, iPhone 13 class) and on a real iPhone 13 over cellular. | P0 | NFR-1 | E3-S1 AC1 | T |
| SRS-PERF-2 | Link page JavaScript shall be ≤ 150 KB gzipped, excluding model files. | P0 | NFR-2 | E3-S1 | I |
| SRS-PERF-3 | API p95 latency shall be ≤ 300 ms for yes, take-back and arrival under 20 concurrent clients. | P0 | NFR-1 | E1-S3 | T |
| SRS-PERF-4 | The website shall score ≥ 90 performance and 100 accessibility in Lighthouse mobile. | P0 | E12-S2 | E12-S2 | T |

### 3.18 Offline

| ID | Requirement | Pri | Source | Story | V |
| --- | --- | --- | --- | --- | --- |
| SRS-OFF-1 | At Lit (and after any fade), the phone shall store spot, compass target, access line, host line, nature line and state time. | P0 | FR-OFF-1, FR-LIT-3 | E9-S1 | T |
| SRS-OFF-2 | The Lit screen and compass shall work in airplane mode, showing "Offline. Saved at {time}." | P0 | FR-OFF-5 | E3-S4 AC2 | T |
| SRS-OFF-3 | Offline taps shall queue in the outbox and be sent exactly once on reconnect (BR-H-5). | P0 | FR-OFF-2 | E9-S2 | T |
| SRS-OFF-4 | The app shell shall load offline after first visit (service worker). | P0 | FR-CH-1 | E9-S1 | T |
| SRS-OFF-5 | The Fairlane pack shall be the pinned query result (evidence/README.md) and record its OSM timestamp. | P0 | FR-OFF-4 | E9-S3 | I |
| SRS-OFF-6 | Once downloaded, the phone tier shall run with no network. | P1 | FR-OFF-3 | E8-S3 | T |

### 3.19 Privacy and data retention

| ID | Requirement | Pri | Source | Story | V |
| --- | --- | --- | --- | --- | --- |
| SRS-PRIV-1 | Free-text conditions, needs profiles, rest-loop requests, map photos and capability reports shall never leave the phone. | P0 | FR-PRIV-2 | E5-S3, E6-S1 | T |
| SRS-PRIV-2 | Per-gathering data shall be deleted within 5 min of Gone (BR-D-1) and carry storage expiry (BR-D-2). | P0 | FR-PRIV-5 | E1-S5 | T |
| SRS-PRIV-3 | Surviving data shall be limited to BR-D-4, with retention per BR-D-5. | P0 | FR-PRIV-5 | E1-S5 AC2 | T |
| SRS-PRIV-4 | Logs shall follow BR-D-6. | P0 | R7 | E1-S5 | I |
| SRS-PRIV-5 | The deletion audit shall follow BR-D-7 and print 0 after the field test. | P0 | FR-PRIV-6 | E1-S6 | T |
| SRS-PRIV-6 | KPI data shall be only the counters and buckets in 07-kpis.md; screen seconds leave the phone only as a bucket index. | P0 | KPI 4 | E13-S2 | T |
| SRS-PRIV-7 | No analytics, ads, third-party trackers or fonts loaded from third parties shall be present in the app or link page. | P0 | Privacy promise | E3-S1 | I |
| SRS-PRIV-8 | Who said yes shall be held only for the solver and Lit notices, never returned to any client, and deleted at Gone. | P0 | FR-PRIV-3, BR-Q-5 | E1-S3 AC3 | T |

### 3.20 Security

| ID | Requirement | Pri | Source | Story | V |
| --- | --- | --- | --- | --- | --- |
| SRS-SEC-1 | Secrets (bot token, database credentials, Render key, hub secret) shall exist only in server environment variables, never in the client, repo or logs. | P0 | NFR-5 | all | I |
| SRS-SEC-2 | A secret scan shall run before every push and pass. | P0 | R14 | E14-S3 | T |
| SRS-SEC-3 | Photo encryption shall use an authenticated cipher (AES-256-GCM via WebCrypto) with a random 96-bit nonce per photo. | P0 | FR-PRIV-1 | E1-S1 | I |
| SRS-SEC-4 | The API shall require the gathering id plus a per-member write token for every write; tokens are random 128-bit values stored only on the phone. | P0 | BR-Q-5 | E1-S3 | T |
| SRS-SEC-5 | The API shall rate-limit writes to 30 per minute per member and 300 per minute per gathering. | P0 | Abuse | E1-S3 | T |
| SRS-SEC-6 | The app shall send a Content-Security-Policy that blocks third-party scripts and inline script execution. | P0 | SRS-PRIV-7 | E3-S1 | T |
| SRS-SEC-7 | The agent session embed shall be scrubbed of keys and personal data before it is made public. | P1 | R14 | E14-S3 | I |

### 3.21 Accessibility

| ID | Requirement | Pri | Source | Story | V |
| --- | --- | --- | --- | --- | --- |
| SRS-A11Y-1 | Every screen shall meet WCAG 2.2 AA. | P0 | NFR-3 | E6-S5 | T |
| SRS-A11Y-2 | axe-core shall report 0 serious or critical issues on every screen. | P0 | E6-S5 AC2 | E6-S5 | T |
| SRS-A11Y-3 | Journey J3 (low vision) shall complete with VoiceOver on a real iPhone, recorded. | P0 | E6-S5 AC1 | E6-S5 | D |
| SRS-A11Y-4 | Text shall reflow at the largest Dynamic Type size with no clipped controls. | P0 | FR-ACC-5 | E6-S5 | T |
| SRS-A11Y-5 | Motion shall respect Reduce Motion; sound shall respect the silent switch where the platform exposes it; colour shall never be the only signal. | P0 | NFR-7, FR-ACC-5 | E11-S2 | T |
| SRS-A11Y-6 | Touch targets shall be ≥ 44 × 44 pt. | P0 | WCAG 2.5.8 (AA 24 px; we use Apple's 44 pt) | E11-S1 | I |

### 3.22 Compatibility

| ID | Requirement | Pri | Source | Story | V |
| --- | --- | --- | --- | --- | --- |
| SRS-COMP-1 | All P0 flows shall work in Safari on all four test phones (iPhone 13, 16 Pro Max, 17 Pro, 17 Pro Max) on the iOS version each runs on Sunday. | P0 | Founder | E13-S1 | D |
| SRS-COMP-2 | Features shall be enabled by capability detection; a missing capability shall degrade to the next option, never block a P0 flow. | P0 | Founder Q4 | E8-S1 | T |
| SRS-COMP-3 | The link page shall work inside the Telegram in-app browser and when opened from iMessage and WhatsApp. | P0 | FR-CH-1 | E3-S1 | D |
| SRS-COMP-4 | The website shall work in current Safari, Chrome and Firefox on desktop and mobile. | P0 | FR-WEB-2 | E12-S2 | T |

### 3.23 Reliability

| ID | Requirement | Pri | Source | Story | V |
| --- | --- | --- | --- | --- | --- |
| SRS-REL-1 | Gathering state shall survive a server restart with no lost yes, fade or arrival. | P0 | NFR-4 | E1-S2 AC4 | T |
| SRS-REL-2 | Duplicate requests with the same idempotency key shall have no additional effect. | P0 | NFR-4 | E1-S3 AC1 | T |

### 3.24 Usability and copy

| ID | Requirement | Pri | Source | Story | V |
| --- | --- | --- | --- | --- | --- |
| SRS-COPY-1 | Button labels shall be ≤ 3 words; messages ≤ 12 words. | P0 | NFR-8 | E11-S1 | I |
| SRS-COPY-2 | No UI string or doc shall contain a word from the banned list in docs/product/01-brd.md section 6. | P0 | Writing rules | all | I |

### 3.25 Maintainability and licensing

| ID | Requirement | Pri | Source | Story | V |
| --- | --- | --- | --- | --- | --- |
| SRS-MNT-1 | Source shall be released under the license the architect confirms (AGPL-3.0 recommended), with a LICENSE file and third-party notices. | P0 | NFR-6 | E12-S1 | I |
| SRS-MNT-2 | Commits after the DEV deadline shall be listed in the README. | P0 | DEV rules | E14-S1 | I |
| SRS-MNT-3 | "Run it yourself" shall let a developer start the server, bot and hub from a clean machine with documented commands. | P0 | FR-WEB-1 | E12-S1 | D |

### 3.26 Field test and post

| ID | Requirement | Pri | Source | Story | V |
| --- | --- | --- | --- | --- | --- |
| SRS-FLD-1 | A KPI export shall print the table in 07-kpis.md for a given time window. | P0 | E13-S2 | E13-S2 | T |
| SRS-FLD-2 | A consent checklist shall record, per person, yes or no for first name, face and voice. | P0 | Founder Q3 | E13-S3 | I |
| SRS-FLD-3 | A real Plan shall be sent Sunday morning after the RC deploy, with D before 11 AM ET. | P0 | CR-1 | E15-S5 | D |
| SRS-FLD-4 | The DEV post shall follow the template, include the KPI table, tier table, deletion audit output and "what broke", and be published by the founder before Mon 06:59 UTC. | P1 | BRD 5 | E14-S1 | I |
| SRS-FLD-5 | The demo video shall show no face or voice of anyone who hasn't consented on the day. | P1 | Founder Q3 | E14-S2 | I |

## 4. Verification

Every requirement above names its method. QA owns the test plan and fills the Test and Proof columns of 05-rtm.csv. A requirement is closed only with proof (test output, screenshot, video or audit printout) linked in the matrix.

## 5. Open issues

None blocking. Decisions taken by the analyst where the PRD was open are marked **[Analyst decision]** in 03-business-rules.md and listed in the design handoff for review.
