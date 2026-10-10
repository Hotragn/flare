# Flare: Glossary, founder questions and product decisions

## Glossary

| Term | Meaning |
| --- | --- |
| Flare | One invite to meet now at one spot, started from a photo |
| Plan | A planned ask with an answer deadline, a 4-step ladder and the same private yes |
| Ladder | The 4 steps of a Plan, biggest first |
| I'm fading | A private tap that moves a Lit Plan down one step |
| Hot spots | The group's list of places it met, with counts and latest Spark, encrypted |
| Bench to Bench | A walking loop that keeps rests within a person's limit, with a large-print card |
| Fix the map | Draft OSM tags from a photo, reviewed by a person, exported only |
| Group | Friends sharing a link or a Telegram chat; no accounts |
| Group key | Encryption key in the link fragment; never reaches the server |
| Host | The person who sent the Flare |
| Host line | "{Host} is waiting at {spot}." |
| Quorum | Number of yeses (host included) needed to light; default 2 |
| Kindling | Invite out, counting yeses privately |
| Lit | Enough yeses; it's on; stays lit |
| Ember | Shrunk plan after 30 min unlit: 15 min at the nearest suitable bench, quorum 2 |
| Gone | Ended and deleted |
| Spark | One line, in a person's own words, left after a Flare; opt-in, encrypted |
| Condition | A yes with a rule: with a person, after a time, back by a time, max walk |
| Solver | Server logic picking the largest group whose conditions all hold |
| Access line | Benches, restrooms, water and mapped steps near the spot |
| Needs profile | A person's access needs, stored only on their phone |
| Spoken scene | 20-word description of the invite photo for screen readers |
| Talking compass | Arrow, distance and speech pointing to the host's spot |
| Nature line | One real fact about the place (sunset, named feature, season) |
| Tier | Where an AI job ran: phone, hub, or rules |
| Hub | Our laptop running Gemma 4 E4B via Ollama |
| Headcount | Host + arrivals for a Lit Flare; the north-star metric |
| Screen seconds | Visible UI time per person per Flare, bucketed on the phone |
| Outbox | Queue of taps made offline, sent once when signal returns |
| Fairlane pack | Bundled OSM data within 3 km of Fairlane Town Center |
| RC | Release candidate, due Sun 10:00 AM ET |

## Founder questions, answered

| # | Question | Answer (source) |
| --- | --- | --- |
| Q1 | When and where is the field test? | Sun 11 AM to 3 PM ET, public spot near Fairlane Town Center, exact point confirmed Sunday morning. RC by about 10 AM. (Founder, Oct 10) |
| Q2 | Approvals for deploy and bot? | Ask for each when ready, prepared as one step. Until then the bot posts only in the private "Flare test" group. (Founder) |
| Q3 | Who publishes; credits; names and faces? | Founder's DEV account. Handles and consent collected Sunday morning. Until then first names only; no faces or voices unless each person says yes on the day. (Founder) |
| Q4 | iOS versions? | Unknown. Detect capabilities at runtime; `/check` reports versions Sunday morning. Never choose tiers by phone model. (Founder) |
| Q5 | Read the other brainstorm files? | No. FLARE-SPEC v2 replaces them. Money, prizes and Wikimedia are out of scope. (Founder) |
| Q6 | Storage: Postgres or Atlas? | Architect decides on the merits, including MongoDB's SSPL "not approved by the OSI" fact. "Open storage is rare" is dropped as a claim. (Founder) |
| Q7 | Framing for on-device AI? | "Proof it runs on our real iPhones." (Founder) |
| Q8 | Entire category? | Honest fit if we embed the agent session; don't chase. (Founder) |

## Product decisions (this role)

| # | Decision | Reason |
| --- | --- | --- |
| D1 | ~~Flare mode only~~ **Superseded by CR-1:** Plan mode is P0 | Founder clarified "Plan (later)" means planning for a later time |
| D2 | Kindling 30 min, Ember 30 min, Lit until Done or t0 + 4 h | Matches the brief's 60-minute window with Ember at 30 |
| D3 | Ember quorum is 2 (host plus 1) at the nearest suitable bench within 400 m | Brief: "one friend is enough"; benches are what people with limited mobility need (Netspar: 60% to 75%) |
| D4 | Conditions: four types only (`with`, `after`, `back_by`, `max_walk`) | Covers the brief's examples; small enough to parse reliably and test |
| D5 | Rules and hub condition parsers are P0; phone parser P1 (CR-1) | Hub tier is P0, so its parser is too |
| D6 | Phone-tier AI is P1, shipped in the RC only if it runs reliably by 10 AM | R1 and R2; honesty over a demo that crashes |
| D7 | **Superseded by CR-1:** Hot spots P0; rest loop P1; Fix the map P1 as draft and export only | The card removes screen time on the walk; test day creates history; publishing still needs a yes |
| D8 | Sparks are P0 (CR-1), one line, once, never reminded | Low screen time; test day gives real history |
| D9 | No "No" button, ever; no per-yes timestamps shown | Protects the private no |
| D10 | Screen seconds excludes compass time and is sent only as a bucket | Compass is for being outside; buckets avoid personal timing data |
| D11 | The access line says "No steps mapped", never "step-free" | OSM can be incomplete; don't promise what we can't know |
| D12 | Compass copy: "Finds your friend. Not for navigation or emergencies." | Brief: not a mobility aid or SOS device |
| D13 | Brief's "45% have lied about why" figure is not used | Not found on the cited IPA page (Oct 10 fetch) |
| D14 | Axios (ATUS) and CDC figures are cited only after re-verification | Both returned 403 to our fetch |
| D15 | Prize categories listed only where used genuinely, one line each; target Overall | Weekend data: one win per entry; Render and Gemma crowded |
| D16 | License AGPL-3.0 recommended (architect confirms) | Keeps the deletion promise checkable on modified servers |
| D17 | Plans light only at the deadline (or early if every invitee said yes unconditionally) | Late yeses can still raise the step |
| D18 | Fading: one step per fade, once per person, until halfway through the step | Lets a tired person shrink the plan without explaining; caps abuse |
| D19 | "Met here N times" shows from N = 1 | So the test day's second meetup already shows history |
| D20 | Phone tier stays P1 and targets whichever lab candidate passes (MediaPipe E2B or a vision model under 600 MB) | Lab reports E2B ONNX blocked by iPhone Safari memory |

## Change log

- **CR-1 (Oct 10, founder):** Plan mode P0; Sparks and Hot spots P0; rest loop P1; Fix the map P1 (draft and review only); hub-tier condition parsing P0; phone tier P1 targeting the lab's passing candidate.
