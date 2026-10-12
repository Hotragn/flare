---
title: "Flare: snap where you are, and it only lights if enough friends quietly say yes"
published: false
tags: devchallenge, hf26challenge, gemma, opensource
---

<!-- DRAFT for the founder. Every [CAPS: ...] hole is yours to fill or delete before publishing:
     FOUNDER WHY, FRIEND QUOTE, HERO GIF, WHY IT MATTERS, FIELD (met in person?), FIELD (outdoor test),
     VIDEO, SENTRY TRACE, AGENT SESSION, ENTIRE, THANKS, and the repo line.
     Prose is 1,765 words without the holes: keep everything you add under about 135 words.
     Images: upload the files in docs/post/media/ in DEV's editor and replace each path.
     Every number is measured, and its proof is named or linked. Remove this comment before publishing. -->

*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 1: Touch Grass](https://dev.to/challenges/hacktoberfest-week1-2026-10-05).*

## What I Built

It's 4 PM on a Saturday. Someone in the group chat writes "we should go for a walk". Three people react with a thumbs up. Nobody goes.

[FOUNDER WHY: the founder writes this tonight, in their own words]

[FRIEND QUOTE: the friend's real words and screenshot, with their OK]

Almost every entry this week is one person on one walk. Flare gets a group out. You take a photo of where you are, and Gemma 4, an open model on our own laptop, writes the invite: "Meet by the quiet water's edge". Friends tap **I'm in** in private, and everyone sees the count, never who. It lights only if enough can come. If too few say yes in 30 minutes, it shrinks to a smaller plan, like 15 minutes at a bench nearby, instead of dying. Afterwards it shows your minutes outside together and deletes itself.

For a friend with low vision, Gemma turns the photo into a line their screen reader speaks. When it lights, the compass talks them in, and if a photo isn't possible, they say where they are instead.

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
| AI testers with no context | 5, 6, 5, 6, 6, 6, then 7 out of 10 over 7 rounds | [Testing](#how-i-tested-it) |

## Demo

- **Try it with no setup:** [flare-outside.onrender.com/app/demo/](https://flare-outside.onrender.com/app/demo/). Nothing is sent. In 60 seconds: tap I'm in as Amor, Skip 30 min to watch it shrink, then Find them.
- **The app:** [flare-outside.onrender.com/app/](https://flare-outside.onrender.com/app/). **The site:** [flare-outside.onrender.com](https://flare-outside.onrender.com/), Lighthouse 100 on all five pages.
- **Telegram:** [@FairlaneFlareBot](https://t.me/FairlaneFlareBot).
- **Video:** [VIDEO: 60 to 90 s screen recording, see docs/post/shot-list.md]

One evening, in four frames:

![Kindling, Lit, Ember, Gone: one evening in Flare](docs/post/media/21-storyboard.png)

### How I tested it

**Field test 1, Sun Oct 11, 8:20 PM:** a real Flare to 2 real friends on the live app: 3 responses, 1 Spark, the live audit passing, 6 bugs found and fixed below. [FIELD: met in person?]

**Field test 2, Mon Oct 12, 12:38 AM:** sent, a yes at 12:39 (it needed 2, so it lit), I'm here at 12:40, Remember this agreed at 12:41 and the mic failed on my iPhone, We're done at 12:43, deleted on time. [FIELD: outdoor meetup?]

| What | How | Result |
| --- | --- | --- |
| The full loop | Chrome at iPhone size against the real server, the real Gemma 4 hub and Postgres | 10 end-to-end suites pass, including the field run (27/27) |
| Real phones | A device-check page on an iPhone 16 Pro Max and an iPhone 13: compass, haptics, sound | 3 compass bugs found and fixed |
| Simulation: 48 friends | 48 made-up friends in 4 groups against the real server ([GIF](docs/post/media/sim/fairlane-sim-42.gif)) | 11 of 12 lit; median 14.75 min to Lit; all 12 deleted after, audit pass |
| Accessibility | axe on 88 page views (22 pages, 2 widths, light and dark) | 0 findings; every target 44 px or more |

The fresh-eyes testers are AI agents, not people: a new one with no context each round, on the live site as a phone.

| Round | 1 | 2 | 3 | 4 | 5 | 6 |
| --- | --- | --- | --- | --- | --- | --- |
| Score out of 10 | 5 | 6 | 5 | 6 | 6 | 6 |

Round 6 scored 6/10 on live 68afd9b, and a recheck after its fixes scored 7/10. On a WhatsApp poll, the AI tester said:

> For a quick "anyone free for a walk now?", maybe. The private yes and the "only happens if enough come" rule are real wins over a poll, where everyone sees who said no. For a normal meetup I'd still use the WhatsApp poll. It sits inside the chat where everyone already is, it's never lost, and nobody needs to keep a tab open with the sound on. Here, losing my own invite on reload would put me off for good.

That's the honest position. Flare is for "anyone free right now?". A poll still wins for a planned meetup. Today, Telegram is how Flare lives inside the chat.

## Code

{% github Hotragn/flare %}

[REPO: delete this line once the repo is public.] AGPL-3.0. Using Flare needs nothing, and hosting your own copy has three levels: no AI keys (you write the words), a free Google AI Studio key (Gemma 4 in the cloud), or Ollama on your own machine (the photo never leaves it).

## How I Built It

### Method

I'm one founder running Claude Code sessions in roles: research, product, design, architecture, specialists, QA. A manager session set the order, and each role left a handoff for the next. The architect froze [14 interfaces](https://github.com/Hotragn/flare/blob/main/docs/engineering/02-interface-control.md) first, so specialists built against contracts. Decisions live in 31 ADRs, and 159 requirements are traced to code and tests by [`trace.py`](https://github.com/Hotragn/flare/blob/main/docs/requirements/tools/trace.py). Every push runs a secret scan, lint, types (with svelte-check), 775 unit and contract tests and the build.

**Disclosure:** I built this with Claude Code. The manager session, acting as CTO for me, sent many of the prompts. Product and privacy decisions were mine, and anything public waited for my yes.

### Architecture

![The phone, the server on Render, and our laptop running Gemma 4](docs/post/media/20-architecture.png)

The phone talks only to the server on Render. Our Mac dials out over a WebSocket, so nothing on it is open to the internet. When the Mac is off, Gemma 4 on Google AI Studio answers.

### Gemma 4 sees, hears and writes

The photo goes to **Gemma 4 E4B** (`gemma4:e4b-it-q4_K_M`) on **Ollama**: 20/20 valid JSON, 39/40 scenes right, 3.0 s median. It also writes Plan ladders: 13/13 valid, p95 5.5 s.

It also hears 16 kHz WAV in the same `images` field: a 10 s Voice Flare becomes "Meet at the pond bench" in 3.3 s, on our laptop.

Measured on one test set:

| Model | Where | Result | Shipped? |
| --- | --- | --- | --- |
| Gemma 4 E4B, Q4_K_M | Ollama on the Mac | 20/20 JSON, 39/40 scenes, 3.0 s | Yes |
| Gemma 4 E2B, ONNX q4f16 | Chrome, WebGPU | 2.3 s, but 29/40; it invents water and sunsets | No: needs a 1.17 GB GPU buffer, iPhone Safari caps at 1 GiB |
| SmolVLM-500M | Chrome and Safari | 16/40 scenes, 6/20 misleading | No |
| Qwen3-0.6B (conditions) | Safari | 26/40 | No: rules got 40/40 in under 1 ms |

Gemma 4 E4B heard birds in almost everything and caught 8 of 12 voice clips at best, so Sounds of the spot didn't ship.

**The model picks the words; code owns the facts.** Every answer passes `enforce()` before anyone sees it: six words at most, no names, no invented places. If it's slow or fails, you type. Nobody waits on the AI.

### The rest of the stack

- **Google AI Studio.** Gemma 4 26B A4B covers for our laptop: 1.4 s a Plan draft with `thinkingLevel: "minimal"`, against 21.7 s and no answer by default. DigitalOcean is wired in, paused for billing.
- **Mastra.** An agent drafts the Plan ladder with four local tools. On 13 asks: p95 5.1 s against 5.5 s, weather 7/7. On live since Oct 12.
- **Tinker.** The phone's rules read 15/40 new phrasings. A Qwen3.5-4B LoRA (about $2.40) read 38/40 but can't run on the phone, so its errors taught the rules: 20/40 to 30/40, blind.
- **ElevenLabs.** 54 compass lines recorded once: 698 characters, offline, no names. Voice Spark sends 10 s of your own voice to Scribe on a tap. No audio kept.
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
- **Since launch** totals on the site, with no ids.
- **The motion:** a spark per yes, the lighting, the shrink and Gone. 60 fps at 4x CPU in Chrome (host's lit 58.6), not an iPhone trace.

![A Flare shrinks to an Ember, then lights](docs/post/media/app-motion/after/4-shrink-then-lit.gif)

## What I got wrong

My own test found the hardest ones:

- **As the host, after sending, all I could see was a lot of animation.** It was unclear whether my friends would come, and whether ElevenLabs had worked.
- **"Pocket it" felt like a button I had to press.** Nothing said to wait until my friend arrives, or that the app should stay open even in my pocket.
- **On the friend's side, it showed the place and buttons to finish fast,** without saying what each step is for.
- **Remember this passed every automated check and failed on my iPhone.** On live, two test browsers, a real Scribe call and the sealed note all passed. On my iPhone, Record said "Couldn't write it down." The server logs show no upload: the mic or recorder failed on the phone, and my tests had faked the mic. It's off. What I expected was a neat card of what we said, a summary of the day, with the voice attached only if I want it.

Field test 1 found these:

- **The headline and sheet covered the photo,** 73% of it. Now 0%, and a new `e2e:photo-fit` gate checks 3 viewports with a dark photo.
- **"After 10min" read as 10 AM.** Now "you can come in 10 min", and missed words are said back. Blind set: 30/40, unchanged.
- **"Fuego is at Near Heather Drive."** Now "is near".
- **Share did nothing in Brave:** the tap was lost after an await. It runs in the tap now, with Copy link as a fallback (WebKit tested, not a real iPhone).
- **"We'll buzz you" with no push.** That line now shows only with a live subscription.
- **Returning phones got old pages** from the service worker. Now network first, and a new worker takes over at once (two-build test, 8/8).
- **Round 6 caught 4 more,** fixed before the freeze: the invite lost on reload, "Sent." before sharing, size buttons hidden at 375×667 (a new gate failed before the fix, passes now), and location asked twice.

## Honest limits

- **No background location or mic.** An iPhone web app can't use either.
- **No server pushes for golden hour or a weekly recap.** The server never knows where a crew is or its time zone.
- **One real group so far,** and I can't yet say it met in person.
- **In a small group, the count can give away who said yes.**

## Next steps

- Once it's lit, show the host who's coming, with each yes-sayer's OK.
- A clear host status line: "1 friend coming. Keep Flare open; your phone can stay in your pocket."
- Remember this as a day card, with the voice only by choice.
- "My usual" conditions you save once.
- Plans that repeat every week.
- Golden-hour nudges inside the app.

## Why Does Open Innovation Matter?

A photo of where you stand, or your voice, is about as personal as data gets; with an open model it goes only to our laptop and is gone after the call. It costs $0 a photo, and open let me see why the small model failed on an iPhone (a 1.17 GB buffer). Open lost on speed on a busy laptop, which is what the fallback is for.

## My Agent Session

[AGENT SESSION: the DevRelay embed, made public after the scrub (scripts/scan-sessions.ts --public)]

[ENTIRE: the checkpoint links for the same session]

## Prize Categories

- **Gemma:** sees (39/40), hears (3.3 s) and writes, with code checking every answer. [Details](#gemma-4-sees-hears-and-writes)
- **Tinker:** a $2.40 LoRA read 38/40 and taught the rules 20/40 to 30/40, blind. [Details](#the-rest-of-the-stack)
- **ElevenLabs:** a compass voice for 698 characters that sends nothing. [Details](#the-rest-of-the-stack)
- **Mastra:** four local tools, p95 5.1 s vs 5.5 s, weather 7/7. On live since Oct 12. [Details](#the-rest-of-the-stack)
- **Sentry Agent Tracing:** every AI job traced, under an allow-list a test proves. [Details](#the-rest-of-the-stack)
- **Entire:** [ENTIRE: one line with the session links]

[THANKS: name anyone who tried it, with their OK, or delete this line]
