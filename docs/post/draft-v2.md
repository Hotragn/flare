---
title: "Flare: snap where you are, and it only lights if enough friends quietly say yes"
published: false
tags: devchallenge, hf26challenge, gemma, opensource
cover_image: https://flare-outside.onrender.com/post/cover-v2.png
---

*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 1: Touch Grass](https://dev.to/challenges/hacktoberfest-week1-2026-10-05).*

## What I Built

It's 4 PM on a Saturday. Someone in the group chat writes "we should go for a walk". Three people react with a thumbs up. Nobody goes.

The thumbs up isn't the problem. Everyone meant it. The problem is what comes next. Someone has to pick a time, a place, and who's in. Someone has to say "OK, I'm actually going", and then wait to see if anyone else does.

Under that sits a quieter fear: being the only one who wants to show up. If you suggest the walk and nobody comes, that's a small rejection, in front of everyone. Most of us have learned to avoid it. So the weight of asking beats the wish to see each other, and the afternoon slips by in the chat.

I built this with Claude Code; exactly how is in [How I Built It](#how-i-built-it).

Here's how the first real one went, from my notes and the public audit ([field test 2](https://github.com/Hotragn/flare/blob/main/docs/research/field-test-2.md)). It was shortly after midnight on Monday, Oct 12 (9:38 PM PDT on Oct 11, before the deadline). Times are ET.

| Time | What happened |
| --- | --- |
| 12:38:32 AM | I sent a Flare. |
| 12:39:52 AM | A nearby friend said yes. The quorum (how many people it needs) was 2, so it lit. |
| 12:40:43 AM | My friend tapped I'm here. |
| (in between) | We met in person and talked. |
| 12:43:34 AM | We're done. |
| within 2 min | The Flare and its photo were gone from the public audit. |

The Flare ran 5 minutes from send to We're done. You can check the deletion: [/api/v1/audit](https://flare-outside.onrender.com/api/v1/audit) shows live row counts, and the [raw watch log](https://github.com/Hotragn/flare/blob/main/docs/research/field-test-2-audit-watch.log) is in the repo. Test traffic shares those totals, so I matched this Flare by timing.

**So far:** two field tests with real friends, one short meetup in person, and 6 bugs fixed from the first test.

**Live demo (no install, 60 s):** https://flare-outside.onrender.com/app/demo/ · **The app:** https://flare-outside.onrender.com/app/ · **Code:** https://github.com/Hotragn/flare · **Telegram bot:** https://t.me/FairlaneFlareBot

Flare is for friends who mean to meet and stay in anyway; the one who never asks first; the lonely one, who wants company without anyone seeing who said no; a friend with low vision, who needs the place said out loud; and a group hiking where the signal ends.

Here's how it works. You take a photo of where you are. Gemma 4, an open model on my laptop, writes a six-word invite from it, like "Meet by the quiet water's edge". You send the link to your crew (the group of friends a Flare goes to). Friends tap **I'm in** in private, and everyone sees the count, never who. It lights only at the quorum. If too few say yes in 30 minutes, it shrinks to an Ember, a smaller plan nearby, instead of dying. When it's over, it deletes itself.

The screen part is short: one tap to send, one to answer. Then the talking compass speaks the way, so you look up and walk.

Most of us have people close by, in group chats and small communities, and we still stay in, because asking means pinging everyone and waiting. I wanted one tap that says "I'm up for meeting, nearby, now." And for someone who's lonely, a quiet way to tell people they trust "I'd like some company," without anyone seeing who said no.

> "Last week I was busy working from home and haven't really got a chance or felt free to go out … I got this and saw that he was nearby next to me and used this, and we met to talk about flare … it really felt this is good for friends and people to go out"
>
> A friend, after field test 2

That's the result I cared about: a friend who hadn't felt free to go out all week, meeting up in person and talking.

### How a Flare works

![Kindling, Lit, Ember, Gone: one evening in Flare](https://flare-outside.onrender.com/post/storyboard.png)

A Flare has four states. Each rule comes from a way plans die in a group chat ([03-business-rules.md](https://github.com/Hotragn/flare/blob/main/docs/requirements/03-business-rules.md)).

**Kindling.** The Flare is out and waiting. Friends see "2 more to light it. Nobody sees who." The server stores labels like `c3`, not names.

**Lit.** It lights at the quorum, host included: 2, 3 or 4, and 2 by default. Nobody walks out to meet zero people.

![A Flare lights on a friend's phone](https://flare-outside.onrender.com/post/lit.gif)

**Ember.** If it isn't lit after 30 minutes, it becomes an Ember with quorum 2, at the nearest bench or picnic table within 400 m that fits everyone's needs. A big plan that fails often had two people who'd say yes to something small.

![A Flare shrinks to an Ember, then lights](https://flare-outside.onrender.com/post/shrink.gif)

*Too few said yes, so it shrinks, then lights: 60 fps at 4x CPU slowdown in Chrome.*

**Gone.** When the host taps We're done, or the Ember runs out, the Flare, its photo and every yes are deleted within 5 minutes. A server has no business keeping a plan to meet.

{% details How deletion works %}

A delete job removes the Flare about a minute after the end ([`DELETE_AFTER_MS`](https://github.com/Hotragn/flare/blob/main/packages/engine/src/time.ts), 60 s). A sweeper deletes anything still there at 5 minutes, which is the promise ([`GONE_GRACE_MS`](https://github.com/Hotragn/flare/blob/main/apps/server/src/core/sweep.ts)).

{% enddetails %}

These rules are about dignity more than data. If even the Ember doesn't catch, it goes out with "Not this time". Nobody is left on read, and there's no record of who didn't come.

### What's inside

A crew is the friends who joined through your Flare link. It lives under Crew in the app menu. Manage crew renames the crew, sets how many it takes, or starts fresh. Your places, Hot spots and the Crew Atlas all come from the places where the crew actually met, sealed on the phones.

Everything a person can do, and how far each part has been tested:

| Feature | What it does | Why it matters | Used with friends | Live, not yet tried with friends |
| --- | --- | --- | --- | --- |
| Flare | A photo of where you are becomes an invite for now. | One tap to ask, no group chat poll. | Yes | |
| I'm in, private count | Say yes in private; everyone sees the count, never who. | A no is invisible. | Yes | |
| Conditions | "I'm in if…", like "after 9" or "only with you", read on the phone. | Say yes with your own terms. | Test 1 | |
| I'm here, We're done | Mark that you've arrived; the host ends the Flare. | The Flare ends, and it's deleted. | Yes | |
| Share: link | You send the link in any chat, like WhatsApp. | Flare inside the chat you already use. | Yes (test 1, WhatsApp) | |
| Share: Telegram card | The bot posts the invite and the count to a linked Telegram group. | No link to paste in that chat. | | Yes |
| Sparks | A Spark is a one-line note after a meetup, sealed for the crew. | The place comes back in your crew's places. | Test 1 left one | |
| Plan for later | Pick a time and a deadline; Gemma writes a ladder of smaller plans it can shrink to. | A plan that can get smaller instead of dying. | | Yes |
| Crew space | Your places, time outside together this week, Sparks, and Manage crew. | The crew's story, without a feed. | | Yes |
| Hot spots | The places your crew met, sealed on the phone. | Good places come back, no one else sees them. | | Yes |
| Crew Atlas | A map of those places, drawn on the phone. | No map tiles, no requests, nothing sent. | | Yes |
| Talking compass | Speaks the way in, offline, with a tone when you face the right way. | Look up, not at a map. | | Yes |
| Walking loops | Bench to bench routes, with rest stops. | A walk anyone can finish. | | Yes |
| Needs profile | Avoid steps, the distance between rests, a restroom. It stays on the phone. | Plans that fit your body. | | Yes |
| Spoken scene | Gemma describes the photo for screen readers. | A friend with low vision knows the place. | | Yes |
| Plain text | The invite in 200 bytes for SMS or satellite texting; reply "IN" and the code. | Works where the signal ends. | | Yes |
| Again | One tap sends your last Flare again. | The usual meetup in one tap. | | Yes |
| Automatic I'm here | Within 30 m of the spot, with a 10 s Undo. | No tap needed when you arrive. | | Yes |
| Voice to invite | Say where you are and Gemma writes the invite. | No typing, no photo needed. | | Off on iPhone (works in desktop browsers) |
| Remember this, Say it | A note of the conversation; a Spark said out loud. | Voice, only by choice. | | Off: the iPhone recorder failed |

![A labelled sample crew from the Flare website: time outside this week, your places, Sparks, Manage crew and the Crew Atlas](https://flare-outside.onrender.com/post/crew-sample.png)

*The website's labelled sample crew ("Pond crew · SAMPLE CREW"): 2 h 40 min outside together this week.*

## Demo

Open [the demo](https://flare-outside.onrender.com/app/demo/). Nothing is sent anywhere.

1. **Send it**
2. **Friend's view**
3. **I'm in** (you're now Amor)
4. **Back to you**
5. **Skip 30 min** (it shrinks to an Ember, a smaller plan at a bench nearby)
6. **Find them**

## Code

[github.com/Hotragn/flare](https://github.com/Hotragn/flare), AGPL-3.0.

**Cold start:** Render's free plan sleeps when idle, so the first load can take up to a minute while "Waking up" shows.

**Run it locally** (from the [README](https://github.com/Hotragn/flare/blob/main/README.md), Node and npm needed):

```sh
git clone https://github.com/Hotragn/flare && cd flare && npm ci
cp .env.example .env        # set HUB_SECRET to any 32+ random characters
npm run build && npm start  # server and web app on http://localhost:8787
```

For Gemma on your own machine, add `ollama pull gemma4:e4b-it-q4_K_M` and `npm run hub`.

### Read these 6 files

| File | Its job |
| --- | --- |
| [packages/shared/src/photo.ts](https://github.com/Hotragn/flare/blob/main/packages/shared/src/photo.ts) | `enforce()`: what any model answer must pass |
| [apps/server/src/agent/ladder-agent.ts](https://github.com/Hotragn/flare/blob/main/apps/server/src/agent/ladder-agent.ts) | The Mastra agent and its four tools |
| [apps/server/src/core/sweep.ts](https://github.com/Hotragn/flare/blob/main/apps/server/src/core/sweep.ts) | Deletion within 5 minutes of the end |
| [apps/server/src/core/launch.ts](https://github.com/Hotragn/flare/blob/main/apps/server/src/core/launch.ts) | The six "Since launch" totals the site shows, with no ids, names or groups |
| [apps/web/src/lib/conditions/rules.ts](https://github.com/Hotragn/flare/blob/main/apps/web/src/lib/conditions/rules.ts) | The phone's conditions parser, taught with Tinker, a service for training small models |
| [packages/shared/src/plaintext.ts](https://github.com/Hotragn/flare/blob/main/packages/shared/src/plaintext.ts) | The 200-byte text for SMS and satellite texting |

## Why we stay in

![Time with friends went from 60 minutes a day in 2003 to 34 by 2019, then 20 in pandemic 2020, while time alone rose from 285 to 333](https://flare-outside.onrender.com/post/why-friends.png)

*Time with friends went from 60 min a day in 2003 to 34 by 2019, then 20 in pandemic 2020. Source: Kannan and Veazie, 2023, [SSM Population Health](https://doi.org/10.1016/j.ssmph.2022.101331), from the American Time Use Survey.*

I see that chart around me. What's missing is a cheap way to say "now, nearby" that doesn't put anyone on the spot. In a snapshot of 813 Week 1 entries on Oct 10, I found 28 keyword hits for real-time group play and about 3 to 5 real cases of getting a group out together ([field scan](https://github.com/Hotragn/flare/blob/main/docs/research/00-challenge-and-field.md)). Most help one person go outside. Flare gets two or more people to the same spot.

## Testing it with friends

**Field test 1, Sun Oct 11, 8:20 PM.** Two real friends on their own phones, on the live app. I hosted on an iPhone in Brave and sent the link over WhatsApp. A photo of a dim indoor light, quorum 3, and Gemma wrote "Meet under the warm light". It got 3 responses and 1 Spark, and the live audit passed at 8:36 PM. It also turned up the bugs below ([notes](https://github.com/Hotragn/flare/blob/main/docs/research/field-test-1.md)).

**Field test 2, Mon Oct 12, 12:38 AM.** The log at the top.

### What broke, and the fix

| What broke | Where | The fix | Proof |
| --- | --- | --- | --- |
| The headline and sheet covered the photo | Test 1 | The photo shows whole above the words; dark photos brightened for display; a gate checks it | [f9a7653](https://github.com/Hotragn/flare/commit/f9a7653), [958d073](https://github.com/Hotragn/flare/commit/958d073) |
| "Fuego is at Near Maple Road" (Fuego is my nickname as host; street changed for privacy) | Test 1 | "is near" grammar in every template | [near-spot.test.ts](https://github.com/Hotragn/flare/blob/main/apps/web/test/flow/near-spot.test.ts) |
| "After 10min" read as 10 AM | Test 1 | 10min is a delay, bare hours pick the next one | [2751410](https://github.com/Hotragn/flare/commit/2751410) |
| "only with you" not understood | Test 1 | "with you" means the host; missed words are said back | [2751410](https://github.com/Hotragn/flare/commit/2751410) |
| Share and WhatsApp did nothing in Brave | Test 1 | Share runs inside the tap, with a Copy link fallback | [bdf2b6c](https://github.com/Hotragn/flare/commit/bdf2b6c), [538afb5](https://github.com/Hotragn/flare/commit/538afb5) |
| "We'll buzz you" promised with no push | Test 1 | An honest Sent line: a buzz only with push | [buzz.ts](https://github.com/Hotragn/flare/blob/main/apps/web/src/lib/push/buzz.ts) |
| Returning phones got old pages | After test 1 | Pages network-first; a new service worker takes over at once | [44bcb40](https://github.com/Hotragn/flare/commit/44bcb40) |
| Remember this: the iPhone mic failed, no upload | Test 2 | Turned off on live | [field-test-2.md](https://github.com/Hotragn/flare/blob/main/docs/research/field-test-2.md) |
| Say it (voice Spark) failed the same way in Safari | After test 2 | Turned off on live | [67b07cb](https://github.com/Hotragn/flare/commit/67b07cb) |

The gap I won't hide: this was one short meetup in person, nearby and at night. It wasn't an outdoor walk yet, and that's what Flare is for.

## Losses and baselines

The measurements that changed the design, mostly things that didn't work:

| What I measured | Before | After | What it changed | Proof |
| --- | --- | --- | --- | --- |
| Photo covered by words on the invite | 73% | 0% | New gate on 3 viewports | [f9a7653](https://github.com/Hotragn/flare/commit/f9a7653) |
| Phone rules reading new phrasings (blind set) | 20/40 | 30/40 | Tinker's phrasing families and the rules' own misses taught the rules | [conditions-tinker.md](https://github.com/Hotragn/flare/blob/main/evals/reports/conditions-tinker.md) |
| Gemma 4 E2B in the browser, photo scenes | 29/40 points | not shipped | The model stays off the phone | [measured-not-shipped.md](https://github.com/Hotragn/flare/blob/main/docs/ai-runtime/measured-not-shipped.md) |
| Sounds of the spot, voices caught | 8/12 | cut | Failed the bar, so it's not in the app | [RESUME.md](https://github.com/Hotragn/flare/blob/main/docs/handoffs/RESUME.md) |
| Fresh-eyes score out of 10 | 5 | 7 | Rounds: 5, 6, 5, 6, 6, 6, then 7 | [fresh-eyes](https://github.com/Hotragn/flare/blob/main/docs/research/fresh-eyes-2026-10-11.md) |

The fresh-eyes testers are AI agents with no context, not people, using the live site as a phone. The round 6 tester liked the private yes, but would still use a WhatsApp poll for a normal meetup. A recheck after the fixes (round 6b) scored 7/10. That tester's last line: "Not until the host side gives me more." I agree. Flare is for "anyone free right now?", and a poll still wins for a planned meetup.

## How I Built It

![How Flare was built: a planning sprint, then short build sprints](https://flare-outside.onrender.com/post/sprints.png)

I ran the build as short sprints. Each had one goal and ended with a review: an AI fresh-eyes round or a real field test. Whatever the review caught became the next backlog. With many agents building at once, the cheapest bug is one caught in a document, so Sprint 0 wrote no product code: research, personas, a requirements spec, ADRs (one-page records of one decision and why) and frozen interface contracts. Then the specialists built against those contracts in parallel.

{% details Sprint 0 and the sprint table %}

Sprint 0 ran on Oct 10 from 1 PM to 7 PM ET, in this order:

1. **Research**: the challenge rules, the field of other entries, and the sources for why it matters.
2. **Product**: personas and journeys ([04-personas-journeys.md](https://github.com/Hotragn/flare/blob/main/docs/product/04-personas-journeys.md)), the PRD and the scope.
3. **Requirements**: the SRS with 159 requirements ([01-srs.md](https://github.com/Hotragn/flare/blob/main/docs/requirements/01-srs.md)), business rules, data flows, and a traceability matrix. [`trace.py`](https://github.com/Hotragn/flare/blob/main/docs/requirements/tools/trace.py) checks each requirement against code and tests.
4. **Brand and design**: the name, the copy deck, the screens and an accessibility plan.
5. **Architecture**: ADRs 0001 to 0020, now 31 in [docs/architecture/adr/](https://github.com/Hotragn/flare/tree/main/docs/architecture/adr).
6. **Engineering**: the work breakdown and the ICD, the interface control document, which froze [14 interfaces](https://github.com/Hotragn/flare/blob/main/docs/engineering/02-interface-control.md) before anyone wrote product code.

Then the specialists started in parallel: engine, backend, hub, integrations, PWA, frontend, maps and website, each with a brief in [docs/engineering/briefs/](https://github.com/Hotragn/flare/tree/main/docs/engineering/briefs).

Times are from `git log`, in ET.

| Sprint | When | Goal | What shipped | Review |
| --- | --- | --- | --- | --- |
| 0: plan | Oct 10, 1:01 PM to 7 PM | A spec, contracts and a plan before code | Research, personas, the SRS, ADRs, the ICD | The ICD frozen |
| 1: build | Oct 10, 8:51 PM to Oct 11, 3:48 AM | Every part working against the ICD | Engine, backend, hub, PWA, frontend; integration merge at 1:55 AM | End-to-end suites |
| 2: deploy and partners | Oct 11, 7:05 AM to 12:42 PM | Live, and the partner tech wired in | Render deploy (10:51), Mastra agent (10:54), Tinker rules (12:21), AI Studio key (12:42) | Fresh-eyes round 1 |
| 3: clarity | Oct 11, 1:09 PM to 5:14 PM | A stranger understands it in a minute | Rounds 2 to 5 fixes, ElevenLabs compass voice (2:12), axe 0 and Lighthouse 100 (3:33) | Rounds 2 to 5 |
| 4: field test 1 | Oct 11, 8:10 PM to 10:38 PM | Fix what real friends broke | All 6 bugs, plus the service worker (9:54) | Round 6 |
| 5: freeze | Oct 11, 10:55 PM to 11:57 PM | Round 6 fixes, then freeze | Every control visible at 375x667, the invite survives a reload | Round 6b |
| 6: field test 2 | Oct 12, 12:12 AM to 3:20 AM | The first real meetup, and honest cuts | Field test 2, Remember this and Say it off, sessions stop pushing | Field test 2 |

{% enddetails %}

{% details The roles %}

- **Per-role Claude Code sessions**: research, product, brand, design, architect, engineering lead, and one per specialist. Each wrote a handoff note when done ([docs/handoffs/](https://github.com/Hotragn/flare/tree/main/docs/handoffs)).
- **The manager session**, acting as my project manager: it wrote briefs and prompts, reviewed handoffs and made day-to-day calls.
- **Subagents in git worktrees** for isolated work, so a share fix or a photo gate could land without touching anyone else's files. They show in the history as `Merge branch 'worktree-agent-...'`.
- **The Lab session** for risk spikes: things that could sink the plan, tried before anyone built on them. The browser models, the iPhone compass and Telegram were all spikes first.

{% enddetails %}

Early on, nine parallel specialist subagents burned through my usage limit, mostly by re-reading the project, so I switched to one session plus narrow subagents ([Entire](#entire) showed why).

{% details Gates on every push %}

The pre-push hook ([.githooks/pre-push.pre-entire](https://github.com/Hotragn/flare/blob/main/.githooks/pre-push.pre-entire)) runs about 15 s: a secret scan, a scan of the recorded agent sessions, lint, types (with svelte-check for the web app) and 831 unit and contract tests (711 + 87 + 33, [npm-test.txt](https://github.com/Hotragn/flare/blob/main/docs/research/evidence/npm-test.txt)). The web suites and the build run in CI.

{% enddetails %}

**How I used AI:** Claude Code wrote the code and drafted this post from the repo's evidence, and a separate review session checked its numbers against that evidence. One session acted as my project manager: it wrote the build session's prompts, reviewed the work and made day-to-day calls while I slept, and anything that got posted or published waited for my yes. I chose the idea and set the direction, I ran both field tests with my friends, and the why is mine.

### Architecture

![The phone, the server on Render, and my laptop running Gemma 4](https://flare-outside.onrender.com/post/architecture.png)

**The phone.** A web app, nothing to install. It seals names, places, photos and Sparks with AES-256-GCM and keeps the group key in the link's `#fragment`, which browsers never send to a server.

**The server on Render.** It stores sealed data, counts and labels, runs the state machine, sweeps and serves the audit. The server never stores names or places in plain text. Photos and Plan asks pass through its memory on their way to my laptop, and nothing is kept ([ADR-0006](https://github.com/Hotragn/flare/blob/main/docs/architecture/adr/0006-hub-outbound-relay.md)). For groups that turn Telegram on, it draws the Telegram card with the six words and the place label ([ADR-0023](https://github.com/Hotragn/flare/blob/main/docs/architecture/adr/0023-telegram-card-and-photo-opt-in.md)).

**The hub on my laptop.** A small program ([apps/hub/src/](https://github.com/Hotragn/flare/tree/main/apps/hub/src)) that dials out to the server and hands one AI job at a time to Gemma 4 in Ollama. Photos stay in memory only.

**The cloud fallback.** When my Mac is off, Plan drafts come from Gemma 4 on Google AI Studio. A photo goes there only if the host taps Ask cloud Gemma.


{% details Who sees what %}

| Who | Sees | Never |
| --- | --- | --- |
| The phone | Everything for its own group, unsealed with the key in the link | Other groups |
| The server (Render) | Sealed blobs, counts, labels like `c3`, times. Photos and Plan asks in memory on their way to the hub, not kept. For Telegram groups, the six words and the place label it draws on the card | The key. It never stores names or places in plain text |
| The hub (my laptop) | The photo or Plan ask for one job, in memory | Who said yes |
| Google AI Studio | Plan inputs; a photo only after Ask cloud Gemma | Names, who said yes |
| ElevenLabs | 54 compass lines, once, at build time | Any user data |
| Telegram | The card and caption: the six words, the place label, the host's first name | Who said yes |
| Sentry | Span names, timings, model names | Our words or ids (a test fails if they reach it) |

{% enddetails %}

### Gemma decides, code guarantees

The model picks the words. Code owns the facts.

| Gemma decides | Code guarantees |
| --- | --- |
| The six-word invite and the line a screen reader speaks | It lights only at quorum |
| The labels of the smaller plans | Deletion within 5 minutes of the end |
| Which nearby place fits the plan | Places come only from the map pack, never invented |
| The tone of the words | The count never names anyone |

Every photo answer has to pass `enforce()` before it's shown or spoken. Here it is, from [packages/shared/src/photo.ts](https://github.com/Hotragn/flare/blob/main/packages/shared/src/photo.ts):

```ts
export function enforce(text: string): Draft | null {
  const parsed = PhotoAnswer.safeParse(extractJson(text));
  if (!parsed.success) return null;
  const repaired: string[] = [];
  const invite = clipWords(parsed.data.invite, 6, "invite", repaired).replace(/[.]+$/, "");
  const alt = clipWords(parsed.data.alt, 20, "alt", repaired);
  if (!invite || !alt) return null;
  if (hasPersonWords(`${invite} ${alt}`)) return null;
  return { invite, alt, repaired };
}
```

Six words at most, twenty for the spoken line, and nothing that describes a person. Null means you type the invite. The Plan ladder has its own guard, `enforceLadder()` in [prompts/ladder.ts](https://github.com/Hotragn/flare/blob/main/packages/shared/src/prompts/ladder.ts), which swaps any label that names a person or invents a place for a template label.

### The stack, one tool at a time

For each tool: what it does, why, how it's wired, and what went wrong. Measured numbers are in the details blocks.

#### Gemma 4

Gemma 4 turns a photo into the invite and a spoken line, turns a voice clip into an invite (on my laptop; voice is off on the live app), and drafts the Plan ladder: the four smaller plans a Flare can shrink to.

It's open, and I wanted the photo to go to a machine I own, not a vendor. It runs as `gemma4:e4b-it-q4_K_M`, called by the hub ([ollama.ts](https://github.com/Hotragn/flare/blob/main/apps/hub/src/ollama.ts)), with versioned [prompts](https://github.com/Hotragn/flare/tree/main/packages/shared/src/prompts); the photo prompt gets 6 s. On 20 test photos, Gemma scored 39 of 40 points (each graded 0 to 2) ([model-selection.md](https://github.com/Hotragn/flare/blob/main/docs/ml/model-selection.md)).

What failed: I wanted the model on the phone, so nothing would leave it. No browser model was good enough and fit an iPhone.

{% details Gemma 4: what I measured %}

From [model-selection.md](https://github.com/Hotragn/flare/blob/main/docs/ml/model-selection.md) and [ladder-agent-hub.md](https://github.com/Hotragn/flare/blob/main/evals/reports/ladder-agent-hub.md):

| Job | Result |
| --- | --- |
| Photo to invite | 39/40 points, 3.0 s median, valid JSON 20/20 |
| Voice to invite | A 10 s clip became "Meet at the pond bench" in 3.3 s, measured on my laptop (voice input is off on the live app) |
| Plan ladder | 13/13 valid |

The models I tried on the phone:

| Model | Where | Result | Shipped? |
| --- | --- | --- | --- |
| Gemma 4 E4B, Q4_K_M | Ollama on my Mac | 20/20 JSON, 39/40 points, 3.0 s | Yes |
| Gemma 4 E2B, ONNX q4f16 | Chrome, WebGPU | 2.3 s, but 29/40 points; it invents water and sunsets | No: it needs a 1.17 GB GPU buffer, and iPhone Safari caps at 1 GiB |
| SmolVLM-500M | Chrome and Safari | 16/40 points, 6/20 misleading | No |
| Qwen3-0.6B (conditions) | Safari | 26/40 | No: the rules got 40/40 in under 1 ms |

Sounds of the spot, where Gemma names what you can hear nearby, was cut: it heard birds in nearly every clip.

The [AI page](https://flare-outside.onrender.com/ai/) lists what's measured and what isn't shipped; [measured-not-shipped.md](https://github.com/Hotragn/flare/blob/main/docs/ai-runtime/measured-not-shipped.md) has the detail.

{% enddetails %}

#### Ollama

Ollama runs Gemma 4 on my Mac: one command pulls a quantised model and serves a local API. No GPU server to rent.

The hub dials out ([ADR-0006](https://github.com/Hotragn/flare/blob/main/docs/architecture/adr/0006-hub-outbound-relay.md)), so no port is open on my Mac. On my busy laptop, a 5-item live hub check had a 4.0 s median and 11.9 s at worst ([photo-hub.md](https://github.com/Hotragn/flare/blob/main/evals/reports/photo-hub.md)).

One snag: the first image call after a load was slow, so the hub warms up first ([warm-image.ts](https://github.com/Hotragn/flare/blob/main/apps/hub/src/warm-image.ts)).

#### Google AI Studio

AI Studio answers when my laptop is off. It serves Gemma 4 too, so the fallback uses the same prompts and guards.

I use Gemma 4 26B A4B with `GEMINI_API_KEY` on Render ([ADR-0026](https://github.com/Hotragn/flare/blob/main/docs/architecture/adr/0026-google-ai-studio-cloud-tier.md)) and `thinkingLevel` set to minimal: 1.4 s per Plan. With the default thinking, it took 21.7 s and gave no answer.

#### Mastra

An agent drafts the Plan ladder with four local tools: sunset, weather window, nearby places and step templates. Mastra gave me tools, a model call and tracing in one place, in TypeScript.

The agent lives in [ladder-agent.ts](https://github.com/Hotragn/flare/blob/main/apps/server/src/agent/ladder-agent.ts), behind a flag, with the decision in [ADR-0025](https://github.com/Hotragn/flare/blob/main/docs/architecture/adr/0025-mastra-plan-agent.md). Live since Oct 12, it costs about nothing in speed and adds the weather.

{% details Mastra: what I measured %}

From [ladder-agent-hub.md](https://github.com/Hotragn/flare/blob/main/evals/reports/ladder-agent-hub.md). Two runs of 13 asks, agent vs old route: 5.1 vs 5.5 s p95, then 5.6 vs 5.3 s. The weather tool matched the plan's time window 7/7.

{% enddetails %}

#### Tinker

Tinker is a service for training small models. I used it to teach the phone's conditions parser (the rules that read "after 10" or "only with Amor") more phrasings. I trained a small LoRA (a cheap add-on layer for a model) without owning a GPU and compared it to the rules on a blind set.

{% details Tinker: what I measured %}

[ml/tinker/](https://github.com/Hotragn/flare/tree/main/ml/tinker) holds the data generator, the rules bridge and a fresh held-out set; the model card is [model-card-conditions-lora.md](https://github.com/Hotragn/flare/blob/main/docs/ml/model-card-conditions-lora.md).

From [conditions-tinker.md](https://github.com/Hotragn/flare/blob/main/evals/reports/conditions-tinker.md). A $2.40 Qwen3.5-4B LoRA read 38 of 40 new phrasings. It's too big for a phone, so it didn't ship. Instead its phrasing families and the rules' own misses taught the rules ([6a73941](https://github.com/Hotragn/flare/commit/6a73941)), with the gain in the [losses table](#losses-and-baselines). The rules still run on the phone in under a millisecond.

{% enddetails %}

#### ElevenLabs

ElevenLabs gives the compass a warm voice. Built-in phone speech varies by device; a recorded voice sounds the same everywhere and needs no signal.

I recorded 54 compass lines (698 characters) once, shipped as files and played offline ([ADR-0027](https://github.com/Hotragn/flare/blob/main/docs/architecture/adr/0027-elevenlabs-voice.md), [compass/voice.ts](https://github.com/Hotragn/flare/blob/main/apps/web/src/lib/compass/voice.ts)). No user data goes to ElevenLabs.

What went wrong: voice input with Scribe (ElevenLabs' speech to text) is off, because the iPhone recorder failed before any upload. The server code works.

{% details ElevenLabs: two day cards from the server code %}

Below is what the server code makes from a clip I recorded on my phone (Voice Memos) and ran on my laptop, and from a public meeting recording. Timings are in [remember-voice-timings.txt](https://github.com/Hotragn/flare/blob/main/docs/research/evidence/remember-voice-timings.txt).

![A Remember this card from a 46 s recording in Telugu and English](https://flare-outside.onrender.com/post/day-card.png)

*A 46 s recording of me in Telugu and English: Scribe 1.5 s, Gemma's line 2.8 s. Gemma's line is close but calls it a discussion and a device.*

![A Remember this card from a public meeting recording](https://flare-outside.onrender.com/post/day-card-ami.png)

*45 s of a public meeting recording (AMI Meeting Corpus, ES2002a, CC BY 4.0): Scribe found 2 speakers in 1.7 s, and Gemma's line took 2.3 s.*

{% enddetails %}

#### Sentry Agent Tracing

Sentry shows each AI job as a trace: every tool, the model call and the guard, with timings, without sending our words anywhere.

The setup is in [tracing.ts](https://github.com/Hotragn/flare/blob/main/apps/server/src/tracing.ts), and a test fails if our words or ids reach Sentry ([ADR-0021](https://github.com/Hotragn/flare/blob/main/docs/architecture/adr/0021-sentry-agent-tracing.md)). The agent span's input panel reads "No input for this span", which is what I wanted.

It caught two things. The first live Plan draft took 10.6 s, a cold start 271% over its 2.85 s average. And the agent jobs ended up inside one long-lived parent trace, which I still have to split.

{% details Sentry: one trace from the live server %}

From [sentry-trace-91adbc1cab8c.txt](https://github.com/Hotragn/flare/blob/main/docs/research/evidence/sentry-trace-91adbc1cab8c.txt):

| Span | Time |
| --- | --- |
| sunset | 327 ms |
| weather_window | 975 ms |
| nearby_places | 3.6 ms |
| step_templates | 0.3 ms |
| gemma chat | 3.05 s |
| enforce_ladder | 7.4 ms |
| flare-photo, gemma4:e4b chat | 6.00 s |
| flare-ladder (whole job) | 10.58 s |

The trace root shows as `http.server GET:health` with 110 spans.

{% enddetails %}

#### Telegram

Telegram puts Flare in the group chat: a bot can post a card and delete it later, which a WhatsApp link can't. The bot lives in [apps/server/src/telegram/](https://github.com/Hotragn/flare/tree/main/apps/server/src/telegram), using the webhook on Render ([ADR-0023](https://github.com/Hotragn/flare/blob/main/docs/architecture/adr/0023-telegram-card-and-photo-opt-in.md)). The post shows the six words, the place label and the host's first name, never who said yes. It's deleted at Gone. Try [@FairlaneFlareBot](https://t.me/FairlaneFlareBot).

#### Render

Render hosts everything that isn't a model (server, Mastra agent, sweeper, Postgres, Telegram webhook) on the free tier ([ADR-0005](https://github.com/Hotragn/flare/blob/main/docs/architecture/adr/0005-hosting-render-https.md), [deploy-render.ts](https://github.com/Hotragn/flare/blob/main/scripts/deploy-render.ts)).

The catch: no cron, and it sleeps. So the sweeper runs at boot, and a server that wakes deletes anything past its end at once. The app shows "Waking up" meanwhile ([599ead2](https://github.com/Hotragn/flare/commit/599ead2)).

#### Entire

Entire records each agent session alongside git. A checkpoint is the saved slice of a session that led to a commit, and the commit's `Entire-Checkpoint:` trailer points at it.

**Provenance.** 235 of 411 commits on main carry an Entire-Checkpoint trailer (when I wrote this): every commit since 2:27 AM on Oct 11.

**Cost accounting.** One checkpoint used 828M tokens over 1,546 calls, 99.2% of it cache replay: the same context sent again on every call ([entire-checkpoint-tokens.txt](https://github.com/Hotragn/flare/blob/main/docs/research/evidence/entire-checkpoint-tokens.txt)).

**A privacy gate.** Sessions are full of things that shouldn't be public, so [scan-sessions.ts](https://github.com/Hotragn/flare/blob/main/scripts/scan-sessions.ts) runs before every push.

{% details Entire: the trailer, the tokens and the scan %}

A real trailer, from the feature commit 2751410 (body trimmed):

```
Fix live conditions bugs: 10min is a delay, bare hours pick the next one, with you means the host, missed words are said back, tap-to-fill chips

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Entire-Checkpoint: 01M4PRC68GKG4JQGEDGSRZJRA7
```

The token count is from `entire checkpoint tokens 01M4NXQZFTTGWVNDECY5S75K0E`, which shows 827,898k tokens.

The scan's public dry run looked at the 166 checkpoints that existed at the time. It found 1,539 email and 22 phone-number matches in 101 of them, and 0 secrets ([scan-sessions-dry-run.txt](https://github.com/Hotragn/flare/blob/main/docs/research/evidence/scan-sessions-dry-run.txt)). On Oct 12 a scrubber cleaned all 266 checkpoints there are now and recomputed each `content_hash`, and `entire configure --skip-push-sessions` stops uncleaned sessions being pushed ([da538c0](https://github.com/Hotragn/flare/commit/da538c0)).

{% enddetails %}

#### DevRelay

DevRelay hosts the agent sessions embedded [below](#my-agent-session).

#### Not claimed

- **DigitalOcean**: wired in as a cloud tier ([ADR-0022](https://github.com/Hotragn/flare/blob/main/docs/architecture/adr/0022-digitalocean-cloud-tier.md)), but the account's billing is paused, so it isn't live.
- **MongoDB**: not used. Flare stores its data in Postgres.

## Why Does Open Innovation Matter?

All of this stack exists to remove one small anxiety: asking a friend to come out. Open models let the tech disappear so only the meetup is left, and let me put each piece where it belongs.

{% details Where each piece runs %}

- Gemma 4 E4B (about 4B effective parameters) runs on my laptop and does the photo and voice work.
- Gemma 4 26B A4B runs in Google's cloud, only as the fallback when my laptop is off.
- One Mastra agent with four tools drafts the Plan ladder; it's one agent, not four.
- The rules engine for conditions runs on the phone, with no model at all.

{% enddetails %}

Here's where open beat closed, in ways you can check:

- **Cost.** A photo costs me $0. Gemma 4 runs on a laptop I already own.
- **Privacy.** Photos and Plan asks pass through the server's memory on their way to my laptop, and nothing is kept. A closed API would get a picture of where my friends are.
- **Checkable.** The privacy promise is not a policy page. Anyone can read [/api/v1/audit](https://flare-outside.onrender.com/api/v1/audit) and the code that deletes.
- **Debuggable.** When Gemma 4 E2B failed on iPhone Safari, I could see why: its GPU buffer was bigger than Safari's cap. A closed model would have given me an error and a guess.

Where closed would win is speed. My busy laptop is slow at times ([Ollama](#ollama)). That's what the cloud fallback is for, and it's still Gemma.

## What I got wrong

My own test found the hardest ones:

- **As the host, after sending, all I could see was a lot of animation.** It was unclear whether my friends would come, and whether ElevenLabs had worked.
- **"Pocket it" felt like a button I had to press.** Nothing said to wait until my friend arrives, or that the app should stay open even in my pocket.
- **On the friend's side, it showed the place and buttons to finish fast,** without saying what each step is for.
- **Remember this passed every automated check, then failed on my iPhone:** "Couldn't write it down." The logs show no upload. My tests had faked the mic. "Say it" for a Spark failed the same way in Safari, so both are off. I expected a card of the day, with the voice only by choice.

The lesson: a test that fakes the mic proves the server, not the phone.

Of the [field-test bugs](#what-broke-and-the-fix), the one I'm most embarrassed by is the photo covered by words. The whole idea starts with a photo, and my own invite hid it.

{% details Four more from fresh-eyes round 6 %}

Round 6 caught 4 more before the freeze: the invite lost on reload, "Sent." shown before sharing, size buttons hidden at 375x667, and location asked twice ([6ff2383](https://github.com/Hotragn/flare/commit/6ff2383), [72ade11](https://github.com/Hotragn/flare/commit/72ade11)).

{% enddetails %}

## What it can't do yet

- **The 48-friend run is a Simulation,** and the app labels it so. Made-up friends, real server.
- **Untested on a trail** or over a real satellite link, though the 200-byte text fits.
- **Voice input was tested only in desktop browsers.** It failed twice on an iPhone.
- **On an iPhone, the compass stops when the screen locks.** A web app gets no background location there.
- **In a small group, the count can give away who said yes.** Two invited and a count of 1 is easy to guess.

Next steps:

- Once lit, show the host who's coming, with each yes-sayer's OK.
- A host status line: "1 friend coming. Keep Flare open; your phone can stay in your pocket."
- Remember this as a day card, with the voice only by choice.
- "My usual" conditions, repeating Plans, in-app golden-hour nudges.
- Give each AI job its own Sentry trace.

## My Agent Session

All three were scrubbed before upload: emails, phone numbers, local file paths, a street name and chat ids removed, and long tool output trimmed.

{% agent_session building-flare-the-build-session-for-touch-grass-bhownz %}

The build session, 153 messages.

{% agent_session flare-lab-the-risk-spikes-behind-flare-balez0 %}

The Lab's risk spikes, 20 messages: where the browser models failed and the 1.17 GB buffer showed up.

{% agent_session flare-manager-my-key-prompts-the-work-orders-and-the-team-reports-xefvhu %}

Four of my structured prompts (the idea, the brainstorm brief, the night re-plan, the tone brief), the work orders the manager session sent, and the reports that came back, 153 messages. Our back-and-forth chat is left out.

## Prize Categories

- **Overall:** Flare turns "we should meet" into an actual meetup, and nobody sees who said no: in field test 2 a friend said yes 80 seconds after I sent it, and we met in person. [Details](#testing-it-with-friends)
- **Best Use of Gemma:** Gemma 4 turns a photo of where you are into a six-word invite, on my own laptop: 39 of 40 points on 20 test photos. [Details](#gemma-4)
- **Best Use of Tinker:** Tinker helped the phone understand more ways friends say "I'm in if…": a $2.40 LoRA read 38 of 40 new phrasings. [Details](#tinker)
- **Best Use of ElevenLabs:** ElevenLabs gives the compass a warm voice that plays offline and sends nothing: 54 lines, recorded once. [Details](#elevenlabs)
- **Best Use of Mastra:** Mastra lets the Plan agent check sunset, weather and nearby places: the weather tool matched the plan's time window 7/7. [Details](#mastra)
- **Best Use of Sentry Agent Tracing:** Sentry shows where a friend's wait goes in each AI job, without our words: it caught a cold start 271% over average. [Details](#sentry-agent-tracing)
- **Best Use of Render:** Render keeps the deletion promise even on a free tier that sleeps: anything past its end is swept at boot, and the promise is 5 minutes. [Details](#render)
- **Best Use of Entire:** Entire lets anyone trace the code back to the session that wrote it: every commit since 2:27 AM on Oct 11 carries a checkpoint (235 of 411 on main). [Details](#entire)

## Updated after the deadline (Oct 12, morning ET)

This is a rewrite of the published post. The facts are the same. New: how I built it, a section per tool, the field-test failure table, a losses table, the two Remember this day cards, and the agent sessions. After the deadline I also cleaned and published the agent sessions and Entire checkpoints, and made the repo public.
