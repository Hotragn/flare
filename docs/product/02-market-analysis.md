# Flare: Market and competitive analysis

Source data: docs/research/00-challenge-and-field.md (813 Week 1 entries read through DevRelay and DEV's pages, plus all 17 Weekend winners). Snapshot Sat 2026-10-10, 16:46 UTC. Counts are keyword matches; small counts were checked by hand.

## 1. The market we compete in

There are two markets this weekend.

1. **The judges' attention.** 813 entries and counting, one Overall prize. Judges weight Writing Quality most. The Weekend Overall winner had 27 reactions; reactions only break ties.
2. **The friend group's attention.** Flare competes with the group chat itself: "anyone around?" in iMessage, a Telegram poll, or nothing. These cost nothing and fail in the ways listed in the BRD.

## 2. What's crowded

| Pattern | Share of 813 | Why it hurts to be here |
| --- | --- | --- |
| Gemma via Ollama on a laptop | 51% mention Gemma, 50% use Ollama | The model is not a differentiator |
| Walk, trail or route planner | 23% of titles | Many near-identical names (TrailMate, TrailQuest, GrassQuest) |
| "AI that wants you to stop using it" | 22% of titles | The framing is now a cliché |
| Quest, scavenger hunt, game | 16% of titles | Often single-player with photo proof |
| Photo proof checked by a model | 6% | Also on our out-of-scope list |
| Gemma prize category | 31% name it | Lowest odds per entry |
| Render prize category | 17% mention Render | Second most crowded |

## 3. What's missing

| Gap | Count in 813 | Notes |
| --- | --- | --- |
| A quorum ("only happens if enough say yes") | 0 | No entry protects people from a public no |
| Real-time group play in the same place | about 3 to 5 real cases | IRL Clash (location-matched photo battles), a friends treasure hunt, a bingo with shared codes |
| Built for people with disabilities | about 2 | GroundSignal (wheelchair and stroller routes), Sport fit |
| Proof of deletion | 0 | Many claim privacy, none show an audit |
| Telegram as the channel | 1 product (EcoTrace AI) | Plus one Weekend winner (PaidYet, Temporal) |
| Says it was tested on an iPhone | 7 | Side Quest's iPhone 12 tab crashed mid-download; Drift is the clean case |
| Describes a real outdoor test | 84 (10%) | The prompt gives bonus points for it |
| Night, haptics, sound design | 4%, 2%, 8% | Polish few bother with |

## 4. Closest competitors

| Entry | Overlap with Flare | Where Flare differs |
| --- | --- | --- |
| [IRL Clash](https://dev.to/someshcoding/irl-clash-go-outside-take-a-shot-win-the-battle-592i) | Multiplayer, location, outdoors | Strangers matched by distance; competitive; screen-heavy rounds. Flare is friends, cooperative, seconds of screen |
| [Drift](https://dev.to/codeswithroh/i-built-an-ai-that-only-works-when-my-phone-is-in-my-pocket-3ipn) | Gemma 4 E2B in iPhone Safari; screen-on counter | Single person. Flare reuses the "screen seconds" idea as a group metric |
| [Side Quest](https://dev.to/sizzlebop/i-built-an-ai-game-that-wants-you-to-go-outside-3a6k) | Gemma 4 E2B ONNX in the browser; second most reacted | Model runs on a desktop; iPhone failed. Flare must show it on real phones |
| [TrailSnack](https://dev.to/aaronstark1/trailsnack-a-trail-companion-that-runs-gemma-with-zero-bars-and-never-says-eat-this-pig) | Tiered models with a capability gate | Same tier idea; Flare reports which tier ran for every job |
| [Zero-Screen Dungeon Master](https://dev.to/vidisha_gupta_/zero-screen-dungeon-master-the-voice-only-rpg-where-your-real-walk-drives-the-story-3m68) | Pocket-first audio while walking | Single player, stories pre-generated on a laptop |
| [FieldIssue](https://dev.to/himanshu_748/fieldissue-take-a-walk-report-a-problem-come-back-with-evidence-e40) | Private groups, approvals | Civic reporting, hosted models, 12 claimed categories |
| Group chat polls (iMessage, Telegram) | Coordination | Public answers, no threshold, no shrink, no access info, nothing for no signal |

## 5. What wins (from the 17 Weekend winners)

1. A named person and their problem, in their words, near the top.
2. A table of measured results, including failures.
3. A "what broke" section with real bugs.
4. Model writes words; code owns facts.
5. One specific line per prize category.
6. A demo or video. Length doesn't matter (one winner had about 900 words). Claiming many categories doesn't help (one win per entry).

## 6. Where Flare wins

Flare does not win on the model. It wins on four things no entry combines, each backed by proof in the post:

1. **The quorum with no visible no.** It answers "nobody wants to show up alone" with a mechanism, not a nudge. Zero entries have it.
2. **It shrinks instead of dying (Ember).** A failed plan becomes 15 minutes at the nearest bench with one friend.
3. **Access as equals.** Needs stay on the phone; the phone counts you in for the Ember without telling anyone why. The invite photo is spoken for screen readers. A talking compass finds friends without a map or signal.
4. **Proof, not promises.** A field test with four people and a table; a deletion audit with zero rows; the AI tier that actually ran on each real iPhone.

## 7. Prize category stance

- **Target: Overall.** Every category is judged automatically; we list only the ones we genuinely use, with one specific line each.
- **Gemma:** we use it on the phone and on the laptop hub. List it, but don't build for it.
- **Render:** list only if the server that runs the Flare engine (solver, bot) runs on Render. A front end alone did not win last round.
- **MongoDB Atlas:** list only if the architect picks Atlas and it does something Atlas is good at (for example TTL indexes enforcing deletion). The SSPL point (MongoDB's own FAQ: "not approved by the OSI") goes in the decision record either way.
- **Entire:** honest fit if we embed this build's agent session. Don't chase it.
- **Sentry Agent Tracing, ElevenLabs, others:** not planned. ElevenLabs would add a closed voice; on-device speech fits the story better.
