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

This is how the first real one went, from my notes and the public audit ([field test 2](https://github.com/Hotragn/flare/blob/main/docs/research/field-test-2.md)). Times are ET on Monday, Oct 12.

| Time | What happened |
| --- | --- |
| 12:38:32 | I sent a Flare. |
| 12:39:52 | A nearby friend said yes. The quorum was 2, so it lit. |
| 12:40:43 | I'm here. |
| (in between) | We met in person and talked. |
| 12:43:34 | We're done. |
| within 2 min | The Flare and its photo were gone from the public audit. |

You can check the deletion part yourself: [flare-outside.onrender.com/api/v1/audit](https://flare-outside.onrender.com/api/v1/audit) shows the live row counts and whether anything outlived its end. The raw watch log (roughly one audit read a minute) is in the repo ([field-test-2-audit-watch.log](https://github.com/Hotragn/flare/blob/main/docs/research/field-test-2-audit-watch.log)). Test traffic shares those totals, so I matched this Flare by timing.

**TL;DR.** Flare turns one photo into a plan to meet. Gemma 4, an open model, runs on my laptop and writes the invite. Friends say yes in private, and it lights only if enough can come. So far: two field tests with real friends, one short meetup in person, 6 bugs found and fixed from the first test, and 39 of 40 photo scenes read right. The AI testers I used scored it 5/10 at first and 7/10 at the end.

**Live demo (no install, 60 s):** https://flare-outside.onrender.com/app/demo/ · **The app:** https://flare-outside.onrender.com/app/ · **Code:** https://github.com/Hotragn/flare · **Telegram bot:** https://t.me/FairlaneFlareBot

Flare is for:

- friends who mean to meet and stay in anyway;
- the one who never asks first;
- the lonely one, who wants company without anyone seeing who said no;
- a friend with low vision, who needs the place said out loud;
- a group hiking where the signal ends.

Here's how it works. You take a photo of where you are. Gemma 4 writes a six-word invite from it, like "Meet by the quiet water's edge". You send the link. Friends tap **I'm in** in private, and everyone sees the count, never who. It lights only when enough can come. If too few say yes in 30 minutes, it shrinks to a smaller plan nearby instead of dying. When it's over, it deletes itself.

The challenge puts it plainly: "The best builds here should make the screen the shortest part of the experience." In Flare, the screen part is a photo and one tap to send. A friend answers with one tap. Then the talking compass speaks the way and plays a tone when you face the right way, so you look up and walk. One catch: on an iPhone it stops when the phone locks (more in the limits).

Most of us have people close by, in group chats and small communities, and we still stay in, because asking means pinging everyone and waiting. I wanted one tap that says "I'm up for meeting, nearby, now." And for someone who's lonely, a quiet way to tell people they trust "I'd like some company," without anyone seeing who said no.

> "Last week I was busy working from home and haven't really got a chance or felt free to go out … I got this and saw that he was nearby next to me and used this, and we met to talk about flare … it really felt this is good for friends and people to go out"
>
> A friend, after field test 2

That's the result I cared about. Lighthouse 100 and a 3.0 s photo read are nice. The number that counted was one: a friend who hadn't felt free to go out all week, meeting up in person and talking. The tables below show how that happened, and where it still breaks.

## Demo

Open [the demo](https://flare-outside.onrender.com/app/demo/). Nothing is sent anywhere.

1. Tap **I'm in** as Amor.
2. Tap **Skip 30 min** and watch it shrink to an Ember.
3. Tap **Find them** and hear the compass.

### How a Flare works

![Kindling, Lit, Ember, Gone: one evening in Flare](https://flare-outside.onrender.com/post/storyboard.png)

A Flare has four states. Each rule comes from a way plans die in a group chat. I wrote them down as business rules in [03-business-rules.md](https://github.com/Hotragn/flare/blob/main/docs/requirements/03-business-rules.md).

**Kindling.** The Flare is out and waiting. Friends see "2 more to light it. Nobody sees who." That private count is the core rule. The server stores labels like `c3`, not names, so a no is invisible and a yes is not exposed.

**Lit.** It lights when the quorum is reached. The quorum is how many people it needs, host included: 2, 3 or 4 for a Flare, 2 by default (BR-Q-2). Lighting only at quorum means nobody walks out to meet zero people.

![A Flare lights on a friend's phone](https://flare-outside.onrender.com/post/lit.gif)

**Ember.** If it isn't lit after 30 minutes, it shrinks to an Ember: a smaller plan, quorum 2, at the nearest bench or picnic table within 400 m that fits everyone's needs (BR-F-3, BR-E-1). I added the 30-minute shrink because a big plan that fails usually had two people who'd have said yes to something small.

![A Flare shrinks to an Ember, then lights](https://flare-outside.onrender.com/post/shrink.gif)

*Too few said yes, so it shrinks, then lights: 60 fps at 4x CPU slowdown in Chrome.*

**Gone.** When the host taps We're done, or the Ember runs out, the Flare, its photo and every yes are deleted. A delete job removes it about a minute after the end ([`DELETE_AFTER_MS`](https://github.com/Hotragn/flare/blob/main/packages/engine/src/time.ts), 60 s). A sweeper deletes anything still there at 5 minutes, which is the promise ([`GONE_GRACE_MS`](https://github.com/Hotragn/flare/blob/main/apps/server/src/core/sweep.ts)). In field test 2 it was gone from the public audit within 2 minutes. A server has no business keeping a plan to meet.

To me these rules are about dignity more than data. The private count means nobody gets turned down in public. If not enough can come, the Flare doesn't fail out loud: after 30 minutes it quietly offers a smaller version nearby. If even that doesn't catch, it goes out on its own with "Not this time", and then it's deleted. Nobody is left on read, and there's no record of who didn't come. That's what makes it safe to ask at all.

Gemma 4 on my laptop does the AI work. I call it the hub: a small program on my Mac runs the model and dials out to the server, so the phone never talks to it directly.

### What's inside

Everything a person can do in Flare, and whether it works on the live site today.

| Feature | What it does | Why it matters | Status |
| --- | --- | --- | --- |
| Flare | A photo of where you are becomes an invite for now. | One tap to ask, no group chat poll. | Live |
| Plan for later | Pick a time and a deadline; Gemma writes a ladder of smaller plans it can shrink to. | A plan that can get smaller instead of dying. | Live |
| Conditions | "I'm in if…", like "after 9" or "only with you", read on the phone. | Say yes with your own terms. | Live |
| Crew space | Your places, time outside together this week, Sparks, and Manage crew. | The crew's story, without a feed. | Live |
| Sparks | One line after a meetup, sealed for the crew. | The invite next time remembers this place. | Live |
| Hot spots | The places your crew met, sealed on the phone. | Good places come back, no one else sees them. | Live |
| Crew Atlas | A map of those places, drawn on the phone. | No map tiles, no requests, nothing sent. | Live |
| Talking compass | Speaks the way in, offline, with a tone when you face the right way. | Look up, not at a map. | Live |
| Walking loops | Bench to bench routes, with rest stops. | A walk anyone can finish. | Live |
| Needs profile | Avoid steps, the distance between rests, a restroom. It stays on the phone. | Plans that fit your body. | Live |
| Spoken scene | Gemma describes the photo for screen readers. | A friend with low vision knows the place. | Live |
| Telegram card | The bot posts the invite and the count to your group. | Flare inside the chat you already use. | Live |
| Plain text | The invite in 200 bytes for SMS or satellite texting; reply "IN" and the code. | Works where the signal ends. | Live |
| Again | One tap sends your last Flare again. | The usual meetup in one tap. | Live |
| Automatic I'm here | Within 30 m of the spot, with a 10 s Undo. | No tap needed when you arrive. | Live |
| Remember this, Say it | A note of the conversation; a Spark said out loud. | Voice, only by choice. | Off: the iPhone recorder failed |

![The Crew space on the live app: two friends by an unlit fire, your crew's map drawn on the phone, and the place you met](https://flare-outside.onrender.com/post/crew.jpg)

## Code

[github.com/Hotragn/flare](https://github.com/Hotragn/flare), AGPL-3.0.

**Cold start:** the server is on Render's free plan, which sleeps when nobody's using it. The first load can take up to a minute while "Waking up" shows. After that it's quick.

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
| [apps/web/src/lib/conditions/rules.ts](https://github.com/Hotragn/flare/blob/main/apps/web/src/lib/conditions/rules.ts) | The phone's conditions parser, taught by Tinker |
| [packages/shared/src/plaintext.ts](https://github.com/Hotragn/flare/blob/main/packages/shared/src/plaintext.ts) | The 200-byte text for SMS and satellite texting |

## Why it matters

![Time with friends fell by two thirds from 2003 to 2020: 60 to 20 minutes a day, while time alone rose from 285 to 333](https://flare-outside.onrender.com/post/why-friends.png)

*Source: Kannan and Veazie, 2023, [SSM Population Health](https://doi.org/10.1016/j.ssmph.2022.101331), from the American Time Use Survey.*

I see that chart around me: people close by, in the same chats, still staying in. It's not that nobody has friends. What's missing is a cheap way to say "now, nearby" that doesn't put anyone on the spot. Of the 813 Week 1 entries I scanned, fewer than 1% get a group out together ([field scan](https://github.com/Hotragn/flare/blob/main/docs/research/00-challenge-and-field.md)). Most help one person go outside. Flare is about getting two or more people to the same spot.

## Taking it outside

### Field test 1: Sun Oct 11, 8:20 PM

Two real friends on their own phones, using the live app. I hosted on an iPhone in Brave and sent the link over WhatsApp. I took a photo of a dim indoor light with quorum 3, and Gemma wrote "Meet under the warm light". It got 3 responses and 1 Spark (a short note left on the Flare), and the live audit passed at 8:36 PM. It also turned up 6 bugs ([notes](https://github.com/Hotragn/flare/blob/main/docs/research/field-test-1.md)).

### Field test 2: Mon Oct 12, 12:38 AM

That's the log at the top. A nearby friend said yes, it lit at quorum 2, I tapped I'm here, we met in person and talked, and it was gone from the public audit within 2 minutes of We're done.

### What broke, and the fix

| What broke | Where | The fix | Commit |
| --- | --- | --- | --- |
| The headline and sheet covered the photo (73% covered) | Test 1 | The photo shows whole above the words; dark photos brightened for display; a gate checks it | [f9a7653](https://github.com/Hotragn/flare/commit/f9a7653), [958d073](https://github.com/Hotragn/flare/commit/958d073) |
| "Fuego is at Near Maple Road" (street changed for privacy) | Test 1 | "is near" grammar in every template | [6e251ec](https://github.com/Hotragn/flare/commit/6e251ec), [3462ae2](https://github.com/Hotragn/flare/commit/3462ae2) |
| "After 10min" read as 10 AM | Test 1 | 10min is a delay, bare hours pick the next one | [2751410](https://github.com/Hotragn/flare/commit/2751410) |
| "only with you" not understood | Test 1 | "with you" means the host; missed words are said back | [2751410](https://github.com/Hotragn/flare/commit/2751410) |
| Share and WhatsApp did nothing in Brave | Test 1 | Share runs inside the tap, with a Copy link fallback | [bdf2b6c](https://github.com/Hotragn/flare/commit/bdf2b6c), [538afb5](https://github.com/Hotragn/flare/commit/538afb5) |
| "We'll buzz you" promised with no push | Test 1 | An honest Sent line: a buzz only with push | [6e251ec](https://github.com/Hotragn/flare/commit/6e251ec) |
| Returning phones got old pages | After test 1 | Pages network-first; a new service worker takes over at once | [44bcb40](https://github.com/Hotragn/flare/commit/44bcb40) |
| Remember this: the iPhone mic failed, no upload | Test 2 | Turned off on live | [a6d0131](https://github.com/Hotragn/flare/commit/a6d0131) |
| Say it (voice Spark) failed the same way in Safari | After test 2 | Turned off on live | [67b07cb](https://github.com/Hotragn/flare/commit/67b07cb) |

My friend's words are quoted up top. The gap I won't hide: this was one short meetup in person, nearby and at night. It wasn't an outdoor walk yet, and that's what Flare is for.

## Losses and baselines

These are the measurements that changed the design. I put them up front because most are things that didn't work.

| What I measured | Before | After | What it changed | Proof |
| --- | --- | --- | --- | --- |
| Photo covered by words on the invite | 73% | 0% | New gate on 3 viewports | [f9a7653](https://github.com/Hotragn/flare/commit/f9a7653) |
| Phone rules reading new phrasings (blind set) | 20/40 | 30/40 | Tinker's mistakes taught the rules | [conditions-tinker.md](https://github.com/Hotragn/flare/blob/main/evals/reports/conditions-tinker.md) |
| Gemma 4 E2B in the browser, photo scenes | 29/40 | not shipped | The model stays off the phone | [measured-not-shipped.md](https://github.com/Hotragn/flare/blob/main/docs/ai-runtime/measured-not-shipped.md) |
| Sounds of the spot, voices caught | 8/12 | cut | Failed the bar, so it's not in the app | [RESUME.md](https://github.com/Hotragn/flare/blob/main/docs/handoffs/RESUME.md) |
| Fresh-eyes score out of 10 | 5 | 7 | Rounds: 5, 6, 5, 6, 6, 6, then 7 | [fresh-eyes](https://github.com/Hotragn/flare/blob/main/docs/research/fresh-eyes-2026-10-11.md) |

The fresh-eyes testers are AI agents with no context, not people. Each used the live site as a phone, read no source, and had to say if they'd understand and use it in under a minute. Round 6 scored 6/10. That tester liked the private yes and the "only if enough come" rule, but would still use a WhatsApp poll for a normal meetup. A recheck after the fixes scored 7/10. I agree with it. Flare is for "anyone free right now?", and a poll still wins for a planned meetup.

## How I Built It

![How Flare was built: a planning sprint, then short build sprints](https://flare-outside.onrender.com/post/sprints.png)

I ran the build as short sprints. Each had one goal and ended with a review, and whatever the review caught became the next sprint. The review was either an AI fresh-eyes round or a real field test, and the retro after it wrote the next backlog.

### Sprint 0: plan before anyone builds

With many agents building at once, the cheapest bug is one caught in a document. So the first sprint wrote no product code. It ran on Oct 10 from 1 PM to 7 PM ET, in this order:

1. **Research**: the challenge rules, the field of other entries, and the sources for why it matters.
2. **Product**: personas and journeys ([04-personas-journeys.md](https://github.com/Hotragn/flare/blob/main/docs/product/04-personas-journeys.md)), the PRD and the scope.
3. **Requirements**: the SRS with 159 requirements ([01-srs.md](https://github.com/Hotragn/flare/blob/main/docs/requirements/01-srs.md)), business rules, data flows, and a traceability matrix. [`trace.py`](https://github.com/Hotragn/flare/blob/main/docs/requirements/tools/trace.py) checks each requirement against code and tests.
4. **Brand and design**: the name, the copy deck, the screens and an accessibility plan.
5. **Architecture**: ADRs 0001 to 0020 (an ADR is a one-page record of one decision and why), now 31 in [docs/architecture/adr/](https://github.com/Hotragn/flare/tree/main/docs/architecture/adr).
6. **Engineering**: the work breakdown and the ICD, the interface control document, which froze [14 interfaces](https://github.com/Hotragn/flare/blob/main/docs/engineering/02-interface-control.md) before anyone wrote product code.

Then the specialists started in parallel: engine, backend, hub, integrations, PWA, frontend, maps and website, each with a brief in [docs/engineering/briefs/](https://github.com/Hotragn/flare/tree/main/docs/engineering/briefs), each building against the frozen contracts.

### The sprints

Times are from `git log`, in ET.

| Sprint | When | Goal | What shipped | Review |
| --- | --- | --- | --- | --- |
| 0: plan | Oct 10, 1:01 PM to 7 PM | A spec, contracts and a plan before code | Research, personas, the SRS (159 requirements), ADRs, the ICD (14 interfaces) | The ICD frozen |
| 1: build | Oct 10, 8:51 PM to Oct 11, 3:48 AM | Every part working against the ICD | Engine, backend, hub, PWA, frontend; integration merge at 1:55 AM | End-to-end suites |
| 2: deploy and partners | Oct 11, 7:05 AM to 12:42 PM | Live, and the partner tech wired in | Render deploy (10:51), Mastra agent (10:54), Tinker rules (12:21), AI Studio key (12:42) | Fresh-eyes round 1: 5/10 |
| 3: clarity | Oct 11, 1:09 PM to 5:14 PM | A stranger understands it in a minute | Rounds 2 to 5 fixes, ElevenLabs compass voice (2:12), axe 0 and Lighthouse 100 (3:33) | Rounds 2 to 5: 6, 5, 6, 6 |
| 4: field test 1 | Oct 11, 8:10 PM to 10:38 PM | Fix what real friends broke | All 6 bugs, plus the service worker (9:54) | Round 6: 6/10 |
| 5: freeze | Oct 11, 10:55 PM to 11:57 PM | Round 6 fixes, then freeze | Every control visible at 375x667, the invite survives a reload | Round 6b: 7/10 |
| 6: field test 2 | Oct 12, 12:12 AM to 3:20 AM | The first real meetup, and honest cuts | Field test 2, Remember this and Say it off, sessions stop pushing | Field test 2 |

### The roles

- **Per-role Claude Code sessions**: research, product, brand, design, architect, engineering lead, and one per specialist. Each wrote a handoff note when done ([docs/handoffs/](https://github.com/Hotragn/flare/tree/main/docs/handoffs)).
- **The manager session**, acting as my project manager: it wrote briefs and prompts, reviewed handoffs and made day-to-day calls.
- **Subagents in git worktrees** for isolated work, so a share fix or a photo gate could land without touching anyone else's files. You can see them in the history as `Merge branch 'worktree-agent-...'`.
- **The Lab session** for risk spikes: things that could sink the plan, tried before anyone built on them. The browser models, the iPhone compass and Telegram were all spikes first.

### Gates on every push

The pre-push hook ([.githooks/pre-push.pre-entire](https://github.com/Hotragn/flare/blob/main/.githooks/pre-push.pre-entire)) runs about 15 s: a secret scan, a scan of the recorded agent sessions, lint, types (with svelte-check for the web app) and 830 unit and contract tests. The web suites and the build run in CI.

### What it cost, and why I changed the setup

Early on, nine parallel specialist subagents burned through my usage limit, mostly by re-reading the project. So I switched to one session plus narrow subagents. Entire's token count for one checkpoint later showed why (`entire checkpoint tokens 01M4NXQZFTTGWVNDECY5S75K0E`): 828M tokens over 1,546 calls, 99.2% of it cache replay, meaning the same context sent again on every call. More in [its section](#entire).

**How I used AI:** Claude Code wrote the code and drafted this post from the repo's evidence, and a separate review session checked its numbers against that evidence. One session acted as my project manager: it wrote the build session's prompts, reviewed the work and made day-to-day calls while I slept, and anything that got posted or published waited for my yes. I chose the idea and set the direction, I ran both field tests with my friends, and the why is mine.

## Architecture

![The phone, the server on Render, and my laptop running Gemma 4](https://flare-outside.onrender.com/post/architecture.png)

**The phone.** A web app, nothing to install. It takes the photo, seals names, places, photos and Sparks with AES-256-GCM, and keeps the group key in the link's `#fragment`, which browsers never send to a server. It also runs the conditions parser ([rules.ts](https://github.com/Hotragn/flare/blob/main/apps/web/src/lib/conditions/rules.ts)) and the compass, both offline.

**The server on Render.** It stores sealed data, counts and labels, runs the state machine, sweeps deleted Flares and serves the audit. It never sees a name or a place in plain text.

**The hub on my laptop.** [apps/hub/src/](https://github.com/Hotragn/flare/tree/main/apps/hub/src) dials out to the server over a WebSocket, takes one AI job at a time and hands it to Gemma 4 in Ollama. Photos stay in memory only.

**The cloud fallback.** When my Mac is off, Plan drafts come from Gemma 4 on Google AI Studio. A photo goes there only if the host taps Ask cloud Gemma.

**The partners around it.** ElevenLabs recorded the compass voice once; Telegram posts a card; Sentry traces each AI job.

### Who sees what

| Who | Sees | Never sees |
| --- | --- | --- |
| The phone | Everything for its own group, unsealed with the key in the link | Other groups |
| The server (Render) | Sealed blobs, counts, labels like `c3`, times | Names, places, the key |
| The hub (my laptop) | The photo or voice clip for one job, in memory | Who said yes |
| Google AI Studio | Plan inputs; a photo only after Ask cloud Gemma | Names, who said yes |
| ElevenLabs | 54 compass lines, once, at build time | Any user data |
| Telegram | The six words, the spot, the host's first name | Who said yes |
| Sentry | Span names, timings, model names | Our words or ids (a test fails if they reach it) |

## Gemma decides, code guarantees

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

So: six words at most, twenty for the spoken line, and any answer that describes a face or a person gets thrown out. Null means you type the invite yourself. The Plan ladder has its own guard, `enforceLadder()` in [prompts/ladder.ts](https://github.com/Hotragn/flare/blob/main/packages/shared/src/prompts/ladder.ts), which swaps any label that names a person or invents a place for a template label.

## The stack, one tool at a time

For each tool: what it does, why I picked it, how it's wired, a number I measured, and what went wrong.

### Gemma 4

Gemma 4 sees, hears and writes. It turns a photo into the invite and a spoken line, turns a voice clip into an invite, and drafts the Plan ladder: the four smaller plans a Flare can shrink to.

I picked Gemma 4. It's open, it runs on my Mac in Ollama, and the E4B size reads a photo well enough to write about it. I wanted the photo to go to a machine I own, not a vendor.

It runs as `gemma4:e4b-it-q4_K_M` in Ollama, called by the hub ([apps/hub/src/ollama.ts](https://github.com/Hotragn/flare/blob/main/apps/hub/src/ollama.ts)). The prompts are versioned specs in [packages/shared/src/prompts/](https://github.com/Hotragn/flare/tree/main/packages/shared/src/prompts), each with a time budget; the photo prompt gets 6 s.

**Measured** ([photo-hub.md](https://github.com/Hotragn/flare/blob/main/evals/reports/photo-hub.md), [ladder-agent-hub.md](https://github.com/Hotragn/flare/blob/main/evals/reports/ladder-agent-hub.md)):

| Job | Result |
| --- | --- |
| Photo to invite | 39/40 scenes right, 3.0 s median, valid JSON 20/20 |
| Voice to invite | A 10 s clip became "Meet at the pond bench" in 3.3 s, on my laptop |
| Plan ladder | 13/13 valid |

**What failed.** I wanted the model on the phone, so nothing would leave it. I tried three:

| Model | Where | Result | Shipped? |
| --- | --- | --- | --- |
| Gemma 4 E4B, Q4_K_M | Ollama on my Mac | 20/20 JSON, 39/40 scenes, 3.0 s | Yes |
| Gemma 4 E2B, ONNX q4f16 | Chrome, WebGPU | 2.3 s, but 29/40; it invents water and sunsets | No: it needs a 1.17 GB GPU buffer, and iPhone Safari caps at 1 GiB |
| SmolVLM-500M | Chrome and Safari | 16/40 scenes, 6/20 misleading | No |
| Qwen3-0.6B (conditions) | Safari | 26/40 | No: the rules got 40/40 in under 1 ms |

Sounds of the spot, where Gemma names what you can hear nearby, was cut: it heard birds in nearly every clip and caught 8 of 12 voices at best.

The [AI page](https://flare-outside.onrender.com/ai/) lists what's measured and what isn't shipped; [measured-not-shipped.md](https://github.com/Hotragn/flare/blob/main/docs/ai-runtime/measured-not-shipped.md) has the detail.

### Ollama

Ollama runs Gemma 4 on my Mac. One command pulls a quantised model, and it serves a local HTTP API the hub can call. No GPU server to rent.

The hub talks to Ollama on localhost and to the server over an outbound WebSocket ([ADR-0006](https://github.com/Hotragn/flare/blob/main/docs/architecture/adr/0006-hub-outbound-relay.md)). The hub dials out, so no port is open on my Mac.

On my busy laptop, a 5-photo check had a 4.0 s median and one photo took 11.9 s ([photo-hub.md](https://github.com/Hotragn/flare/blob/main/evals/reports/photo-hub.md)).

One snag: the first image call after a load was slow, so the hub warms up with the real system prompt before timed runs ([warm-image.ts](https://github.com/Hotragn/flare/blob/main/apps/hub/src/warm-image.ts)).

### Google AI Studio

AI Studio answers when my laptop is off. It serves Gemma 4 too, so the fallback is the same model family, with the same prompts and the same guards.

I use Gemma 4 26B A4B with `GEMINI_API_KEY` on Render ([ADR-0026](https://github.com/Hotragn/flare/blob/main/docs/architecture/adr/0026-google-ai-studio-cloud-tier.md)), with `thinkingLevel` set to minimal. That gets 1.4 s per Plan. With the default thinking, it took 21.7 s and gave no answer. That one flag is the difference between a fallback and a hang.

### Mastra

An agent drafts the Plan ladder with four local tools: sunset, weather window, nearby places and step templates. The ladder is a small tool-using task, and Mastra gave me tools, a model call and tracing in one place, in TypeScript, next to the rest of the server.

The agent lives in [apps/server/src/agent/ladder-agent.ts](https://github.com/Hotragn/flare/blob/main/apps/server/src/agent/ladder-agent.ts), behind a flag, with the decision in [ADR-0025](https://github.com/Hotragn/flare/blob/main/docs/architecture/adr/0025-mastra-plan-agent.md). It's been live since Oct 12.

**Measured** ([ladder-agent-hub.md](https://github.com/Hotragn/flare/blob/main/evals/reports/ladder-agent-hub.md)). Two runs of 13 asks, agent vs old route: 5.1 vs 5.5 s p95, then 5.6 vs 5.3 s. The weather was right 7/7. So the agent costs about nothing in speed and adds the weather.

The first live draft took 10.6 s, a cold start. Sentry flagged it as 271% over its 2.85 s average.

### Tinker

I used Tinker to teach the phone's conditions parser (the rules that read "after 10" or "only with Amor") more phrasings. With it I could train a small LoRA (a cheap add-on layer for a model) without owning a GPU, and compare it to the rules on a blind set.

[ml/tinker/](https://github.com/Hotragn/flare/tree/main/ml/tinker) holds the data generator, the rules bridge and a fresh held-out set; the model card is [model-card-conditions-lora.md](https://github.com/Hotragn/flare/blob/main/docs/ml/model-card-conditions-lora.md).

**Measured** ([conditions-tinker.md](https://github.com/Hotragn/flare/blob/main/evals/reports/conditions-tinker.md)). A $2.40 Qwen3.5-4B LoRA read 38 of 40 new phrasings. It's too big for a phone, so it didn't ship. Instead I studied its phrasing families and the rules' misses, and taught the rules ([6a73941](https://github.com/Hotragn/flare/commit/6a73941)). The rules went from 20/40 to 30/40 on the blind set, and they still run on the phone in under a millisecond.

### ElevenLabs

ElevenLabs gives the compass a warm voice. The phone's built-in speech varies a lot between devices. A recorded voice sounds the same on every phone and needs no signal.

I recorded 54 compass lines once, 698 characters, shipped as files and played offline ([ADR-0027](https://github.com/Hotragn/flare/blob/main/docs/architecture/adr/0027-elevenlabs-voice.md), [compass/voice.ts](https://github.com/Hotragn/flare/blob/main/apps/web/src/lib/compass/voice.ts)). No user data goes to ElevenLabs.

What went wrong: voice input with Scribe (ElevenLabs' speech to text) is off, because the iPhone recorder failed before any upload. The server code works, though. Below is what it makes from a clip I recorded on my phone (Voice Memos) and ran through the same server code on my laptop, and from a public meeting recording:

![A Remember this card from a 46 s recording in Telugu and English](https://flare-outside.onrender.com/post/day-card.png)

*The phone's recorder failed, so here is what the same server code makes from a 46 s recording of me in Telugu and English: Scribe 1.5 s, Gemma's line 2.8 s. Gemma's line is close but calls it a discussion and a device.*

![A Remember this card from a public meeting recording](https://flare-outside.onrender.com/post/day-card-ami.png)

*The same code on 45 s of a public meeting recording (AMI Meeting Corpus, ES2002a, CC BY 4.0): Scribe found 2 speakers in 1.7 s, and Gemma's line took 2.3 s.*

### Sentry Agent Tracing

Sentry shows each AI job as a trace: every tool, the model call and the guard, with timings. I needed to see where an AI job spends time on the live server, without sending our words anywhere.

The setup is in [apps/server/src/tracing.ts](https://github.com/Hotragn/flare/blob/main/apps/server/src/tracing.ts). Tracing starts only with a real DSN, and a test fails if our words or ids reach Sentry ([ADR-0021](https://github.com/Hotragn/flare/blob/main/docs/architecture/adr/0021-sentry-agent-tracing.md)).

Here's one trace from the live server:

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

The agent span's input panel reads "No input for this span". That's what I wanted: Sentry gets names and times, never what people wrote.

It caught two things. The 10.6 s cold start, 271% over the 2.85 s average. And agent spans sharing a parent trace: the root shows as `http.server GET:health` with 110 spans, so the agent jobs ended up inside one long-lived trace. Giving each AI job its own trace is on my next-steps list.

### Telegram

Telegram puts Flare in the group chat. Its Bot API lets a bot post a card and delete it later, which a WhatsApp link can't do.

The bot lives in [apps/server/src/telegram/](https://github.com/Hotragn/flare/tree/main/apps/server/src/telegram), using the webhook on Render ([ADR-0023](https://github.com/Hotragn/flare/blob/main/docs/architecture/adr/0023-telegram-card-and-photo-opt-in.md)). The card shows the six words, the spot and the host's first name, never who said yes. It's deleted at Gone. Try [@FairlaneFlareBot](https://t.me/FairlaneFlareBot).

### Render

Render hosts everything that isn't a model. The server, the Mastra agent, the deletion sweeper, Postgres and the Telegram webhook run on Render's free tier ([ADR-0005](https://github.com/Hotragn/flare/blob/main/docs/architecture/adr/0005-hosting-render-https.md), [deploy-render.ts](https://github.com/Hotragn/flare/blob/main/scripts/deploy-render.ts)). The models don't.

The catch: the free tier has no cron, and it sleeps. So the sweeper runs at boot, and a server that wakes up deletes anything past its end at once. The app shows "Waking up" during a cold start ([599ead2](https://github.com/Hotragn/flare/commit/599ead2)).

### Entire

Entire records each agent session alongside git. A checkpoint is a saved slice of a session: the prompts, the tool calls and the token use that led to a commit. Each commit then carries an `Entire-Checkpoint:` trailer pointing at it. A real one, from commit 94601f9:

```
README: post-deadline commit hashes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Entire-Checkpoint: 01M4QFQCN2SGWV1CPXVJGGSE2F
```

**Provenance.** 224 commits on main carry an Entire-Checkpoint trailer, starting at 2:27 AM on Oct 11. So for most of the code, you can trace a line back to the session that wrote it.

**Cost accounting.** The 828M tokens and 99.2% cache replay above came from `entire checkpoint tokens`. They explain why the nine parallel subagents had burned my usage limit early on.

**A privacy gate for sessions.** Sessions are full of things that shouldn't be public. [scripts/scan-sessions.ts](https://github.com/Hotragn/flare/blob/main/scripts/scan-sessions.ts) runs in the pre-push hook. Its public dry run found 1,539 email and 22 phone-number matches in 101 of 166 checkpoints, and 0 secrets. Tonight a scrubber rewrote all 266 checkpoints and recomputed each `content_hash`, and `entire configure --skip-push-sessions` stops uncleaned sessions being pushed ([da538c0](https://github.com/Hotragn/flare/commit/da538c0)).

### DevRelay

DevRelay hosts the agent sessions embedded [below](#my-agent-session).

### Not claimed

- **DigitalOcean**: wired in as a cloud tier ([ADR-0022](https://github.com/Hotragn/flare/blob/main/docs/architecture/adr/0022-digitalocean-cloud-tier.md)), but the account's billing is paused, so it isn't live.
- **MongoDB**: not used. Flare stores its data in Postgres.

## Why Does Open Innovation Matter?

There's an irony in this stack. All of it (the models, the agent, the sealing, the sweeper) exists to remove one small anxiety: asking a friend to come out. Open models let me build something complex enough that the tech disappears and only the meetup is left. They also let me put each piece where it belongs:

- Gemma 4 E4B (about 4B effective parameters) runs on my laptop and does the photo and voice work.
- Gemma 4 26B A4B runs in Google's cloud, only as the fallback when my laptop is off.
- One Mastra agent with four tools drafts the Plan ladder; it's one agent, not four.
- The rules engine for conditions runs on the phone, with no model at all.

Here's where open beat closed, in ways you can check:

- **Cost.** A photo costs me $0. Gemma 4 runs on a laptop I already own.
- **Privacy.** The photo and voice go only to my laptop, and only in memory. A closed API would mean sending a picture of where my friends are to a vendor.
- **Checkable.** The privacy promise is not a policy page. Anyone can read [/api/v1/audit](https://flare-outside.onrender.com/api/v1/audit), and anyone can read the code that deletes.
- **Debuggable.** When Gemma 4 E2B failed on iPhone Safari, I could see why: a 1.17 GB GPU buffer over a 1 GiB cap. With a closed model on a closed runtime, I'd have had an error and a guess.

Where closed would win is speed. On my busy laptop, the 5-photo check had a 4.0 s median and one photo took 11.9 s. A hosted model would be faster and steadier. That's what the cloud fallback is for, and it's still Gemma.

## What I got wrong

My own test found the hardest ones:

- **As the host, after sending, all I could see was a lot of animation.** It was unclear whether my friends would come, and whether ElevenLabs had worked.
- **"Pocket it" felt like a button I had to press.** Nothing said to wait until my friend arrives, or that the app should stay open even in my pocket.
- **On the friend's side, it showed the place and buttons to finish fast,** without saying what each step is for.
- **Remember this passed every automated check, then failed on my iPhone:** "Couldn't write it down." The logs show no upload. My tests had faked the mic. "Say it" for a Spark failed the same way in Safari, so both are off. I expected a card of the day, with the voice only by choice.

The lesson from Remember this: a test that fakes the mic proves the server, not the phone. Every automated check passed, and the first real iPhone failed in a minute.

The field-test bugs are in the table above. The one I'm most embarrassed by is the photo covered by words. The whole idea starts with a photo, and my own invite hid it.

Round 6 of the fresh-eyes testers caught 4 more before the freeze: the invite lost on reload, "Sent." shown before sharing, size buttons hidden at 375x667, and location asked twice ([6ff2383](https://github.com/Hotragn/flare/commit/6ff2383), [72ade11](https://github.com/Hotragn/flare/commit/72ade11)).

## What it can't do yet

- **The 48-friend run is a Simulation,** and the app labels it so. Made-up friends, real server.
- **Untested on a trail** or over a real satellite link. The 200-byte text fits, but I haven't sent one from where the signal ends.
- **Voice input was tested only in desktop browsers.** It failed twice on an iPhone.
- **On an iPhone, the compass stops when the screen locks.** An iPhone web app gets no background location.
- **In a small group, the count can give away who said yes.** If two people were invited and the count is 1, you can guess.

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

- **Overall:** I'm entering Flare for the overall prize too.
- **Best Use of Gemma:** Gemma 4 sees (39/40), hears (3.3 s) and writes the Plan ladder (13/13), with code checking every answer. [Details](#gemma-4)
- **Best Use of Tinker:** a $2.40 LoRA read 38/40, and its mistakes taught the phone's rules from 20/40 to 30/40, blind. [Details](#tinker)
- **Best Use of ElevenLabs:** a compass voice for 698 characters that plays offline and sends nothing. [Details](#elevenlabs)
- **Best Use of Mastra:** a four-tool Plan agent, live, with p95 within 0.3 s of the old route and the weather right 7/7. [Details](#mastra)
- **Best Use of Sentry Agent Tracing:** every tool, model call and guard timed, our words never sent, and a cold start caught. [Details](#sentry-agent-tracing)
- **Best Use of Render:** the server, agent, sweeper, Postgres and Telegram webhook on the free tier, with deletion that survives sleep. [Details](#render)
- **Best Use of Entire:** provenance on every commit, the token count that explains how I staffed the build, and a privacy gate for sessions. [Details](#entire)

## Updated after the deadline (Oct 12, 3 AM ET)

This is a detailed rewrite of the published post, in first person. The facts are the same. What's new: how I built it (the planning sprint and the sprint table), a section per tool in one pattern, the field-test failure table with commit links, the losses up front, the two Remember this day cards, and the agent sessions.

After the deadline I also cleaned and published the agent sessions and Entire checkpoints, and made the repo public.
