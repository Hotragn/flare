# Handoff 02: Analyst to Design

From: Business and systems analyst. Date: Sat 2026-10-10. Next role: Brand and UX design.

## What was delivered (docs/requirements/)

| File | Contents |
| --- | --- |
| 01-srs.md | SRS in ISO/IEC/IEEE 29148 layout: 159 numbered "shall" requirements (140 P0, 19 P1), each with priority, source, story and verification method. Covers functional, performance, offline, privacy and retention, security, accessibility, compatibility with our four iPhones, reliability, copy, licensing, field test |
| 02-use-cases.md | Use-case diagram (Mermaid) and 16 use cases with main, alternate and failure paths |
| 03-business-rules.md | 84 atomic rules in 14 groups: identity, quorum, conditions, solver, Flare timeline, Ember, Plan and downshifting, arrival and host +1, expiry and deletion, Sparks and Hot spots, access, time, channels, AI |
| 04-data-flow-and-dictionary.md | Level 0 and level 1 data flow diagrams (Mermaid), 13 process descriptions, data dictionary for 12 server stores and 10 phone stores, deletion audit coverage |
| 05-rtm.csv, 05-rtm.md | Traceability matrix: requirement ↔ PRD source ↔ business rules ↔ stories ↔ acceptance criteria, with empty design, code, test and proof columns |
| tools/trace.py | Generates the matrix and checks every link both ways |
| fixtures/conditions-60.json | 40 core and 20 hard condition phrases with expected rules, for SRS-COND-2 to 4 |
| evidence/ | Pinned Overpass query and result; verified source table |

Also updated: docs/product/01-brd.md evidence rows (small fix to an earlier phase, logged here); docs/BUGLOG.md BUG-004 (Overpass busy and stale mirrors) and BUG-005 (BLS and CDC block scripts).

## Proof

- Traceability check passes: 159 requirements; 84 of 84 rules, 105 of 105 PRD requirements, 61 of 61 stories traced. First run found 33 gaps; all closed (see 05-rtm.md).
- All 3 Mermaid diagrams parse and render with Mermaid 11.4.1 (checked in a browser on localhost: "d0: ok, d1: ok, d2: ok").
- Banned-word and em-dash scan over docs/product, docs/requirements and docs/handoffs: 0 hits.
- Evidence:
  - Fairlane (pinned, OSM 2026-10-10 17:07 UTC, 3 km around way 168151050): 54 benches, 7 picnic tables, 7 restrooms, 3 drinking fountains, 32 parks, 28 steps.
  - CDC DHDS 2022: mobility 12.2%, vision 5.5% (verified from data.cdc.gov).
  - BLS ATUS 2025: 30% socialized on an average day vs 38% in 2015 (verified).
  - The Axios "ages 15 to 24, 61 to 35 min" figure is **unverified**: not in the primary release, do not cite.

## Decisions the analyst took (marked [Analyst decision] in 03-business-rules.md)

1. Display names exist on the server only as ciphertext; conditions name people by member id, resolved on the phone (BR-ID-3, BR-C-3).
2. Anonymous text yeses: max 3, no conditions (BR-ID-6).
3. `back_by` treats a Flare as 60 minutes; `max_walk` uses straight-line distance × 1.3 at 4.8 km/h (BR-C-6, BR-C-7).
4. Groups max 12 people; solver ties broken by lowest member id (BR-S-4, BR-S-6).
5. Ember: phones that don't report within 60 s count as pass (BR-E-4).
6. Fades add people who now fit and never remove anyone; fading at step 4 does nothing and shows nothing (BR-P-6, UC-07 A1).
7. Plans must start within 36 h so the bot can always delete its posts inside Telegram's 48 h limit (BR-P-1).
8. Retention after Gone: push subscriptions and Telegram maps 30 days idle; Sparks and Hot spots 180 days idle or "Forget this group" (BR-D-5).
9. Link previews: blurred photo and invite line only (BR-CH-4).
10. Spot coordinates are held on the server until Gone (for the Ember search and compass). The privacy page must say so.

## What design must produce from this

- **Screens for every P0 and P1 SRS requirement** that has a UI: create (camera, draft, quorum chip), link page, conditions read-back, Lit screen, compass, Ember notice, Plan create and ladder edit, Plan answer, fade, arrival and +1, Done, Spark prompt, Hot spots, needs profile, access line, "Count me in for a closer one", offline state, `/check`, rest-loop request and card, map draft review, website pages.
- **Copy deck** for every string, within the limits (buttons ≤ 3 words, messages ≤ 12). Fixed strings already set by requirements must be used as written, for example "Not this time.", "You're in.", "It's lit. {Host} is at {spot}.", "Smaller plan: 15 min at {bench}.", "This link is missing its key.", "Finds your friend. Not for navigation or emergencies.", "Check the path. Map data can be wrong." If a fixed string doesn't work in design, raise a change request; don't change it silently.
- **Motion and sound specs** for Kindling, Lit, Ember, fade and Gone, with Reduce Motion and silent alternatives (SRS-A11Y-5).
- **Accessibility annotations:** accessible names, VoiceOver order, Dynamic Type at the largest size, 44 pt targets (SRS-A11Y-1 to 6).
- **The large-print card** layout: 18 pt or larger body text, 7:1 contrast (SRS-REST-5).
- Fill the **design** column in 05-rtm.csv with screen or spec ids, then run `python3 docs/requirements/tools/trace.py`.

## Things to keep in mind

- Screen-second targets are requirements, not wishes: host ≤ 15 s to send, invitee ≤ 10 s to "I'm in" (SRS-CRE-9, SRS-RES-7). Design for one primary action per screen.
- No screen may reveal who said yes, who faded, or why someone's yes moved to Ember (SRS-RES-4, SRS-ACC-4, BR-P-7).
- No No button, no streaks, no badges, no feed (SRS-RES-5; docs/product/06-scope.md Out).
- The phone may be on any of four iPhones and any iOS version; design must degrade gracefully when a capability is missing (SRS-COMP-2).
- lab/ belongs to the spike session. Don't edit or commit it.

## Change requests

None against earlier phases. Small fix applied: BRD evidence rows now use the verified figures.
