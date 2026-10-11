---
title: "Flare: snap where you are, and it only lights if enough friends quietly say yes"
published: false
tags: devchallenge, hf26challenge, gemma, opensource
---

<!-- DRAFT for the founder's review. [FIELD: ...] marks what only the founder can fill:
     a quote, the video, image uploads, Entire links, a Sentry screenshot, the repo going public.
     [PENDING DO BILLING] marks the DigitalOcean claim, held until billing is fixed.
     Every number here is measured; the proof is named next to it. Remove this comment
     before publishing. -->

*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 1: Touch Grass](https://dev.to/challenges/hf26).*

## What I Built

[FIELD: one or two sentences in the founder's own words about the problem. Shape: "My friends and I say 'we should go for a walk' in the group chat every week, and then nobody goes."]

Flare is a free web app for a small group of friends. You take a photo of where you are. Gemma 4, an open model running on our own laptop, looks at it and writes a short invite ("Meet by the quiet water's edge"). Your friends get a link and tap **I'm in**, in private. Everyone sees the count, never who.

It goes ahead only if enough people can actually come. If not enough say yes within 30 minutes, it doesn't fail: it shrinks to a smaller plan, such as 15 minutes at a bench nearby. When it lights, everyone gets the spot and a compass that talks them there. Afterwards it says how long you were outside together, and then it deletes itself.

It's for friends who mean to meet up and don't. That includes the friend with low vision (the compass talks, buzzes and has a warm recorded voice, and you can *say* a Flare instead of photographing one), the friend who can't walk far (benches, step-free checks, loops from bench to bench), and the friend with a weak signal (it queues and sends later).

## Demo

- **Try it with no setup:** [flare-outside.onrender.com/app/demo/](https://flare-outside.onrender.com/app/demo/). Three demo friends run on a demo clock, and nothing is sent. You send a Flare, become your friend Amor for one tap, skip 30 minutes to watch it shrink, then follow the compass. The demo runs the real rules engine in your browser.
- **The live app:** [flare-outside.onrender.com/app/](https://flare-outside.onrender.com/app/). The site is [flare-outside.onrender.com](https://flare-outside.onrender.com/) and scores Lighthouse 100 in all four categories, mobile and desktop, on all five pages.
- **Video:** [FIELD: 60 to 90 s screen recording, docs/post/shot-list.md]

[FIELD: upload these from docs/post/media/ and replace the paths]

![The photo, with the invite Gemma 4 wrote from it](docs/post/media/01-host-words.jpg)
![The friend's invite: the count, never names](docs/post/media/02-friend-invite.jpg)
![It's lit](docs/post/media/03-friend-lit.jpg)
![Too few in 30 minutes: it shrinks to a smaller plan](docs/post/media/06-friend-ember.jpg)
![A Voice Flare: Gemma 4 heard "I'm at the pond in Ford Woods Park, come sit on the bench with me"](docs/post/media/08-voice-flare-send.png)
![The Crew Atlas, drawn on the phone](docs/post/media/09-crew-atlas.png)

### How I tested it

I haven't run a group meetup with it yet, so I won't claim one. [FIELD: replace this line if a real outing happens before posting.] Here is what was tested:

| What | How | Result |
| --- | --- | --- |
| The whole loop on the real stack | Chrome at iPhone size against the real server, the real Gemma 4 hub on this Mac, the engine and Postgres | 10 end-to-end suites pass, including the field run (27/27), Plans, Voice Flares, Sparks, Telegram and offline |
| Two real iPhones | A device-check page on an iPhone 16 Pro Max and an iPhone 13, for the compass, haptics and sound | Found 3 bugs, all fixed (below) |
| A simulated Saturday | 48 made-up friends in 4 groups play Flares and Plans against the real server ([GIF](docs/post/media/sim/fairlane-sim-42.gif), labelled Simulation) | 11 of 12 lit (91.7%); median time to Lit 14.75 min for Flares; 1 of 2 Embers saved a plan; all 12 gatherings deleted afterwards, and the deletion audit passes |
| Strangers | 4 rounds of a "fresh eyes" tester with no context using the live site | Scores 5, 6, 5, [FIELD: round 4]/10. Every round's issues were fixed and redeployed |
| Accessibility | axe on 22 pages × 2 widths × light and dark | 0 findings, and every target at least 44 px |

## Code

{% github Hotragn/flare %}

[FIELD: the repo is private until the founder makes it public.] AGPL-3.0. The README has a 3-step quick start (server, hub, phone), and `docs/README.md` indexes the rest: 30 architecture decision records, the requirements and the evals.

## How I Built It

### One open model with three senses: Gemma 4 E4B on a laptop

The phone sends the photo to a Mac running **Gemma 4 E4B** (`gemma4:e4b-it-q4_K_M`) on **Ollama**. The Mac dials out to the server over a WebSocket, so nothing on it is open to the internet. The photo stays in memory and is zero-filled after the call.

Gemma 4 does three jobs in Flare:

| Sense | Job | Measured |
| --- | --- | --- |
| Vision | Photo → a short invite and a one-line scene for friends who can't see the photo | 20/20 valid JSON, 39/40 scenes right, 3.0 s median |
| Audio | **Voice Flare:** you say where you are and what you want to do, and the invite is written from that | "Meet at the pond bench" in 3.3 to 3.7 s, from audio alone |
| Text | Plan "ladders": a big plan and three smaller versions | 13/13 valid, p95 5.5 s; Fix the map tags, 0 off the allow-list |

The audio part surprised me. Ollama 0.40.2 reports `audio` as a capability for this model, and it hears WAV passed in the same `images` field a photo uses. A field named `audio` is ignored. The phone records up to 10 s and converts it to 16 kHz mono WAV, and the hub writes the same `{invite, alt}` a photo would get. The voice never leaves our laptop and is never stored. The words it heard aren't sent back, only the invite.

I picked the model by measuring the options on the same test set:

| Model | Where | Result | Shipped? |
| --- | --- | --- | --- |
| Gemma 4 E4B, Q4_K_M | Ollama on the Mac | 20/20 JSON, 39/40 scenes, 3.0 s | Yes |
| Gemma 4 E2B, ONNX q4f16 | Chrome, WebGPU | 2.3 s, but 29/40 scenes; it invents water and sunsets | No: it needs a 1.17 GB GPU buffer, and iPhone Safari caps buffers at 1 GiB |
| SmolVLM-500M | Chrome and Safari | 16/40 scenes, 6/20 misleading | No |
| Qwen3-0.6B (for conditions) | Safari | 26/40 | No: the rules got 40/40 in under 1 ms, and the model hung Safari |

**The model picks the words; code owns the facts.** Every answer goes through `enforce()` before anyone sees it: six words or fewer, no names, no invented places. If the model is slow or the answer fails the check, the app shows typed words instead. Nobody waits on the AI.

### When the laptop is off: Gemma 4 in the cloud

Our laptop isn't always on, so the server has a cloud tier: Gemma 4 26B A4B on **Google AI Studio**. Plan drafts use it when the hub is away. A photo goes there only if the host taps "Ask cloud Gemma" for that one Flare, and the note under the button says Google's free tier may review it.

One finding saved this tier. Gemma 4 on that API thinks before it answers by default. A Plan draft took 21.7 s and spent all 1,021 thought tokens without answering. With `thinkingLevel: "minimal"` it answers in 1.4 s, and a photo in 1.6 s.

**DigitalOcean** Serverless Inference is wired in as the first cloud provider, with Gemma 4 31B: a Plan draft took 20.9 s and a photo 27.2 s in the probe. A provider that refuses (401/402/403) is skipped for an hour. [PENDING DO BILLING: our account is blocked for billing, so Google answers today; the fallback is tested.]

### An agent that never lets a plan die: Mastra

The Plan ladder can be drafted by a **Mastra** agent with four local tools: sunset time, a weather window for the plan's hours, nearby places from the map pack, and step templates. Measured on 13 asks against the current route: p95 5.1 s vs 5.5 s, and the weather tool matched the plan's window 7/7. The agent adds a median of 12 ms. It ships behind a switch (`LADDER_AGENT=1`), and whatever the agent says still goes through the same guard.

### A measured failure, and what fine-tuning taught the rules: Tinker

Conditions like "after 2, only if Amor comes, back by 5" are parsed **on the phone by rules**, so the words never leave it. The rules missed new phrasings: 15/40 on a fresh hard set. I fine-tuned a Qwen3.5-4B LoRA on **Tinker** (3,000 synthetic examples, rank 32, about $2.40). It read 38/40.

I couldn't ship it. It runs on Tinker's servers, and conditions must stay on the phone. So I used its errors to teach the rules new phrasing families. On a blind set written *before* the rules changed, the rules went from 20/40 to 30/40, still under 1 ms with no network. The LoRA's 38/40 shows the gap that's left.

### A warm voice that sends nothing: ElevenLabs

The compass talks: "150 meters, slightly left." The phone's own voice can sound flat, so the compass can use a warm voice instead.

A live voice would have had to send the spot's name to a cloud service. So I recorded 54 fixed lines once with **ElevenLabs** (distances, directions, "You're close. Look around."). That cost 698 characters of the free 10,000, and the clips ship with the app as 684 KB of MP3. No names and no places are in them, they work offline, and the phone's own voice is the fallback. Scribe read the clips back word for word in 420 to 492 ms.

**Voice Spark:** after a meetup you can *say* your one-line memory instead of typing it. Up to 10 s of your own voice goes once to ElevenLabs Scribe, the words come back for you to edit, and no audio is kept (live: 0.72 s). Flare never records anyone else or a conversation.

### Debugging without seeing anyone's words: Sentry

**Sentry Agent Tracing** covers the AI path on the server:
- every job (`invoke_agent flare-photo`, `flare-voice`, `flare-ladder`);
- every model call (`chat gemma4:e4b`, with the provider that actually answered: hub, Google or DigitalOcean);
- every guard and agent tool (`execute_tool enforce`, `nearby_places`, `weather_window`).

The same tracing also covers sampled route performance and server errors.

The design rule is an allow-list. Only tier, model, timing, ok and error class leave the server. Route names are tokens like `PUT:gatherings`, never paths, and error messages are dropped. A test runs the real routes with marker phrases and UUIDs in the inputs, captures every envelope, and fails if any of them shows up.

[FIELD: one trace screenshot from the live project, showing a Plan draft where the hub was away and `gen_ai.provider.name` says google, with its latency.]

### Privacy, built in

- **The group key lives in the link's `#fragment`,** which browsers never send to servers. Names, places, photos and Sparks are sealed on the phone (AES-256-GCM). The server sees counts and labels like `c3`.
- **The Crew Atlas is drawn on the phone.** It's a map of where your crew meets, made from the sealed Hot spots and the map pack already on the phone. No map tiles and no requests. I didn't let Gemma write a caption for it, because that would mean sending the decrypted places to our laptop.
- **Within 5 minutes of the end, the Flare, its photo and every yes are deleted.** The worst case measured was 90 s.

### Stack and process

- **Stack:** SvelteKit (an installable PWA that works offline), Hono on Node 24, Postgres on Render, the WebSocket relay to the Mac, Web Push, a Telegram bot, and OpenStreetMap packs. The JS budget is 150 KB gzipped per page, and the app is at 146.
- **Process:** I ran it like a small software company, one role at a time: research, product, requirements, design, architecture, then specialists building against frozen interfaces, then QA. Each role left a handoff in the repo. There are 769 unit and contract tests and 10 end-to-end suites.

**Disclosure:** I built this with Claude Code. A separate "manager" Claude session, acting as CTO for me, sent many of the prompts: it relayed my decisions and set the order of work. Product and privacy decisions were mine, and anything public waited for my yes.

## What I got wrong

- **The website's styles leaked into the app.** On a phone, your photo on the Send screen sat under a navy block, and the onboarding photo was squashed to 230 px. The cause: SvelteKit keeps the website's CSS after you tap from the website into the app, and its `.hero` and `.art` rules hit the app's own. A tester with no context found it. Every website rule is now scoped.
- **The demo broke its own promise.** It said "Nobody sees who" and, right under that, "Amor said yes." It now says "One more yes. 2 in."
- **A Plan with no saved first name did nothing.** You tapped Send and nothing happened. The new Plan end-to-end test found it; the screen now asks for the name.
- **The compass said "close" 49 times** on a real iPhone 16 Pro Max walk. It now waits for a margin before it says "close" again, and only repeats when the distance halves.
- **The compass froze on an exact 180° turn.** The smoothing averaged the two directions to nothing. It's fixed with shortest-arc smoothing and a replay test.
- **The device check read 0 compass events a second on an iPhone 13.** A second Start tap had attached a second counter.
- **Gemma's thinking ate the cloud budget** (21.7 s, no answer) until I turned it to minimal.
- **Sparks never reached Hot spots.** Three bugs: the record was never written, "met here" was always empty, and it fired three times.
- **"Short one only" asked for the long one.** A `min_step` should have been `max_step`.

## What I didn't do

- **No model on the phone.** Gemma 4 E2B runs in Chrome on a Mac, but not inside iPhone Safari's memory limit. Measured, not shipped.
- **No golden-hour push, no weekly recap push.** Home shows "Golden hour in 47 min", and the crew page shows this week's time outside. A push would need the server to know where a crew is and what time zone it's in, and it never knows either.
- **The invite isn't read in the warm voice.** That would send the sealed invite text off the phone.
- **Not tested on Android,** and not a native app: it's a web app you add to the Home Screen.

## Why Does Open Innovation Matter?

For this app, open weights are the design, not a preference.

- **A photo of where you're standing, or your voice saying it, is about as personal as data gets.** With an open model on our own laptop, it goes there in memory and is gone after the call. With a closed API, it would sit on someone else's servers under their retention rules. The one closed service in Flare, ElevenLabs Scribe, gets your voice only when you tap "Say it", and the privacy page says so.
- **It costs nothing per photo.** A free app with no business model can't pay per call. The laptop costs $0 per draft, and the cloud fallback runs on a free tier with a daily cap.
- **I could measure it and pick the size.** I ran five open models on the same photos and chose by results. I could see exactly why the small one failed on an iPhone (a 1.17 GB buffer). I could fine-tune one in 6 minutes for $2.40 to learn what the rules were missing.
- **Open data too.** Benches, restrooms and paths come from OpenStreetMap. When the map is wrong, Fix the map drafts a reviewed note to give back.

Where open beat closed for us: privacy, cost, and being able to check the work. Where it didn't: speed on a busy laptop, which is why there's a cloud fallback.

## My Agent Session

[FIELD: Entire checkpoint links for the key build sessions, made public after the scrub (scripts/scan-sessions.ts --public). Suggested: the Voice Flare session (Gemma hearing audio for the first time) and the round-3 fresh-eyes fix (finding the CSS leak).]

## Prize Categories

- **Gemma:** Gemma 4 E4B sees (photo to invite), hears (Voice Flare: 3.3 s from audio to invite on our laptop) and writes (Plan ladders), chosen against four other open models on one test set, with code checking every answer. Gemma 4 26B A4B is the cloud fallback.
- **ElevenLabs:** 54 compass lines recorded once (698 characters) so the compass's warm voice sends nothing, and Scribe turns a person's own 10-second Spark into words with no audio kept.
- **Sentry Agent Tracing:** every AI job, model call and guard traced, plus route performance and server errors, under an allow-list a test proves. [FIELD: trace screenshot]
- **Mastra:** a Plan agent with four local tools: p95 5.1 s vs 5.5 s for the old route, and weather matched 7/7, behind a switch.
- **Tinker:** a measured failure (15/40), a $2.40 LoRA that read 38/40, and the rules it taught: 20/40 to 30/40 on a blind set, on the phone.
- **Entire:** [FIELD: one line with the session links above]
- **DigitalOcean:** [PENDING DO BILLING]

[FIELD: thanks, with permission, to anyone who tried it]
