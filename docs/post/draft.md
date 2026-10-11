---
title: "Flare: snap where you are, and it only lights if enough friends quietly say yes"
published: false
tags: devchallenge, hf26challenge, gemma, opensource
---

<!-- DRAFT. Every [FIELD: …] spot is filled from the Sunday field test tonight. Every number
     without a FIELD marker is measured and linked to its proof in the repo. Remove this
     comment before publishing. -->

*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 1: Touch Grass](https://dev.to/challenges/hacktoberfest-week1-2026-10-05).*

## What I Built

[FIELD: one or two sentences in a tester's own words about the problem, quoted with their OK. Example shape: "We all say 'we should hang out' in the chat, and then nobody goes."]

Flare is a web app for a small group of friends, 2 to 12 people. The host takes a photo of where they are. An open model on our laptop looks at it and writes a six-word invite, like "Bench by the pond, sun out." Friends get a link and say yes **in private**, with conditions if they want: "after 2", "only if Amor comes", "back by 5", "10 minutes' walk at most". Nobody sees who said yes, only the count.

It lights only when enough people can actually come. If not enough can, it shrinks to a smaller plan instead of failing (a bench closer by, a shorter walk). When it lights, everyone gets the spot and a compass that points to it. Then the screen gets out of the way.

A few more things it does:

- **Works with Telegram or plain links.** In a Telegram group the bot posts a Flare card and counts taps; in iMessage, WhatsApp or SMS it's just a link. There's a plain-text form for friends with no data.
- **Sparks and Hot spots.** After a meetup, people leave a one-line memory. The next invite from the same spot says "Your group met here once." and shows it.
- **Bench to Bench.** A walking loop that never goes too far between seats, read back first ("40 min, a bench every 200 m, under trees") and printed as a large-print card.
- **Fix the map.** When a bench or fountain is missing from OpenStreetMap, the model drafts the tags from a photo, a person checks every one, and the app exports a note. It never posts to OSM itself.
- **It forgets.** Every Flare, its photo and every yes are deleted within 5 minutes of ending. Worst case measured: 90 s ([spike E2](https://github.com/Hotragn/flare/blob/main/docs/engineering/03-spikes.md)).

Who it's for: friends who mean to meet up and don't, including a friend with low vision (VoiceOver, large text), a friend who can't walk far (seat-to-seat routes, step-free checks), and a friend with a weak signal (it queues and sends later).

## Demo

- Live app: [FIELD: Render URL after deploy, e.g. https://flare-outside.onrender.com/app/]
- Website: [FIELD: Render URL]/ (Lighthouse 100 on all four categories, mobile and desktop, median of 3 runs: [reports](https://github.com/Hotragn/flare/tree/main/docs/website/lighthouse))
- Video: [FIELD: 60 to 90 s screen recording from docs/post/media/, uploaded]

[FIELD: screenshots from docs/post/media/: send, lit, compass, Ember, Spark, Telegram card]

### The field test

We tested it for real on Sunday, October 11, near Fairlane Town Center in Dearborn, Michigan, with four iPhones [FIELD: number of people, and who used Telegram vs links].

| Run | What happened | Measured |
| --- | --- | --- |
| [FIELD] | [FIELD] | [FIELD: send to lit time, walk time, compass error] |

[FIELD: the best moment, in plain words. The worst moment, in plain words.]

## Code

{% github Hotragn/flare %}

AGPL-3.0. The README has a 3-step quick start (server, hub, phone), and [docs/README.md](https://github.com/Hotragn/flare/blob/main/docs/README.md) indexes the rest.

## How I Built It

### The model: Gemma 4 E4B on a laptop, not in the cloud

The photo goes to a Mac running **Gemma 4 E4B** (`gemma4:e4b-it-q4_K_M`, 7.5B parameters, 6.58 GB) on **Ollama**. The Mac dials out to our server over a WebSocket, so nothing on it is exposed to the internet. The photo is held in memory and zero-filled after the call; it's never written to disk on either end.

Why that model: I measured the options before picking one ([model selection](https://github.com/Hotragn/flare/blob/main/docs/ml/model-selection.md)):

| Model | Where | Result | Shipped? |
| --- | --- | --- | --- |
| Gemma 4 E4B, Q4_K_M | Ollama on the Mac | 20/20 valid JSON, 39/40 scenes right, 3.0 s median | Yes |
| Gemma 4 E2B, ONNX q4f16 | Chrome, WebGPU | 20/20 JSON, 2.3 s, but scenes 29/40, and it invents water and sunsets | No: needs a 1.17 GB GPU buffer; iPhone Safari caps buffers at 1 GiB |
| SmolVLM-500M | Chrome and Safari | Scenes 16/40, 6/20 misleading | No |
| Qwen3-0.6B (for conditions) | Safari | 26/40 | No: rules got 40/40 in under 1 ms, and the model hung Safari |

**The model picks the words; code owns the facts.** Every answer goes through `enforce()` before anyone sees it: six words or fewer, no names of people, no invented places. If the model is slow (over 6 s for a photo) or its answer fails the check, the app shows typed words instead. Nobody waits on the AI.

The same model drafts Plan "ladders" (a big plan and three smaller versions, 12/12 valid, p95 6.5 s) and Fix the map tags (11 photos in the eval; 0 tags off the allow-list after the guard).

### What doesn't use a model, on purpose

Conditions ("after 2, only with Amor") are parsed on the phone by rules: 40/40 on the core test set, 15/20 on the hard set, under 1 ms, and the words never leave the phone. The only thing sent to the server is the rule, like `{"type": "after", "at": "…T18:00:00Z"}`, never the words. Bench to Bench requests are parsed the same way (16/16 plain requests).

### Privacy, built in

- The group key lives in the link's `#fragment`, which browsers never send to servers. Names, places, photos and Sparks are sealed on the phone (AES-256-GCM) before upload. The server sees counts and opaque labels like `c3` or `step:2`.
- Telegram groups are the one disclosed exception: the bot needs readable text to post. By default it posts a Flare card, not the photo. A group can turn on real photos, and the setting says plainly that Telegram keeps a copy until the post is deleted.

### Stack

SvelteKit 5 (installable PWA, works offline), Hono on Node 24, Postgres, an outbound WebSocket relay to the Mac, Web Push, a Telegram bot, OpenStreetMap packs for places and loops. [FIELD: Render web service and Render Postgres, if deployed there.]

### How it was built

I ran it like a small software company, one role at a time: research, product, requirements, brand, design, architecture, engineering lead, then nine specialists building in parallel against frozen interfaces, then integration and QA. Every role left a handoff in the repo. The test suite is over 650 tests plus 7 end-to-end suites on the real server and engine.

**Disclosure:** I built this with Claude Code. A separate "manager" Claude session, acting as the CTO for me, sent many of the prompts in the build sessions: it relayed my decisions and set the order of work. Product and privacy decisions were mine; the manager session asked before anything public.

## What I got wrong

- **The Telegram path didn't exist in the app until the morning of the test.** The server side was built and tested, but no screen on the phone connected a group to Telegram. I found it while building the Telegram card, about four hours before the field test, and built the missing screen with a real-server test.
- **Sparks never reached Hot spots.** Three bugs together: the Hot spots record was never written, "met here" was always empty, and the record fired three times. The field-path coverage check caught all three (BUG-058 to 060).
- **"Short one only" asked for the long one.** The button sent `min_step` instead of `max_step` (BUG-057).
- **A dead Wi-Fi link looked alive forever.** A half-open socket kept the hub "connected" and every photo waited out the full 6 s. Fixed with a heartbeat; measured recovery on a real half-open link: 16.1 s (BUG-030, BUG-031).
- **The website scored 61 on mobile.** WebGL flames ran in software. CSS flames got it to the high 90s; deferring hydration until after the first paint and a 10 KB grain texture got it to 100.
- **Bench to Bench finds no loop at our own test spot.** The benches at Ford Woods are mapped too close together. The app says "No loop keeps benches that close. Try 400 m?" instead of inventing one. [FIELD: did we fix the map there?]
- **The tag drafter makes things up on empty photos.** On 4 of 6 photos with nothing to tag (a playground, a skate park), it drafted a shelter. The app throws away the model's guess of what the thing is, and a person still checks every tag.
- [FIELD: anything that broke on the iPhones]

## What I didn't do

- **No model on the phone.** Gemma 4 E2B runs in Chrome on a Mac, but not inside iPhone Safari's memory limits. Measured, not shipped.
- **No cloud model by default.** A DigitalOcean fallback exists for when the laptop is off, but photos go there only if the host opts in for that Flare.
- **Not tested on Android.** All four test phones were iPhones.
- **Not a native app.** It's a web app you add to the Home Screen.
- **Fix the map is slow.** The slowest tag drafts take 13.8 s, over the 8 s budget, in the eval with full-size photos. Not fixed yet.
- [FIELD: anything we cut on the day]

## Why Does Open Innovation Matter?

For this app, open weights are the whole design, not a preference.

- **The photo never leaves our hands.** It's a picture of exactly where someone is standing, right now. With an open model on our own laptop, it goes there in memory and is gone after the call. With a closed API, it would be on someone else's servers under someone else's retention policy.
- **It costs nothing per photo.** [FIELD: number of photos drafted during the test] drafts on the laptop cost $0. That matters for a free app with no business model.
- **We could measure it, and we could pick the size.** I ran five open models side by side on the same 20 photos and chose by measured results. I could see exactly why the small one failed on an iPhone (a 1.17 GB buffer). With a closed model I'd get an answer and no way to look inside.
- **Open data too.** Places, benches and walking paths come from OpenStreetMap. When the map is wrong, Fix the map gives back a reviewed note instead of just taking.

Where open beat closed for us: privacy of location photos, zero cost per use, and being able to check the work. Where it didn't: speed. A large hosted model would be faster than a laptop on a busy afternoon.

## My Agent Session

[FIELD: Entire session links for the key build sessions, scrubbed of emails before publishing (scripts/scan-sessions.ts --public found 100 to remove)]

## Prize Categories

- **Gemma:** Gemma 4 E4B runs locally on Ollama for photo invites, Plan ladders and map tags, chosen against Gemma 4 E2B and three other open models on the same test set, with code checking every answer ([eval results](https://github.com/Hotragn/flare/blob/main/docs/ml/eval-results.md)).
- **Entire:** [FIELD: one line, with the session links above]
- **Sentry Agent Tracing:** [FIELD: one line plus a trace screenshot from the deployed server: hub vs fallback tiers, latency]
- [FIELD: Render, only if the deploy runs there; the category asks for the model or agent to run on Render, and ours runs on the laptop, so likely leave it out]

[FIELD: team handles if any; thanks to the testers, with their OK]
