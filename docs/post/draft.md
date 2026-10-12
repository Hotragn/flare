---
title: "Flare: snap where you are, and it only lights if enough friends quietly say yes"
published: false
tags: devchallenge, hf26challenge, gemma, opensource
---

<!-- DRAFT for the founder. Every [CAPS: ...] hole is yours to fill or delete before publishing:
     AGENT SESSION, ENTIRE (3 places), and the repo line.
     Images: upload the files in docs/post/media/ in DEV's editor and replace each path.
     Every number is measured, and its proof is named or linked. Remove this comment before publishing. -->

*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 1: Touch Grass](https://dev.to/challenges/hacktoberfest-week1-2026-10-05).*

## What I Built

Flare turns one photo into a plan to meet. You take a photo of where you are, and Gemma 4, an open model on my laptop, writes the invite: "Meet by the quiet water's edge". Friends tap **I'm in** in private, and everyone sees the count, never who. It lights only if enough can come. If too few say yes in 30 minutes, it shrinks to a smaller plan nearby instead of dying. Then it deletes itself.

Most of us have people close by, in group chats and small communities, and we still stay in, because asking means pinging everyone and waiting. I wanted one tap that says "I'm up for meeting, nearby, now." And for someone who's lonely, a quiet way to tell people they trust "I'd like some company," without anyone seeing who said no.

> "Last week I was busy working from home and haven't really got a chance or felt free to go out … I got this and saw that he was nearby next to me and used this, and we met to talk about flare … it really felt this is good for friends and people to go out"
>
> A friend, after field test 2

Of the 813 Week 1 entries I scanned, fewer than 1% get a group out together.

For a friend with low vision, Gemma turns the photo into a line their screen reader speaks, and the compass talks them in.

**Nothing to install.** You and your friends open a link. Gemma runs on my laptop, so nobody needs a GPU, a key or an account.

![A Flare lights on a friend's phone](docs/post/media/app-motion/after/3-lit.gif)

### Why it matters

A plan in a group chat dies when nobody wants to be the one who says yes first, and Flare's private count is built for exactly that.

![Time with friends fell by two thirds from 2003 to 2020: 60 to 20 minutes a day, while time alone rose from 285 to 333](docs/post/media/22-why-friends.png)

*Source: Kannan and Veazie, 2023, [SSM Population Health](https://doi.org/10.1016/j.ssmph.2022.101331), from the American Time Use Survey. More on the [site](https://flare-outside.onrender.com/).*

### At a glance

| What happens | Measured | Proof |
| --- | --- | --- |
| A photo becomes the invite and a line to hear | 39/40 scenes right, 3.0 s median, Gemma 4 E4B | [Gemma](#gemma-4-sees-hears-and-writes) |
| You say it instead, and Gemma writes it | 3.3 s, no audio kept | [Gemma](#gemma-4-sees-hears-and-writes) |
| A plan that gets smaller instead of failing | 11 of 12 lit (Simulation: 48 friends) | [Testing](#how-i-tested-it) |
| Everything about the meetup deleted | within 5 min; worst case 90 s | [Privacy](#privacy-built-in) |
| Real friends on the live app | 3 people, 1 gathering, live audit pass | [Testing](#how-i-tested-it) |

## Demo

- **Try it with no setup:** [flare-outside.onrender.com/app/demo/](https://flare-outside.onrender.com/app/demo/). Nothing is sent. In 60 seconds: tap I'm in as Amor, Skip 30 min to watch it shrink, then Find them.
- **The app:** [flare-outside.onrender.com/app/](https://flare-outside.onrender.com/app/). **The site:** [flare-outside.onrender.com](https://flare-outside.onrender.com/), Lighthouse 100 on all five pages.
- **Telegram:** [@FairlaneFlareBot](https://t.me/FairlaneFlareBot).
- **Small things:** Again resends your last Flare in one tap. I'm here fires by itself within 30 m, with a 10 s Undo.

One evening, in four frames:

![Kindling, Lit, Ember, Gone: one evening in Flare](docs/post/media/21-storyboard.png)

Too few said yes, so it shrinks, then lights: 60 fps at 4x CPU slowdown in Chrome.

![A Flare shrinks to an Ember, then lights](docs/post/media/app-motion/after/4-shrink-then-lit.gif)

### How I tested it

**Field test 1, Sun Oct 11, 8:20 PM:** a real Flare to 2 real friends on the live app: 3 responses, 1 Spark, the live audit passing, 6 bugs found and fixed below.

**Field test 2, Mon Oct 12, 12:38 AM,** the first real meetup: sent, a nearby friend's yes at 12:39 (it needed 2, so it lit), I'm here at 12:40, Remember this agreed at 12:41 and the mic failed on my iPhone. We met in person and talked; We're done at 12:43, and it was gone from the public audit within 2 minutes ([notes](https://github.com/Hotragn/flare/blob/main/docs/research/field-test-2.md)).

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

Round 6 scored 6/10 on live 68afd9b, and a recheck after its fixes scored 7/10. That tester liked the private yes and the "only if enough come" rule, but would still use a WhatsApp poll for a normal meetup: it sits in the chat, and losing an invite on reload put it off.

Flare is for "anyone free right now?". A poll still wins for a planned meetup. Today, Telegram is how Flare lives inside the chat.

## Code

{% github Hotragn/flare %}

[REPO: delete this line once the repo is public.] AGPL-3.0. Using Flare needs nothing, and hosting your own copy has three levels: no AI keys (you write the words), a free Google AI Studio key (Gemma 4 in the cloud), or Ollama on your own machine (the photo never leaves it).

## How I Built It

### Method

I'm one founder running Claude Code sessions in roles: research, product, design, architecture, specialists, QA. The architect froze [14 interfaces](https://github.com/Hotragn/flare/blob/main/docs/engineering/02-interface-control.md) first, so specialists built against contracts. Decisions live in 31 ADRs, and 159 requirements are traced to code and tests by [`trace.py`](https://github.com/Hotragn/flare/blob/main/docs/requirements/tools/trace.py). Every push runs a secret scan, lint, types (with svelte-check), 830 unit and contract tests and the build.

**Disclosure:** I built this with Claude Code; a manager session, acting as my CTO, sent many prompts. Product and privacy calls were mine. Claude Code sessions drafted this post from the repo's evidence; I checked every claim and supplied the why, the field notes and my friend's words.

### Architecture

![The phone, the server on Render, and my laptop running Gemma 4](docs/post/media/20-architecture.png)

The phone talks only to the server on Render. My Mac dials out over a WebSocket, so nothing on it is open to the internet. When the Mac is off, Gemma 4 on Google AI Studio answers.

### Gemma 4 sees, hears and writes

Gemma 4 E4B (`gemma4:e4b-it-q4_K_M`) runs in **Ollama** on my Mac. On my test set, it named 39 of 40 scenes right, took 3.0 s at the median, and gave valid JSON 20 times out of 20. It also writes the Plan ladder, the smaller plans a Flare can shrink to: 13 of 13 valid, and 95% came back within 5.5 s ([report](https://github.com/Hotragn/flare/blob/main/evals/reports/ladder-agent-hub.md)).

It hears too: a 10 s voice clip becomes "Meet at the pond bench" in 3.3 s, on my laptop.

Smaller models, on the same test set:

| Model | Where | Result | Shipped? |
| --- | --- | --- | --- |
| Gemma 4 E4B, Q4_K_M | Ollama on my Mac | 20/20 JSON, 39/40 scenes, 3.0 s | Yes |
| Gemma 4 E2B, ONNX q4f16 | Chrome, WebGPU | 2.3 s, but 29/40; it invents water and sunsets | No: needs a 1.17 GB GPU buffer, iPhone Safari caps at 1 GiB |
| SmolVLM-500M | Chrome and Safari | 16/40 scenes, 6/20 misleading | No |
| Qwen3-0.6B (conditions) | Safari | 26/40 | No: rules got 40/40 in under 1 ms |

Naming the sounds around you didn't ship: Gemma heard birds in almost every clip and got 8 of 12 at best.

**The model picks the words; code owns the facts.** Every answer passes `enforce()`: six words at most, no names, no invented places. If it's slow, you type.

### The rest of the stack

- **Google AI Studio.** Gemma 4 26B A4B covers for my laptop: 1.4 s a Plan draft with `thinkingLevel: "minimal"`, against 21.7 s and no answer by default. DigitalOcean is wired in, paused for billing.
- **Mastra.** An agent drafts the Plan ladder with four local tools. Across two runs of 13 asks, p95 stayed within 0.3 s of the old route (5.1 vs 5.5 s, then 5.6 vs 5.3 s), and the weather was right 7/7. On live since Oct 12. On live, the first draft took 10.6 s, which Sentry flagged as 271% over its 2.85 s average.
- **Tinker.** A Qwen3.5-4B LoRA cost about $2.40 to train and read 38 of 40 new phrasings, but it's too big for a phone. Its mistakes showed me how to fix the phone's rules: 20/40 to 30/40 on a blind set.
- **ElevenLabs.** 54 compass lines recorded once (698 characters, offline, no names). Voice Spark (Scribe) is off: see below.
- **Sentry.** Agent Tracing follows every AI job, model call and guard. Only tier, model, timing and error class leave; a test fails if our words or ids reach Sentry. It found two real things: the 10.6 s cold start above, and agent spans sharing one parent trace.
- **Telegram.** The bot posts a card with the six words, the spot and the host's first name, never who said yes, and deletes it at Gone. Send can post straight to a linked group chat.
- **Entire.** [ENTIRE: one line with the checkpoint links and what they show]

![Sentry Agent Tracing on the live server: each tool, the Gemma call and the guard, with timings](media/sentry-agent-trace.png)

*Sentry Agent Tracing on the live server: each tool, the Gemma call and the guard, with timings. "No input for this span": our words never reach Sentry.*

### Privacy, built in

- **The count, never who.** The server sees counts and labels like `c3`.
- **The key lives in the link.** It sits in the `#fragment`, which browsers never send. Names, places, photos and Sparks are sealed on the phone with AES-256-GCM.
- **Gone within 5 minutes of the end** (the sweeper's worst case is 90 s by design): the Flare, its photo and every yes, checked by an audit route. On Render's free plan, a server that's asleep deletes it the moment it wakes.
- **Preview cards carry nothing.** The brand card and a count: no photo, place or words.

## What I got wrong

My own test found the hardest ones:

- **As the host, after sending, all I could see was a lot of animation.** It was unclear whether my friends would come, and whether ElevenLabs had worked.
- **"Pocket it" felt like a button I had to press.** Nothing said to wait until my friend arrives, or that the app should stay open even in my pocket.
- **On the friend's side, it showed the place and buttons to finish fast,** without saying what each step is for.
- **Remember this passed every automated check, then failed on my iPhone:** "Couldn't write it down." The logs show no upload. My tests had faked the mic. "Say it" for a Spark failed the same way in Safari, so both are off. I expected a card of the day, with the voice only by choice.

Field test 1 found these:

- **The headline and sheet covered 73% of the photo.** Now 0%, checked by a new gate on 3 viewports.
- **"After 10min" read as 10 AM.** Now "you can come in 10 min" (blind set 30/40, unchanged).
- **Share did nothing in Brave:** the tap was lost after an await. It runs in the tap now, with a Copy link fallback.
- **Returning phones got old pages** from the service worker; a new one now takes over at once (two-build test, 8/8).
- Also "Fuego is at Near Heather Drive", and "We'll buzz you" with no push.
- **Round 6 caught 4 more,** fixed before the freeze: the invite lost on reload, "Sent." before sharing, size buttons hidden at 375×667, and location asked twice.

## Honest limits

- **The mic on an iPhone:** it failed there twice tonight; voice input was tested only in desktop browsers.
- **No background location or mic.** An iPhone web app can't use either.
- **No server pushes for golden hour or a weekly recap.** The server never knows where a crew is or its time zone.
- **Two real tests so far.** One short meetup in person, indoors or nearby, not yet an outdoor walk.
- **In a small group, the count can give away who said yes.**

## Next steps

- Once it's lit, show the host who's coming, with each yes-sayer's OK.
- A clear host status line: "1 friend coming. Keep Flare open; your phone can stay in your pocket."
- Give each AI job its own Sentry trace.
- "My usual" conditions you save once.
- Plans that repeat every week.
- Golden-hour nudges inside the app.

## Why Does Open Innovation Matter?

Open won on three things. Privacy: the photo and your voice go only to my laptop. Cost: $0 a photo. Debugging: I could see the 1.17 GB GPU buffer that keeps E2B off iPhone Safari. Open lost on speed: on my busy laptop, a [5-photo check](https://github.com/Hotragn/flare/blob/main/evals/reports/photo-hub.md) had a 4.0 s median and one took 11.9 s. And the fallback is a cloud: when my Mac is off, Plan drafts come from Google AI Studio, and a photo goes there only if the host taps Ask cloud Gemma.

## My Agent Session

[AGENT SESSION: the DevRelay embed, made public after the scrub (scripts/scan-sessions.ts --public)]

[ENTIRE: the checkpoint links for the same session]

## Prize Categories

- **Gemma:** sees (39/40), hears (3.3 s) and writes, with code checking every answer. [Details](#gemma-4-sees-hears-and-writes)
- **Tinker:** a $2.40 LoRA read 38/40 and taught the rules 20/40 to 30/40, blind. [Details](#the-rest-of-the-stack)
- **ElevenLabs:** a compass voice for 698 characters that sends nothing. [Details](#the-rest-of-the-stack)
- **Mastra:** four local tools; across two runs of 13 asks, p95 stayed within 0.3 s of the old route (5.1 vs 5.5 s, then 5.6 vs 5.3 s), and the weather was right 7/7. On live since Oct 12. [Details](#the-rest-of-the-stack)
- **Sentry Agent Tracing:** every AI job traced; a test proves our words never leave. [Details](#the-rest-of-the-stack)
- **Entire:** [ENTIRE: one line with the session links]
