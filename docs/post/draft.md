---
title: "Flare: snap where you are, and it only lights if enough friends quietly say yes"
published: false
tags: devchallenge, hf26challenge, gemma, opensource
---

<!-- DRAFT for the founder's review. [FIELD: ...] = only the founder can fill it (quote, video,
     image uploads, agent session, Sentry screenshot, making the repo public).
     [PENDING DO BILLING] = the DigitalOcean claim, held until billing is fixed.
     Every number is measured; its proof is named. Remove this comment before publishing. -->

*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 1: Touch Grass](https://dev.to/challenges/hacktoberfest-week1-2026-10-05).*

## What I Built

It's 4 PM on a Saturday. Someone in the group chat writes "we should go for a walk". Three people react with a thumbs up. Nobody goes.

Flare starts there. You take a photo of where you are. Gemma 4, an open model on our own laptop, writes the invite: "Meet by the quiet water's edge". Your friends get a link and tap **I'm in**, in private. Everyone sees the count, never who. It goes ahead only if enough people can come. If not enough say yes in 30 minutes, it shrinks to a smaller plan, such as 15 minutes at a bench nearby, instead of dying.

Now picture the friend with low vision. Gemma has already turned the photo into a line their screen reader speaks: "A calm body of water reflecting trees and distant hills, with reeds and foliage in the foreground." When it lights, the compass talks them in: "150 meters, slightly left." It buzzes and sounds a tone when they face the right way. If a photo isn't possible, they *say* where they are, and Gemma writes the invite from their voice.

[FIELD: the founder's quote. Suggested: "My friends and I say 'let's go outside' every weekend and then scroll past it. I wanted the yes to be private, and the plan to get smaller instead of dying."]

Afterwards it says how long you were outside together, and then it deletes itself.

### At a glance

| What happens | The open piece doing it | Proof |
| --- | --- | --- |
| A photo becomes the invite and a line to hear | Gemma 4 E4B on Ollama, on our laptop | [39/40 scenes, 3.0 s](#gemma-4-sees-hears-and-writes) |
| You say it instead, and Gemma writes it | Gemma 4 E4B hearing audio | [3.3 s, no audio kept](#gemma-4-sees-hears-and-writes) |
| A plan that gets smaller instead of failing | The rules engine, plus a Mastra agent for Plan steps | [11 of 12 lit in a 48-friend simulation](#how-i-tested-it) |
| A compass with a warm voice | ElevenLabs clips recorded once, offline | [698 characters, nothing sent](#a-voice-that-sends-nothing-elevenlabs) |
| Everything about the meetup deleted | Postgres cascade and an audit route | [within 5 min; worst case 90 s](#privacy-built-in) |

## Demo

- **Try it with no setup:** [flare-outside.onrender.com/app/demo/](https://flare-outside.onrender.com/app/demo/). The real rules engine runs in your browser with three demo friends, and nothing is sent. Become your friend Amor for one tap, skip 30 minutes to watch it shrink, then follow the compass.
- **The app:** [flare-outside.onrender.com/app/](https://flare-outside.onrender.com/app/). **The site:** [flare-outside.onrender.com](https://flare-outside.onrender.com/) (Lighthouse 100 in all four categories, mobile and desktop, on all five pages).
- **Video:** [FIELD: 60 to 90 s screen recording, see docs/post/shot-list.md]

[FIELD: upload from docs/post/media/ and replace the paths]

![The photo, with the invite Gemma 4 wrote from it](docs/post/media/01-host-words.jpg)
![The friend's invite: the count, never names](docs/post/media/02-friend-invite.jpg)
![Too few in 30 minutes: a smaller plan](docs/post/media/06-friend-ember.jpg)
![A Voice Flare written from what was said](docs/post/media/08-voice-flare-send.png)

### How I tested it

I haven't run a group meetup with it yet, so I won't claim one. [FIELD: replace this line if a real outing happens before posting.] Here is what I did test:

| What | How | Result |
| --- | --- | --- |
| The full loop | Chrome at iPhone size against the real server, the real Gemma 4 hub and Postgres | 10 end-to-end suites pass, including the field run (27/27), Plans, Voice Flares, Sparks, Telegram and offline |
| Real phones | A device-check page on an iPhone 16 Pro Max and an iPhone 13, covering the compass, haptics and sound | 3 bugs found and fixed (below) |
| A simulated Saturday | 48 made-up friends in 4 groups against the real server ([GIF](docs/post/media/sim/fairlane-sim-42.gif), labelled Simulation) | 11 of 12 lit; median 14.75 min to Lit for Flares; 1 of 2 Embers saved a plan; all 12 deleted after, audit pass |
| Strangers | A tester with no context on the live site, 4 rounds | 5, 6, 5 and 6 out of 10; what each round found was fixed and redeployed |
| Accessibility | axe on 22 pages × 2 widths × light and dark | 0 findings; every target 44 px or more |

## Code

{% github Hotragn/flare %}

[FIELD: make the repo public.] AGPL-3.0. The README has a 3-step quick start: server, hub, phone. `docs/README.md` indexes 30 architecture decision records, the requirements and the evals.

## How I Built It

### Gemma 4 sees, hears and writes

The photo goes to a Mac running **Gemma 4 E4B** (`gemma4:e4b-it-q4_K_M`) on **Ollama**. The Mac dials out over a WebSocket, so nothing on it is open to the internet, and the photo is zero-filled after the call.

| Sense | Job | Measured |
| --- | --- | --- |
| Vision | Photo → a short invite, plus a scene line for friends who can't see it | 20/20 valid JSON, 39/40 scenes right, 3.0 s median |
| Audio | **Voice Flare:** you say where you are, and it writes the invite | "Meet at the pond bench" in 3.3 to 3.7 s |
| Text | Plan "ladders": a big plan and three smaller versions | 13/13 valid, p95 5.5 s |

The audio part surprised me. Ollama 0.40.2 lists `audio` for this model, and it hears 16 kHz WAV passed in the same `images` field a photo uses. A field named `audio` is ignored. The phone records up to 10 s, and the hub writes the same `{invite, alt}` a photo gets. The voice never leaves our laptop, and the words heard aren't sent back.

I picked the model by measuring the options on one test set:

| Model | Where | Result | Shipped? |
| --- | --- | --- | --- |
| Gemma 4 E4B, Q4_K_M | Ollama on the Mac | 20/20 JSON, 39/40 scenes, 3.0 s | Yes |
| Gemma 4 E2B, ONNX q4f16 | Chrome, WebGPU | 2.3 s, but 29/40 scenes; it invents water and sunsets | No: it needs a 1.17 GB GPU buffer, and iPhone Safari caps buffers at 1 GiB |
| SmolVLM-500M | Chrome and Safari | 16/40 scenes, 6/20 misleading | No |
| Qwen3-0.6B (for conditions) | Safari | 26/40 | No: rules got 40/40 in under 1 ms |

**The model picks the words; code owns the facts.** Every answer passes `enforce()` before anyone sees it: six words at most, no names, no invented places. If the model is slow or the answer fails the check, the app shows typed words. Nobody waits on the AI.

### When the laptop is off: Google AI Studio and DigitalOcean

When our laptop is off, the server falls back to Gemma 4 in the cloud. Plan drafts use it automatically. A photo goes only if the host taps "Ask cloud Gemma" for that Flare, and the note under the button says Google's free tier may review it.

**Google AI Studio** serves Gemma 4 26B A4B. One finding saved it: by default Gemma 4 thinks first on that API. A Plan draft took 21.7 s and spent all 1,021 thought tokens without answering. With `thinkingLevel: "minimal"` it answers in 1.4 s, and a photo takes 1.6 s.

**DigitalOcean** Serverless Inference is wired in as the first provider, with Gemma 4 31B. In the probe a Plan draft took 20.9 s and a photo 27.2 s. A provider that refuses is skipped for an hour, so the fallback costs one call, not a timeout per draft. [PENDING DO BILLING: the account is blocked for billing today, so Google answers; the fallback is tested.]

### An agent with local tools: Mastra

A **Mastra** agent can draft the Plan ladder with four local tools: sunset time, a weather window for the plan's hours, nearby places from the map pack, and step templates. On 13 asks it had a p95 of 5.1 s against 5.5 s for the old route, the weather tool matched the window 7/7, and the agent itself added 12 ms. It ships behind a switch, and its answer goes through the same guard.

### A fine-tune that taught the rules: Tinker

Conditions like "after 2, only if Amor comes, back by 5" are parsed **on the phone by rules**, so the words never leave it. The rules missed new phrasings: 15/40 on a fresh hard set.

I fine-tuned a Qwen3.5-4B LoRA on **Tinker**: 3,000 synthetic examples, rank 32, 6 minutes, about $2.40. It read 38/40. It runs on Tinker's servers, though, and conditions must stay on the phone. So I used its errors to teach the rules new phrasings. On a blind set written before the rules changed, they went from 20/40 to 30/40, still under 1 ms with no network.

### A voice that sends nothing: ElevenLabs

The compass talks, and the phone's own voice can sound flat. A live voice would have had to send the spot's name to a cloud service. So I recorded 54 fixed lines once with **ElevenLabs**: distances, directions, and "You're close. Look around." That cost 698 characters of the free 10,000, and the lines ship with the app as 684 KB of MP3. They hold no names or places and work offline, and the phone's own voice is the fallback.

**Voice Spark:** after a meetup you can say your one-line memory. Up to 10 s of your own voice goes once to ElevenLabs Scribe, and the words come back for you to edit (0.72 s live). No audio is kept. Flare never records anyone else or a conversation.

### Debugging without anyone's words: Sentry

**Sentry Agent Tracing** follows the AI path. It traces:
- each job: `invoke_agent flare-photo`, `flare-voice` and `flare-ladder`;
- each model call: `chat gemma4:e4b`, with the provider that answered (hub, Google or DigitalOcean);
- each guard and agent tool: `enforce`, `nearby_places` and `weather_window`.

It also samples route performance and catches server errors.

Only an allow-list leaves the server: tier, model, timing, ok and error class. Route names are tokens like `PUT:gatherings`, never paths, and error messages are dropped. A test runs the real routes with marker phrases and UUIDs in the inputs, and fails if any of them reach an envelope.

[FIELD: a trace from the live project: a Plan draft with the hub away, `gen_ai.provider.name: google`, and its latency.]

### Privacy, built in

- The group key lives in the link's `#fragment`, which browsers never send to servers. Names, places, photos and Sparks are sealed on the phone with AES-256-GCM. The server sees counts and labels like `c3`.
- The **Crew Atlas**, a map of where your crew meets, is drawn on the phone from the sealed Hot spots and the local map pack. It loads no tiles and makes no requests. I left out a Gemma caption, because it would mean sending decrypted places to the laptop.
- Within 5 minutes of the end, the Flare, its photo and every yes are deleted. The worst case measured was 90 s.

**Stack:** SvelteKit (a PWA that works offline), Hono on Node 24, Postgres on Render, the WebSocket relay to the Mac, Web Push, a Telegram bot and OpenStreetMap packs. The JS budget is 150 KB gzipped per page; the app is at 146.

**Process:** one role at a time, like a small company (research, product, design, architecture, specialists, QA), each leaving a handoff in the repo. 769 unit and contract tests.

**Disclosure:** I built this with Claude Code. A separate "manager" Claude session, acting as CTO for me, sent many of the prompts and set the order of work. Product and privacy decisions were mine, and anything public waited for my yes.

## What I got wrong

- **The website's styles leaked into the app.** On phones, your photo on the Send screen sat under a navy block. SvelteKit keeps the website's CSS after you tap into the app, and its `.hero` rule hit the app's `.hero`. A tester with no context found it, and every website rule is now scoped.
- **The demo broke its own promise.** It said "Nobody sees who" right above "Amor said yes." Now it says "One more yes. 2 in."
- **A Plan with no saved name did nothing.** You tapped Send and nothing happened. A new end-to-end test found it.
- **The compass said "close" 49 times** on an iPhone 16 Pro Max walk. It now holds a margin and repeats only when the distance halves.
- **The compass froze on an exact 180° turn.** The two directions averaged to nothing. It's fixed with shortest-arc smoothing.
- **Gemma's thinking ate the cloud budget** (21.7 s, no answer) until I set it to minimal.
- **Sparks never reached Hot spots.** Three bugs: the record was never written, "met here" was always empty, and it fired three times.

## What I didn't do

- **No model on the phone.** Gemma 4 E2B runs in Chrome on a Mac but not inside iPhone Safari's memory limit.
- **No golden-hour or weekly-recap push.** Home shows golden hour, and the Crew page shows the week. A push would need the server to know where a crew is and its time zone, and it never knows either.
- **The invite isn't read in the warm voice.** That would send sealed text off the phone.
- **No Android testing, no native app.** It's a web app you add to the Home Screen.

## Why Does Open Innovation Matter?

- **A photo of where you stand, or your voice saying it, is about as personal as data gets.** On an open model on our own laptop, it lives in memory and is gone after the call. The one closed service in the voice path, ElevenLabs Scribe, hears you only when you tap "Say it", and the privacy page says so.
- **It costs nothing per photo.** A free app can't pay per call. The laptop costs $0 per draft, and the cloud fallback is capped daily.
- **I could look inside.** I ran five open models on the same photos and picked by results. I could see exactly why the small one failed on an iPhone: a 1.17 GB buffer. I fine-tuned one in 6 minutes to learn what my rules were missing.
- **Open data too.** Benches, restrooms and paths come from OpenStreetMap, and Fix the map drafts a reviewed note to give back.

Open lost on one thing: speed on a busy laptop. That's what the cloud fallback is for.

## My Agent Session

[FIELD: DevRelay agent session embed, made public after the scrub (scripts/scan-sessions.ts --public). Suggested session: the Voice Flare build, where Gemma first heard audio.]

[FIELD: Entire checkpoint links for the same session, for the Entire category.]

## Prize Categories

- **Gemma:** Gemma 4 E4B sees, hears (Voice Flare, 3.3 s) and writes, chosen against four other open models with code checking every answer. [Details](#gemma-4-sees-hears-and-writes)
- **Tinker:** a measured failure (15/40), a $2.40 LoRA that read 38/40, and the rules it taught (20/40 to 30/40, blind). [Details](#a-fine-tune-that-taught-the-rules-tinker)
- **DigitalOcean:** [PENDING DO BILLING] Gemma 4 31B on Serverless Inference as the first cloud provider, with tested fallback. [Details](#when-the-laptop-is-off-google-ai-studio-and-digitalocean)
- **ElevenLabs:** a warm compass voice recorded once that sends nothing, and Scribe for a person's own 10-second Spark. [Details](#a-voice-that-sends-nothing-elevenlabs)
- **Mastra:** a Plan agent with four local tools: p95 5.1 s vs 5.5 s, weather 7/7. [Details](#an-agent-with-local-tools-mastra)
- **Sentry Agent Tracing:** every AI job, model call and guard traced, under an allow-list a test proves. [Details](#debugging-without-anyones-words-sentry)
- **Entire:** [FIELD: one line with the session links]

[FIELD: thanks, with permission, to anyone who tried it]
