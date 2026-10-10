# Handoff 01: Product to Analyst

From: Product manager. Date: Sat 2026-10-10. Next role: Analyst.

## What was delivered

| File | Contents |
| --- | --- |
| docs/research/00-challenge-and-field.md | Challenge rules, template, 813-entry field scan, top entries, Weekend winners, checks on the founder brief |
| docs/product/01-brd.md | Problem, users, evidence table with verification status, goals, success metrics, constraints |
| docs/product/02-market-analysis.md | Crowded vs missing, closest competitors, what wins, where Flare wins, prize stance |
| docs/product/03-prd.md | Vision, state machine, numbered requirements (FR-, NFR-) |
| docs/product/04-personas-journeys.md | 5 personas, 6 journeys with screen-second targets and done-when checks |
| docs/product/05-backlog.md | 14 epics, stories with acceptance criteria, P0/P1/P2 |
| docs/product/06-scope.md | In (P0, P1), Out, Later, with reasons |
| docs/product/07-kpis.md | Counters stored, KPI formulas, what we never measure |
| docs/product/08-release-plan.md | Milestones M0 to M13, gates, founder approvals list |
| docs/product/09-risks.md | 17 risks with mitigations and triggers |
| docs/product/10-glossary-and-decisions.md | Glossary, founder Q&A, 16 product decisions |
| docs/BUGLOG.md | BUG-001 to BUG-003 (research tooling) |

## Key decisions and why

1. **Headcount is the north star.** It's the one number that means people were together. Everything else serves it.
2. **Flare mode only; Plan mode Later.** Founder marked Plan as later and Sunday tests "now" Flares. The engine must stay ladder-ready (a Flare holds a list of spots, not one).
3. **Timers: Kindling 30 min, Ember 30 min, Lit until Done or t0 + 4 h.** Ember quorum 2 at the nearest suitable bench within 400 m.
4. **Every AI job has three tiers (phone, hub, rules), chosen at runtime.** Rules and hub are P0; phone is P1 and enters the RC only if it's reliable by 10 AM Sunday. The tier that ran is always recorded.
5. **Privacy is built into the data model, not the copy.** Free text and needs stay on the phone; photos are encrypted with a key in the URL fragment; everything per-Flare is deleted within 5 minutes of Gone; only group counters remain.
6. **Accessibility is P0,** because two of five personas depend on it and it's one of the four things no other entry does.
7. **Evidence:** two founder figures are not usable as-is. The IPA page doesn't contain "45% have lied about why". Axios and CDC returned 403, so they need re-verification before the post cites them.

## What the analyst must do next

1. **Traceability matrix:** every FR and NFR in 03-prd.md maps to at least one story in 05-backlog.md and at least one test. Flag any requirement without a story, and any story without a requirement.
2. **Data model and store inventory:** list every piece of data (field, where it lives, who can read it, when it's deleted). This is the input for the deletion audit (E1-S6) and risk R7.
3. **Edge cases for the state machine and solver:** for example, quorum reached at exactly t0 + 30:00, a take-back at the same moment as Lit, host offline when Lit fires, every yes "Ember only", a `with` rule naming someone not in the group, clock skew between phones.
4. **Copy inventory:** list every UI string the stories imply, with the word-count limits (buttons 3, messages 12), for the design role.
5. **Verify or replace the two unverified sources** (Axios ATUS, CDC) with the primary tables.
6. **Re-run the Fairlane Overpass query** with a defined centre and tag set, so BRD, the offline pack and the post use the same numbers. Our query: centre 42.3233, -83.2105, radius 3 km, `amenity=bench` nodes, `leisure=picnic_table` nodes, `amenity=toilets`, `amenity=drinking_water`, `leisure=park` ways: 48, 9, 6, 1, 22.

## Things the next roles must know

- **Approvals:** every deploy, public repo, post, upload or message to people needs the founder's yes, one at a time, prepared as one step. The bot may post only in the private "Flare test" group until approved.
- **People:** first names only (Fuego, Amor, Shilp, Ammo). No faces or voices unless each says yes on Sunday.
- **Phones:** never pick behaviour by phone model. `/check` (FR-CAP-1) runs on all four phones Sunday morning.
- **lab/** is a separate spike session. Don't edit or commit it. The engineering lead reviews its reports.
- **Storage choice** is the architect's, with MongoDB's own FAQ fact that the SSPL "has not been approved by the OSI" recorded either way.
- **Writing rules** apply to every string and doc. Banned-word scan passed on docs/ at this commit.

## Change requests

None against earlier phases. The research doc was corrected in this phase (813 entries, cleaned text extraction); details in BUGLOG.

## Change request CR-1 (approved by the founder, Oct 10)

I misread "Plan (later)" in the brief as "build later". It means planning for a later time. Changes, version 1.1:

| Change | Docs updated |
| --- | --- |
| Plan mode is P0: deadline, 4-step ladder, `max_step` conditions, solver at the deadline, "I'm fading" (FR-PLAN-1 to 15, E15). Used for real Sunday morning: "Fairlane walk at 11?" with a deadline before 11 (M7b). | PRD section 11, backlog E15, scope, release plan, KPIs |
| Sparks and Hot spots are P0; "met here N times" shows from N = 1 (FR-HOT-1 to 4, E10) | PRD section 12, backlog E10, scope |
| Bench to Bench rest loop with a large-print card is P1 (FR-REST-1 to 6, E16) | PRD section 13, backlog E16 |
| Fix the map is P1, draft and review only, exported as OSM Note text or a file; publishing waits for the founder (FR-MAP-1 to 5, E17) | PRD section 14, backlog E17 |
| Hub-tier condition parsing is P0 (E5-S2) | Backlog E5 |
| Phone tier stays P1 and targets whichever lab candidate passes (MediaPipe E2B, or a vision model under 600 MB); the lab reports E2B ONNX looks blocked by iPhone Safari memory | Risks R1, decision D20 |

New risks R18 to R22; decisions D17 to D20; KPI counters for Plans, fades, Sparks, rest loops and map drafts.
