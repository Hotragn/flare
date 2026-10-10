# Flare: Business rules catalog

Version 1.0, Sat 2026-10-10. Owner: Analyst. Source: PRD v1.1 (docs/product/03-prd.md). Each rule is atomic, has one ID, and is referenced by SRS requirements and tests. Where the PRD left something open, the rule records the decision and marks it **[Analyst decision]**.

Notation: `t0` = Flare send time (server). `D` = Plan answer deadline. `S` = Plan start time. All times are server UTC; phones display them in the group time zone (BR-TIME-2).

## 1. Identity and membership

| ID | Rule |
| --- | --- |
| BR-ID-1 | A group is identified by a random 128-bit group id. It is not derived from any personal data. |
| BR-ID-2 | Each person in a group is a member with a random 128-bit member id, created on their phone the first time they open the group's link (or by the bot for a Telegram user). |
| BR-ID-3 | Display names are chosen by the member and stored only encrypted with the group key. The server never holds a readable name. **[Analyst decision]** |
| BR-ID-4 | A member id is per group. The same person in two groups has two unrelated ids. |
| BR-ID-5 | For Telegram members, the bot keeps a map from Telegram user id to member id for that group. The map is deleted when the member leaves the group or the group is inactive for 30 days. |
| BR-ID-6 | A plain-text reply (`IN <code>`) relayed by a member counts as an anonymous yes with no member id and no conditions. At most 3 anonymous yeses per gathering. **[Analyst decision]** |

## 2. Quorum

| ID | Rule |
| --- | --- |
| BR-Q-1 | Yes-count always includes the host as 1. |
| BR-Q-2 | Flare quorum is 2, 3 or 4; default 2. Plan quorum is 2 to 6; default 3. |
| BR-Q-3 | A gathering lights when the solver's chosen set (BR-S-1) has at least quorum members. |
| BR-Q-4 | "Need N more" = max(0, quorum − size of the solver's current best set). For a Plan, it is computed at the highest step that could still light. |
| BR-Q-5 | No interface or API shows who is in the set, who answered, or when anyone answered. Only N. |
| BR-Q-6 | "Ember only" yeses (BR-A-3) are excluded from Kindling counts and included at Ember. |

## 3. Conditions

| ID | Rule |
| --- | --- |
| BR-C-1 | Condition types: `with(member_id)`, `after(time)`, `back_by(time)`, `max_walk(minutes)`, `max_step(n)` (Plans only). |
| BR-C-2 | A yes may carry 0 to 4 conditions. All must hold (logical AND). |
| BR-C-3 | `with(X)` holds when X is in the same chosen set. Names are resolved to member ids on the phone, where names can be decrypted. |
| BR-C-4 | `with(X)` naming nobody in the group cannot be saved. The phone says "Amor isn't in this group." |
| BR-C-5 | `after(T)` holds when the gathering's start is at or after T. For a Flare, the start is the Lit time. |
| BR-C-6 | `back_by(T)` holds when start + duration ≤ T. Flare duration is taken as 60 minutes for this check. Plan duration is the chosen step's minutes. **[Analyst decision]** |
| BR-C-7 | `max_walk(M)` holds when the person's walking time to the spot at 4.8 km/h straight-line distance × 1.3 is ≤ M. The phone evaluates it and reports pass or fail per spot id. **[Analyst decision]** |
| BR-C-8 | `max_step(n)` holds when the chosen step number ≥ n (step 4 is smallest). |
| BR-C-9 | Free text never leaves the phone. Only the structured rule is sent. |
| BR-C-10 | A condition is saved only after the person confirms the read-back. |

## 4. Solver

| ID | Rule |
| --- | --- |
| BR-S-1 | The solver picks the set of yeses (and the step, for Plans) that maximizes, in order: (1) number of people, (2) higher step (smaller step number), (3) earlier start. |
| BR-S-2 | A yes with no conditions fits every set. |
| BR-S-3 | `with` dependencies are resolved as a fixed point: repeatedly remove members whose `with` targets are not in the set until nothing changes. |
| BR-S-4 | Group sizes are at most 12 in this release, so the solver may search exhaustively. Groups larger than 12 are rejected at creation. **[Analyst decision]** |
| BR-S-5 | The solver runs on every yes, take-back, condition change, fade and timer event. It is deterministic: the same inputs give the same output. |
| BR-S-6 | Ties after all three criteria are broken by the lowest member ids (stable, not by answer time). **[Analyst decision]** |

## 5. Flare timeline

| ID | Rule |
| --- | --- |
| BR-F-1 | Kindling lasts until t0 + 30:00. |
| BR-F-2 | An event received by the server at or before t0 + 30:00.000 belongs to Kindling. If it completes quorum, the Flare is Lit, even if the Ember timer is already queued. |
| BR-F-3 | At t0 + 30:00, if not Lit, the Flare enters Ember with quorum 2 at the Ember spot (BR-E). |
| BR-F-4 | Ember lasts until t0 + 60:00. If not Lit by then, Gone with "Not this time". |
| BR-F-5 | Lit lasts until the host taps Done or t0 + 4:00:00, whichever comes first. |
| BR-F-6 | The host may cancel only during Kindling or Ember. Cancel ends in "Not this time". |
| BR-F-7 | Lit is permanent for the gathering (no return to Kindling). |
| BR-F-8 | Timer transitions fire within 30 seconds of their scheduled time, including after a server restart. |

## 6. Ember

| ID | Rule |
| --- | --- |
| BR-E-1 | Ember spot = the nearest `amenity=bench` or `leisure=picnic_table` by straight-line distance within 400 m of the original spot that passes the needs check of every yes and every "Ember only" yes. |
| BR-E-2 | If no bench qualifies, the Ember spot is the original spot. |
| BR-E-3 | Needs checks for candidate benches run on each phone; each phone reports pass or fail per candidate bench id. The server picks the nearest bench that passed for all. |
| BR-E-4 | Phones that haven't reported within 60 s of Ember start are treated as pass for all candidates. **[Analyst decision]** |
| BR-E-5 | Ember duration on screen is "15 min". Ember quorum is 2. |
| BR-E-6 | A Flare lit during Ember counts as an Ember save. |

## 7. Plan timeline and downshifting

| ID | Rule |
| --- | --- |
| BR-P-1 | D ≥ creation + 10 min, D ≤ S − 10 min, and S ≤ creation + 36 h, so every bot post can still be deleted inside Telegram's 48 h limit. **[Analyst decision]** |
| BR-P-2 | A Plan lights only at D, except: if every member of the group has said yes with no conditions before D, it lights at once at step 1. |
| BR-P-3 | At D, the solver picks step and set (BR-S-1). If no step reaches quorum but at least 2 people (host included) fit step 4, it lights at step 4 and counts as an Ember save. Otherwise Gone. |
| BR-P-4 | A ladder has exactly 4 steps, numbered 1 (biggest) to 4 (smallest). Durations are strictly decreasing. |
| BR-P-5 | Any member of the chosen set may fade once per Plan, from Lit until S + 50% of the current step's minutes. |
| BR-P-6 | Each fade lowers the step by 1, never below 4. The set is re-solved at the new step; members who now fit are added, nobody is removed. **[Analyst decision]** |
| BR-P-7 | The displayed change is "Smaller plan: {step name}." No count of fades, no names. |
| BR-P-8 | A Lit Plan becomes Gone at Done or at S + step minutes + 60 min. |
| BR-P-9 | Steps ending after sunset show "Ends after sunset" unless the host turned the check off. |

## 8. Arrival and host +1

| ID | Rule |
| --- | --- |
| BR-H-1 | Headcount = 1 (host) + arrivals. |
| BR-H-2 | An arrival is recorded by the person tapping "I'm here" or by the host tapping +1. |
| BR-H-3 | A member's own "I'm here" and a host +1 for the same member count once only if the host +1 is attached to that member; anonymous +1s are separate. The host's +1 list shows names (decrypted on the host's phone) and an "Someone else" entry. **[Analyst decision]** |
| BR-H-4 | Headcount ≤ yes-count + 3 (yes-count includes the host). Taps beyond the cap are ignored. |
| BR-H-5 | Arrivals are accepted only while Lit. Offline arrivals from the outbox are accepted if their recorded time is within the Lit window. |

## 9. Expiry and deletion

| ID | Rule |
| --- | --- |
| BR-D-1 | At Gone, the server deletes within 5 minutes: the gathering record, yes records, rules, fades, arrivals, photo ciphertext, live locations, bot message references, and solver state. |
| BR-D-2 | Every per-gathering record also carries a storage-level expiry at t0 + 5 h (Flare) or S + 24 h (Plan), so deletion happens even if the delete job fails. |
| BR-D-3 | The bot deletes every message it posted for the gathering at Gone. |
| BR-D-4 | Survivors after Gone: group counters (docs/product/07-kpis.md), the encrypted Hot spots blob, opt-in encrypted Sparks, member ids, push subscriptions, and the Telegram map. |
| BR-D-5 | Push subscriptions and Telegram maps are deleted after 30 days without a gathering in the group. Sparks and the Hot spots blob are deleted after 180 days without a gathering, or at once when any member taps "Forget this group". **[Analyst decision]** |
| BR-D-6 | Logs never contain request bodies, photos, names, locations, conditions, or link fragments. Logs are kept 7 days. |
| BR-D-7 | The deletion audit counts remaining per-gathering records in every store listed in the data dictionary, by gathering id and in total. Passing = 0. |

## 10. Sparks and Hot spots

| ID | Rule |
| --- | --- |
| BR-K-1 | Only members with an accepted arrival may leave a Spark for that gathering. One Spark per member per gathering. |
| BR-K-2 | A Spark is 1 to 140 characters, written by the person. No AI generation or editing is offered. |
| BR-K-3 | The Spark prompt appears once, after Done, and can be dismissed. No reminders. |
| BR-K-4 | A Spark is encrypted with the group key before leaving the phone and is tied to the place key: the OSM element id of the spot, or the place name if no id. |
| BR-K-5 | "Your group met here N times." shows when N ≥ 1, where N counts Lit gatherings at that place key. It shows the newest Spark at that place, if any. |
| BR-K-6 | The Hot spots blob is one encrypted record per group: a list of {place key, place name, count, last date, newest Spark id}. The host's phone updates it at Gone. Conflicts merge by taking the max count per place. |

## 11. Access and needs

| ID | Rule |
| --- | --- |
| BR-A-1 | Needs profile fields: avoid steps (yes or no), max distance between rests (100, 200, 400 m or none), restroom within 300 m (yes or no). Stored only on the phone. |
| BR-A-2 | A spot fails "avoid steps" when any `highway=steps` lies within 20 m of the straight line from the person to the spot or within 50 m of the spot. A spot fails "restroom" when no `amenity=toilets` is within 300 m. A spot fails "rest distance" when the nearest bench is farther than the limit. |
| BR-A-3 | A person whose needs fail may choose "Count me in for a closer one". Their yes is flagged "Ember only" and carries no reason. |
| BR-A-4 | Access line copy never says "step-free". It says "No steps mapped" or "Steps mapped". |

## 12. Time

| ID | Rule |
| --- | --- |
| BR-TIME-1 | The server clock (UTC, NTP-synced) decides every transition. Phone clocks are never trusted for transitions. |
| BR-TIME-2 | The group time zone is the host phone's time zone at creation. Times in conditions are interpreted in it. |
| BR-TIME-3 | Phones show the server time remaining and the time the state was last confirmed. |

## 13. Channels

| ID | Rule |
| --- | --- |
| BR-CH-1 | The bot posts only in allow-listed chat ids. At release the list has one entry: "Flare test". |
| BR-CH-2 | The plain-text form is ≤ 200 bytes UTF-8. If the spot name would exceed it, the name is truncated with "…". |
| BR-CH-3 | Short codes use 5 characters from `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (no 0, 1, I, L, O). Codes are unique among live gatherings. |
| BR-CH-4 | Link previews show a blurred photo and the invite line only; never coordinates or the spot name below street level. **[Analyst decision]** |

## 14. AI

| ID | Rule |
| --- | --- |
| BR-AI-1 | Tier order is phone, then hub, then rules. A tier is skipped if unavailable, times out (phone 8 s, hub 6 s), or returns output that fails validation. |
| BR-AI-2 | Output never describes faces, identity, age, race, gender or bodies. A filter replaces any person words with "a person" or "people", or drops the sentence. |
| BR-AI-3 | Every AI run records job and tier as a counter. No inputs or outputs are stored server-side. |
| BR-AI-4 | Fix the map drafts use only the tag key allow-list in PRD FR-MAP-2 / backlog E17-S1. |
