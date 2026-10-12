---
title: "Flare: snap where you are, and it only lights if enough friends quietly say yes"
published: false
tags: devchallenge, hf26challenge, gemma, opensource
---

<!-- DRAFT for the founder. Every [CAPS: ...] hole is yours to fill or delete before publishing:
     FOUNDER WHY, FRIEND QUOTE, HERO GIF, WHY IT MATTERS, FIELD (met in person?), ROUND 6,
     VIDEO, MASTRA LIVE, SENTRY TRACE, AGENT SESSION, ENTIRE, THANKS, and the repo line.
     Prose is 1,713 words without the holes: keep everything you add under about 185 words.
     Images: upload the files in docs/post/media/ in DEV's editor and replace each path.
     Every number is measured, and its proof is named or linked. Remove this comment before publishing. -->

*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 1: Touch Grass](https://dev.to/challenges/hacktoberfest-week1-2026-10-05).*

## What I Built

It's 4 PM on a Saturday. Someone in the group chat writes "we should go for a walk". Three people react with a thumbs up. Nobody goes.

[FOUNDER WHY: the founder writes this tonight, in their own words]

[FRIEND QUOTE: the friend's real words and screenshot, with their OK]

Almost every entry this week is one person on one walk. Flare gets a group out. You take a photo of where you are, and Gemma 4, an open model on our own laptop, writes the invite: "Meet by the quiet water's edge". Friends tap **I'm in** in private, and everyone sees the count, never who. It lights only if enough can come. If too few say yes in 30 minutes, it shrinks to a smaller plan, like 15 minutes at a bench nearby, instead of dying. Afterwards it says how long you were outside together, then deletes itself.

For a friend with low vision, Gemma turns the photo into a line their screen reader speaks. When it lights, the compass talks them in ("150 meters, slightly left"), and if a photo isn't possible, they say where they are instead.

**Nothing to install.** You and your friends open a link. Gemma runs on our laptop, so nobody needs a GPU, a key or an account.

[HERO GIF: Kindling, Lit, Ember, Gone]

### Why it matters

A plan in a group chat dies when nobody wants to be the one who says yes first, and Flare's private count is built for exactly that.

[WHY IT MATTERS: one chart and its sources, from the site's verified section]

### At a glance

| What happens | Measured | Proof |
| --- | --- | --- |
| A photo becomes the invite and a line to hear | 39/40 scenes right, 3.0 s median, Gemma 4 E4B | [Gemma](#gemma-4-sees-hears-and-writes) |
| You say it instead, and Gemma writes it | 3.3 s, no audio kept | [Gemma](#gemma-4-sees-hears-and-writes) |
| A plan that gets smaller instead of failing | 11 of 12 lit (Simulation: 48 friends) | [Testing](#how-i-tested-it) |
| Everything about the meetup deleted | within 5 min; worst case 90 s | [Privacy](#privacy-built-in) |
| Real friends on the live app | 3 people, 1 gathering, live audit pass | [Testing](#how-i-tested-it) |
| Strangers with no context | 5, 6, 5, 6, 6 out of 10 over 5 rounds | [Testing](#how-i-tested-it) |

## Demo

- **Try it with no setup:** [flare-outside.onrender.com/app/demo/](https://flare-outside.onrender.com/app/demo/). The real rules engine runs in your browser, and nothing is sent. In 60 seconds: tap I'm in as Amor, Skip 30 min to watch it shrink, then Find them.
- **The app:** [flare-outside.onrender.com/app/](https://flare-outside.onrender.com/app/). **The site:** [flare-outside.onrender.com](https://flare-outside.onrender.com/), Lighthouse 100 in all four categories on all five pages.
- **Telegram:** [@FairlaneFlareBot](https://t.me/FairlaneFlareBot). Add it to a group chat from the app's "Post in Telegram" screen.
- **Video:** [VIDEO: 60 to 90 s screen recording, see docs/post/shot-list.md]

One evening, in four frames:

![Kindling, Lit, Ember, Gone: one evening in Flare](docs/post/media/21-storyboard.png)

### How I tested it

**Field test 1, Sun Oct 11, 8:20 PM:** I sent a real Flare to 2 real friends on the live app. 3 people, 1 gathering, 3 responses and 1 Spark, the live audit passing at 8:36 PM, and 6 bugs found, all fixed below. [FIELD: met in person?]

| What | How | Result |
| --- | --- | --- |
| The full loop | Chrome at iPhone size against the real server, the real Gemma 4 hub and Postgres | 10 end-to-end suites pass, including the field run (27/27) |
| Real phones | A device-check page on an iPhone 16 Pro Max and an iPhone 13: compass, haptics, sound | 3 compass bugs found and fixed |
| Simulation: 48 friends | 48 made-up friends in 4 groups against the real server ([GIF](docs/post/media/sim/fairlane-sim-42.gif)) | 11 of 12 lit; median 14.75 min to Lit; all 12 deleted after, audit pass |
| Accessibility | axe on 88 page views (22 pages, 2 widths, light and dark) | 0 findings; every target 44 px or more |

Each fresh-eyes round put a new tester with no context on the live site, as a phone:

| Round | 1 | 2 | 3 | 4 | 5 | 6 |
| --- | --- | --- | --- | --- | --- | --- |
| Score out of 10 | 5 | 6 | 5 | 6 | 6 | [ROUND 6] |

[ROUND 6: the final fresh-eyes score and the WhatsApp-poll answers, quoted word for word]

## Code

{% github Hotragn/flare %}

[REPO: delete this line once the repo is public.] AGPL-3.0. Using Flare needs nothing, and hosting your own copy has three levels: no AI keys (you write the words), a free Google AI Studio key (Gemma 4 in the cloud), or Ollama on your own machine (the photo never leaves it).

## How I Built It

### Method

I'm one founder. I ran Claude Code sessions in roles: research, product, design, architecture, then specialists and QA. A manager session set the order of work, and each role left a handoff in the repo for the next. Before the parallel work started, the architect froze 14 interfaces in [an interface control document](https://github.com/Hotragn/flare/blob/main/docs/engineering/02-interface-control.md), so specialists built against contracts and fakes instead of each other's code. Decisions live in 31 ADRs, and 159 requirements are traced to code and tests by [`trace.py`](https://github.com/Hotragn/flare/blob/main/docs/requirements/tools/trace.py). Every push runs a secret scan, lint, types (with svelte-check), 775 unit and contract tests and the build. Each fresh-eyes round was the sprint review, and its worst issues became the next sprint.

**Disclosure:** I built this with Claude Code. The manager session, acting as CTO for me, sent many of the prompts. Product and privacy decisions were mine, and anything public waited for my yes.

### Architecture

![The phone, the server on Render, and our laptop running Gemma 4](docs/post/media/20-architecture.png)

The phone talks only to the server on Render. Our Mac dials out over a WebSocket, so nothing on it is open to the internet. When the Mac is off, Gemma 4 on Google AI Studio answers.

### Gemma 4 sees, hears and writes

The photo goes to **Gemma 4 E4B** (`gemma4:e4b-it-q4_K_M`) on **Ollama**: 20/20 valid JSON, 39/40 scenes right, 3.0 s median. It also writes Plan ladders: 13/13 valid, p95 5.5 s.

The audio surprised me: it hears 16 kHz WAV passed in the same `images` field a photo uses. A 10 s Voice Flare becomes "Meet at the pond bench" in 3.3 s, and the voice never leaves our laptop.

I picked the model by measuring the options on one test set, and the smaller ones lost:

| Model | Where | Result | Shipped? |
| --- | --- | --- | --- |
| Gemma 4 E4B, Q4_K_M | Ollama on the Mac | 20/20 JSON, 39/40 scenes, 3.0 s | Yes |
| Gemma 4 E2B, ONNX q4f16 | Chrome, WebGPU | 2.3 s, but 29/40; it invents water and sunsets | No: needs a 1.17 GB GPU buffer, iPhone Safari caps at 1 GiB |
| SmolVLM-500M | Chrome and Safari | 16/40 scenes, 6/20 misleading | No |
| Qwen3-0.6B (conditions) | Safari | 26/40 | No: rules got 40/40 in under 1 ms |

Gemma 4 E4B heard birds in almost everything and caught 8 of 12 voice clips at best, so Sounds of the spot didn't ship.

**The model picks the words; code owns the facts.** Every answer passes `enforce()` before anyone sees it: six words at most, no names, no invented places. If the model is slow or the answer fails, the app shows typed words. Nobody waits on the AI.

### The rest of the stack

- **Google AI Studio.** Gemma 4 26B A4B covers for our laptop. It thinks first by default: a Plan draft took 21.7 s with no answer. With `thinkingLevel: "minimal"`, 1.4 s. Photos go only on the host's tap. DigitalOcean is wired in, paused for billing.
- **Mastra.** An agent drafts the Plan ladder with four local tools (sunset, weather, nearby places, step templates). On 13 asks: p95 5.1 s against 5.5 s, weather 7/7, 12 ms of overhead.
- **Tinker.** The phone's rules read 15/40 new condition phrasings. A Qwen3.5-4B LoRA (3,000 examples, 6 minutes, about $2.40) read 38/40 but can't run on the phone, so its errors taught the rules: 20/40 to 30/40, blind.
- **ElevenLabs.** 54 compass lines recorded once: 698 characters, 684 KB, offline, no names. Voice Spark sends up to 10 s of your own voice to Scribe on a tap (0.72 s). No audio kept.
- **Sentry.** Agent Tracing follows every AI job, model call and guard. Only tier, model, timing, ok and error class leave the server, and a test fails if marker phrases or UUIDs reach Sentry.
- **Telegram.** The bot posts a card drawn in 15 to 60 ms, with no names, and deletes it at Gone. Real-stack test: 14/14.
- **Entire.** [ENTIRE: one line with the checkpoint links and what they show]

[SENTRY TRACE: a screenshot of a live trace, a Plan draft with the hub away, `gen_ai.provider.name: google`, and its latency]

### Privacy, built in

- **The count, never who.** The server sees counts and labels like `c3`.
- **The key lives in the link.** It sits in the `#fragment`, which browsers never send. Names, places, photos and Sparks are sealed on the phone with AES-256-GCM.
- **Gone within 5 minutes.** The Flare, its photo and every yes; worst case 90 s, checked by an audit route.
- **Preview cards carry nothing.** The brand card and a count: no photo, place or words.

### New tonight

- **Again** on Home sends the last Flare again in one tap.
- **Telegram-linked Send** posts straight to the group chat.
- **I'm here by itself** within 30 m of the spot, with a 10 s Undo.
- **Rule chips** fill a condition with a tap.
- **Since launch** totals on the site come from `GET /api/v1/stats`, which holds no ids.
- **The motion:** sparks for each yes, the lighting, the shrink to an Ember and Gone. All run at 60 fps at 4x CPU slowdown in Chrome, except the host's lit at 58.6. That is not an iPhone trace.

![A Flare shrinks to an Ember, then lights](docs/post/media/app-motion/after/4-shrink-then-lit.gif)

**Remember this** stays off. A conversation note needs everyone's yes on their own phone, and I want a real group to try that rule before it ships.

## What I got wrong

Field test 1 found these first:

- **The headline and sheet covered the photo,** 73% of it. Now 0%, and a new `e2e:photo-fit` gate checks 3 viewports with a dark photo.
- **"After 10min" read as 10 AM.** It now reads "you can come in 10 min", and words the parser misses are said back. The blind set stays 30/40.
- **"Fuego is at Near Heather Drive."** Now "is near".
- **Share did nothing in Brave.** The tap's activation was lost after an await. Share now runs in the tap, with a Copy link fallback, tested in WebKit but not on a real iPhone.
- **"We'll buzz you" with no push.** That line now shows only with a live subscription.
- **Returning phones got old pages** from the service worker. Pages now load network first and the new worker takes over at once (two-build test, 8/8).

Before that: the compass showed no arrow and said "close" 49 times on one walk, and DigitalOcean's billing block sent me to Google AI Studio.

## Honest limits

- **No background location or mic.** An iPhone web app can't use either.
- **No server pushes for golden hour or a weekly recap.** The server never knows where a crew is or its time zone.
- **One real group so far,** and I can't yet say it met in person.
- **In a small group, the count can give away who said yes.** If two people are invited and the count says 1, you can guess.

## Next steps

- "My usual" conditions you save once.
- Plans that repeat every week.
- Golden-hour nudges inside the app.

## Why Does Open Innovation Matter?

A photo of where you stand, or your voice saying it, is about as personal as data gets. The friend with low vision who says where they are sends that voice only to an open model on our own laptop, where it lives in memory and is gone after the call. A free app can't pay per call either: the laptop costs $0 per photo. And open let me look inside: I saw why the small model failed on an iPhone (a 1.17 GB buffer). Open lost on speed on a busy laptop, which is what the fallback is for.

## My Agent Session

[AGENT SESSION: the DevRelay embed, made public after the scrub (scripts/scan-sessions.ts --public)]

[ENTIRE: the checkpoint links for the same session]

## Prize Categories

- **Gemma:** sees (39/40), hears (3.3 s) and writes, with code checking every answer. [Details](#gemma-4-sees-hears-and-writes)
- **Tinker:** a $2.40 LoRA read 38/40 and taught the rules 20/40 to 30/40, blind. [Details](#the-rest-of-the-stack)
- **ElevenLabs:** a compass voice for 698 characters that sends nothing. [Details](#the-rest-of-the-stack)
- **Mastra:** four local tools, p95 5.1 s vs 5.5 s, weather 7/7. [MASTRA LIVE: keep this line only if the agent is switched on live] [Details](#the-rest-of-the-stack)
- **Sentry Agent Tracing:** every AI job traced, under an allow-list a test proves. [Details](#the-rest-of-the-stack)
- **Entire:** [ENTIRE: one line with the session links]

[THANKS: name anyone who tried it, with their OK, or delete this line]
