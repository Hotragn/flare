# Challenge and field scan: Hacktoberfest Week 1 "Touch Grass"

Snapshot: Saturday 2026-10-10, entries published up to 16:46 UTC. The deadline is about 38 hours later.

## The challenge

Source: DEV event 79, read through DevRelay `get_challenge_details`, plus the launch post and the HF26 hub.

- Launch post: https://dev.to/devteam/join-the-hacktoberfest-open-source-ai-challenge-week-1-touch-grass-2450-in-prizes-across-17-4pom
- Challenge page: https://dev.to/challenges/hacktoberfest-week1-2026-10-05
- Hub with category rules: https://dev.to/challenges/hf26

| Item | Value |
| --- | --- |
| Prompt | Build something with open-source AI at its core that gets people off the screen and into the world. |
| Bar the organizers set | "The best builds here should make the screen the shortest part of the experience." |
| Bonus | Take it outside, use it, and tell us how it went. |
| Post must explain | Why open innovation matters for what you built, and where open beat closed. |
| Deadline | Sun Oct 11, 11:59 PM PDT = Mon Oct 12, 06:59 UTC = 2:59 AM ET. API `ends_at` is `2026-10-12T06:59:00Z`. |
| Required | A DEV post using the official template, tag `#hf26challenge`. New project built in the window (Oct 5 to Oct 11). One entry per person. Teams up to 4, one post, list teammates' DEV handles. |
| Later commits | Allowed only if noted in the README. Unnoted ones risk disqualification. |
| Judging | Writing Quality (weighted most), Relevance, Creativity, Technical Execution, Use of Partner Technology (optional). |
| Ties | Broken by positive reactions on the post. |
| Prizes | Overall $250 + DEV++ + badge. 6 featured categories at $200. 10 partner categories at $100. 17 winners. One win per person per challenge. |
| Agent session | Optional. "Judges love it." Save with DevRelay, embed with the `agent_session` tag. Uploads are unlisted by default, so make them public and scrub keys. |

A DEV staff member said in the launch post comments that people may submit by their own local time (comment 3ghbj, by heyitsjem). The rules make the sponsor's clock official. For us in ET, 06:59 UTC is later than local midnight anyway, so plan to the UTC time.

### Template sections, in order

1. Opening line: "This is a submission for the Hacktoberfest Open-Source AI Challenge Week 1: Touch Grass" (with the challenge link)
2. What I Built (what it does, how it gets people outside, who it's for)
3. Demo (deployed link or video)
4. Code (GitHub embed)
5. How I Built It (which open-source AI, and how the project is built around it)
6. Why Does Open Innovation Matter?
7. My Agent Session (optional)
8. Prize Categories (list each one, or remove)

Front matter tags in the template: `devchallenge, hf26challenge`.

### Category rules that matter to our stack

From the hub page:

- **Gemma ($200):** use Gemma, run it locally, fine-tune it, or serve it through Google Cloud or another provider.
- **Render ($200):** use Render as the AI runtime, host an agent's front end, or run Hermes or OpenClaw.
- **MongoDB Atlas ($100):** Atlas as the data layer, Atlas Vector Search for retrieval, agent memory, or the database behind an app on an open-weight model.
- **Entire ($100):** share the agent sessions behind the project in the write-up, or search past agent work to explain why code exists.
- **ElevenLabs ($100):** give an open-source agent a voice, transcribe audio for a local model, or narrate the demo.
- **Sentry Agent Tracing ($100):** show setup, latency, tokens, cost, what you found and how you debugged it, with traces or screenshots.

Every entry is judged for every category it qualifies for. Partner credits (Render, Tinker, Backboard, ElevenLabs) are claimed at hacktoberfest.com/my/promos.

## The field

### Method

1. **Listing.** Merged three sources, because DEV's paged API skips and repeats posts as their order shifts (see BUG-001 in docs/BUGLOG.md):
   - DevRelay `get_articles` for the tag, 10 pages of 100
   - DevRelay `execute_dev_api_request` with `top`, 9 pages of 100
   - DEV's date-sorted search feed (`/search/feed_content`), which caps at 800 results per sort direction, run newest-first and oldest-first

   The union holds 2,009 `#hf26challenge` posts. Week 1 entries are those published from Oct 5 07:00 UTC on, without the `weekendchallenge` tag or the Weekend template line. **That leaves 813 entries.** All 48 most-reacted Week 1 posts are in the set. The only gap is Oct 5, 18:00 to 20:58 UTC, the first three hours after launch, which has 7 posts in the set.
2. **Text.** Pulled the article text of all 813 from the CDN-served pages, cut at the end of the article body, with HTML comments stripped (the template's comments mention DevRelay and agent sessions). On three spot checks the extracted text was within 1 to 7% of the original markdown's word count.
3. **Counting.** Counted keyword matches in the title and article text. A keyword match is not proof of use, and the prompt's own examples ("bird call", "run club") inflate some themes. Theme counts use titles only, which is stricter. Small counts (quorum, accessibility, Telegram) were checked by hand.
4. **Reactions.** From DEV API `GET /api/articles?tag=hf26challenge&top=7`.
5. **Reading.** Two research passes read the top 15 Week 1 entries and all 17 Weekend winners in full. Their findings are in the last two sections.

### Volume

- 813 Week 1 entries with about 38 hours to go.
- DEV said the Weekend round "nearly tripled" its previous submission record (winners post, https://dev.to/devteam/congrats-to-the-hacktoberfest-weekend-challenge-build-for-a-friend-winners-pgc).
- Median post length 759 words. Middle half 496 to 1,194. Top 10% over 1,807.

### Themes, by title (n = 813)

| Theme | Entries | Share |
| --- | --- | --- |
| Walk, trail or route planner | 187 | 23% |
| "AI that wants you to stop using it", screen-time framing | 176 | 22% |
| Quest, scavenger hunt or game | 128 | 16% |
| Plants, garden, foraging | 86 | 11% |
| Birds and bird calls | 42 | 5% |
| Sky, stars, weather | 31 | 4% |
| Running, fitness, sport | 16 | 2% |

Name collisions are heavy: TrailMate, TrailQuest, GrassQuest, WildQuest, TouchGrass, FieldNotes and close variants each appear several times. No Week 1 entry has "Flare" in its title.

### Models and runtimes (article text, n = 813)

| Signal | Entries | Share |
| --- | --- | --- |
| Mentions Gemma | 415 | 51% |
| Names Gemma 3 | 175 | 22% |
| Names Gemma 4 | 97 | 12% |
| Qwen | 142 | 17% |
| Llama | 83 | 10% |
| Ollama | 409 | 50% |
| transformers.js | 86 | 11% |
| ONNX | 73 | 9% |
| WebGPU | 53 | 7% |
| MediaPipe or LiteRT | 23 | 3% |
| WebLLM or MLC | 19 | 2% |
| Any in-browser runtime above | 122 | 15% |
| Gemma running in the browser | 38 | 5% |
| Hosted open-model APIs (Groq, OpenRouter, HF, AI Studio) | 105 | 13% |
| Closed APIs named (GPT, Claude, Gemini) | 45 | 6% |

Half the field runs the model on a laptop through Ollama. That conflicts with the organizers' own picture of a phone on a trail with no signal.

### Platform and features (article text)

| Signal | Entries | Share |
| --- | --- | --- |
| Claims offline or no-signal use | 527 | 65% |
| PWA or service worker | 136 | 17% |
| States it was tested on an iPhone or iOS Safari | 7 | 0.9% |
| Native app (Flutter, React Native, Swift, Kotlin) | 20 | 2.5% |
| Telegram | 3 mentions; 1 is a Telegram product ([EcoTrace AI](https://dev.to/xdendix/less-screen-more-green-meet-ecotrace-ai-42c6)) | 0.1% |
| A quorum or "only happens if enough say yes" | 0 | 0% |
| Real-time group play (shared sessions, live location, multiplayer) | 28 keyword hits; about 3 to 5 real cases ([IRL Clash](https://dev.to/someshcoding/irl-clash-go-outside-take-a-shot-win-the-battle-592i), a friends treasure hunt, a bingo with shared card codes) | under 1% |
| Built for people with disabilities | about 2 (GroundSignal, for wheelchair and stroller routes; Sport fit) | 0.2% |
| A deletion audit or proof of deletion | 0 | 0% |
| Night or after-dark use | 33 | 4% |
| Haptics | 17 | 2% |
| Custom sound design (WebAudio, chimes) | 63 | 8% |
| Maps (Leaflet, MapLibre, Mapbox, OSM) | 82 | 10% |
| Geofence or distance checks | 44 | 5% |
| Photo proof checked by a model | 48 | 6% |
| Postgres or pgvector | 26 | 3% |

### Proof in posts (article text)

| Signal | Entries | Share |
| --- | --- | --- |
| GitHub repo link | 667 | 82% |
| Live demo URL (vercel.app, onrender.com, netlify.app, github.io, pages.dev, HF Space) | 321 | 39% |
| Video (YouTube, Loom, Vimeo) | 110 | 14% |
| Describes a real outdoor test | 84 | 10% |
| Mentions automated tests | 107 | 13% |
| Embeds or links a DEV agent session | 41 | 5% |

### Partner categories, by mentions in article text

| Category | Entries | Share | Read |
| --- | --- | --- | --- |
| Gemma (names "Best Use of Gemma") | 254 | 31% | Most crowded |
| Render (any mention) | 140 | 17% | Crowded |
| Render (onrender.com or render.yaml) | 122 | 15% | |
| ElevenLabs | 61 | 8% | |
| TabPFN | 49 | 6% | |
| GitHub Copilot | 47 | 6% | |
| MongoDB Atlas | 33 | 4% | Thin |
| Sentry | 26 | 3% | Thin |
| SerpApi | 26 | 3% | |
| Tinker | 20 | 2% | |
| Backboard | 20 | 2% | |
| Mastra | 16 | 2% | |
| Temporal | 13 | 2% | |
| Entire | 12 | 1.5% | Thin, and an honest fit if we embed this build's agent session |
| Tiger Data | 11 | 1% | |
| DigitalOcean | 10 | 1% | |
| Arduino | 9 | 1% | |

### Reactions

Top Week 1 posts by reactions: PLOT, TabPFN on frost data (66); Side Quest by sizzlebop (36); DeskBreak with Sentry tracing (35); WildProof (30). Reactions only break ties. The Weekend overall winner had 27 reactions while several non-winners had 40 to 86.

## Top Week 1 entries, read in full

12 of the 15 most-reacted Week 1 entries were read in full. WildProof, Leaf Peep and Touch Grass Not Glass returned 503 from DevRelay during the pass. From their saved page text: WildProof runs Gemma 2B on Ollama with Temporal, demo on Render. Leaf Peep scores fall colour from photos with Gemma 4 on DigitalOcean serverless inference. Touch Grass Not Glass runs Gemma 3 on a laptop through Ollama and takes about 2 minutes per photo.

| Entry | Model and where it runs | Field test reported | Note |
| --- | --- | --- | --- |
| [PLOT](https://dev.to/pranjal_manhgaye_d94d7a8f/plot-tabpfn-on-real-frost-data-tells-you-to-touch-grass-54k1) | TabPFN hosted client, FastAPI on Render | No | 30,684-row ERA5 pipeline; labels are heuristics |
| [Side Quest](https://dev.to/sizzlebop/i-built-an-ai-game-that-wants-you-to-go-outside-3a6k) | Gemma 4 E2B ONNX (`onnx-community/gemma-4-E2B-it-ONNX`), Transformers.js, WebGPU on a desktop "home base"; phone pairs through a relay | No | iPhone 12 tab died about 500 MB into a 3.4 GB model download |
| [DeskBreak](https://dev.to/amanmaurya92/deskbreak-the-ai-agent-that-wants-you-to-stop-looking-at-it-with-sentry-agent-tracing-4e9d) | "gemma-2-2b" span; where inference runs is not stated | Generic | Sentry before/after story, 4,200 ms to 320 ms |
| [Zero-Screen Dungeon Master](https://dev.to/vidisha_gupta_/zero-screen-dungeon-master-the-voice-only-rpg-where-your-real-walk-drives-the-story-3m68) | Gemma 2 2B on a laptop via Ollama, stories made ahead of time | No, template placeholders left in | GPS beats every 80 m, blind taps through the pocket |
| [Tendril](https://dev.to/chanadev/tendril-a-garden-assistant-you-never-have-to-open-24d) | Qwen2.5 3B via Ollama, faster-whisper | Yes, one week of plans | Lock-screen image as the output; no live demo |
| [Drift](https://dev.to/codeswithroh/i-built-an-ai-that-only-works-when-my-phone-is-in-my-pocket-3ipn) | Gemma 4 E2B (MediaPipe), Kokoro-82M, Whisper, all in the browser on WebGPU, including iPhone Safari | Yes, about 10 min, screen on 2m5s | 2.5 GB download; closest to "runs on the phone on the trail" |
| [TouchGrass](https://dev.to/rajan_mishra_a9f78ad216b4/touchgrass-the-open-ai-agent-that-succeeds-when-you-stop-using-it-3k1e) | Gemma 2 and TabPFN behind FastAPI on Render | Yes, 22 min under an oak | Claims 5 categories with thin evidence; offline claim conflicts with hosting |
| [FieldIssue](https://dev.to/himanshu_748/fieldissue-take-a-walk-report-a-problem-come-back-with-evidence-e40) | Hosted Gemma API, Qwen3-8B fine-tuned on Tinker | Yes, Lucknow, Oct 9 to 10 | Claims 12 categories; publishes a TabPFN result that lost to baseline |
| [FrostWise](https://dev.to/sarvar_04/i-built-an-offline-ai-that-knows-your-last-frost-date-no-internet-no-api-3b8e) | TabPFN-v2 on CPU, Gemma 3 1B via Ollama | Secondhand | Synthetic 400-row dataset |
| [TrailTruth](https://dev.to/soumyadeepdey/i-distilled-a-397b-model-into-a-4b-one-for-160-it-now-catches-28-of-33-park-alerts-that-should-bic) | Qwen3.5-4B LoRA distilled on Tinker, served from Tinker | No | Strong stats (p = 0.015) |
| [Nature Bingo](https://dev.to/jonathansolvesstuff/i-walked-an-open-models-bingo-card-through-a-town-with-almost-no-nature-records-i-found-2-of-16-649) | TabPFN locally on an RTX 5060 | Yes, Oct 6, 10:18 to 10:54, found 2 of 16 | Honest backtest that loses in the smallest towns |
| [Grow a Song](https://dev.to/anshsaini/grow-a-song-my-run-wrote-its-own-soundtrack-with-gemma-running-on-my-phone-44ml) | Gemma 3 1B 4-bit, MLX Swift, on an iPhone 13 Pro | Yes, 35.1 min, 3.4 km run | Native iOS only; no install path |

Also relevant: [TrailSnack](https://dev.to/aaronstark1/trailsnack-a-trail-companion-that-runs-gemma-with-zero-bars-and-never-says-eat-this-pig) uses EmbeddingGemma (about 280 MB) by default and puts Gemma 4 E2B (about 3.3 GB, WebGPU only) behind an opt-in capability gate that refuses the download on phones that can't run it.

What the strongest of these share:

1. A dated field test with numbers, including embarrassing ones ("screen on 2m5s", "2 of 16").
2. Negative results published openly.
3. The model has one narrow job; plain code enforces the rest.
4. A "what broke" section naming specific bugs.
5. Less screen time is built into the mechanics: audio that plays with the phone locked, a printable card, a lock-screen image, a screen-on counter.

Gaps across this set: group play in the same place; any Android-native entry; AI that reacts to live location during the walk; accessibility; evidence from more than one person on one walk.

Evidence for our engineering plan: Drift ran Gemma 4 E2B in iPhone Safari through MediaPipe (2.5 GB). Side Quest lost an iPhone 12 tab partway into a 3.4 GB ONNX download. In-browser Gemma on iPhone is possible and fragile, and the runtime and file format matter.

## What won the Weekend round

Source: winners post, https://dev.to/devteam/congrats-to-the-hacktoberfest-weekend-challenge-build-for-a-friend-winners-pgc. The overall, Gemma and MongoDB winners were read in full by the lead. 12 of the other 14 were read in full by a research pass. ElevenLabs (Padh Ke Batao) and Temporal (PaidYet) returned 503.

| Category | Entry | What earned it |
| --- | --- | --- |
| Overall | [Before I Call](https://dev.to/adk_bbx/phone-calls-are-the-boss-fight-of-living-in-japan-1h6h) | Real problem (phone calls in Japan); live demo on Render and a video; the friend's WhatsApp reply as a screenshot; a 6,107-entry pronunciation dictionary; Sentry catching a missed hang-up 8 times; a local mode that is honestly worse. 27 reactions. |
| Gemma | [Kitchen Table](https://dev.to/uptimearchitect/gemma-4-reads-my-parents-mail-at-home-39-test-letters-9-of-them-real-and-one-calm-wrong-answer-3obf) | gemma4:e2b, e4b and 26b compared on 30 synthetic and 9 real letters. Code owns dates, scams and urgency. A held-out set kept untuned. |
| MongoDB Atlas | [Legacy Loom](https://dev.to/raphelevator/i-turned-my-sister-in-laws-voice-notes-into-a-cookbook-that-answers-in-her-voice-41ja) | Audio in GridFS streamed with byte ranges, so a citation jumps to the exact second. Atlas Vector Search and Atlas Search merged with reciprocal rank fusion. |
| Render | [Tala](https://dev.to/highcenburg/tala-free-audio-to-text-for-my-designer-friend-no-signup-no-credit-card-2o26) | The model itself runs in the Render container (faster-whisper int8). render.yaml Blueprint, Render Postgres, region picked for the friend, auto-deploy, benchmark table. Five other winners hosted on Render and didn't win this category. |
| TabPFN | [Race Card](https://dev.to/iamrobertmoore/my-mate-wants-a-sub-5-703-before-recommending-one-i-made-an-open-model-predict-79-of-my-old-race-4kcp) | Backtest: 62 of 79 legs inside the 80% range, against four baselines. |
| Tinker | [Rakshak](https://dev.to/muaazsm/rakshak-i-built-my-parents-a-scam-checker-that-never-leaves-the-house-22ah) | LoRA eval on 100 public fraud reports with bootstrap intervals; false alarms 43% to 9%; about $3.80 spent. |
| Arduino | [JARVIS](https://dev.to/abhinavkrishna3211/jarvis-ai-lab-assistant-18jp) | Everything on an UNO Q; a 60-command eval where the model alone lost to rules. |
| DigitalOcean | [BMW manual](https://dev.to/alexgeorgiev17/i-couldnt-legally-use-the-repair-manual-so-i-built-my-friend-something-better-84) | gemma-4-31B on DO serverless; about $0.002 a question; a table of what the friend's feedback changed. |
| Backboard | [Kharcha](https://dev.to/coffeeandcommits/kharcha-a-4b-model-that-reads-indian-bank-sms-so-the-money-stays-on-your-laptop-2n8j) | 97% all-fields accuracy on 150 held-out messages vs 28% base. |
| Entire | [Viva](https://dev.to/iamwasih/viva-a-mock-interview-that-knows-which-parts-of-your-project-an-ai-wrote-ahe) | Used Entire's session links as product data. About 900 words. |
| GitHub Copilot | [Steady](https://dev.to/dosunmu_hassan_46f2ac141d/i-built-a-panic-button-that-doesnt-tell-me-anything-published-4glf) | GitHub Actions as the model runtime; a failed LoRA reported and its Tinker claim withdrawn. |
| Mastra | [Prep Buddy](https://dev.to/bipul_chamoli_09b5f0cc719/prep-buddy-an-ai-interview-coach-for-my-classmate-that-runs-on-his-laptop-with-the-wi-fi-off-426b) | Three agents with Zod schemas; a prompt-injection score of 2/10 reported as weak. |
| Sentry | [Actually](https://dev.to/arqamwd/if-its-not-in-front-of-me-its-gone-i-fine-tuned-a-4b-model-for-my-friend-with-adhd-o4) | Traces showed TabPFN, not the LLM, was the slow part; 3.25 s to 268 ms. |
| SerpApi | [Pīzhù](https://dev.to/muhammadmurtuzahussain/pizhu-pi-zhu-a-writing-tutor-that-never-rewrites-your-essay-built-for-my-friend-joy-gemma-4-2n6e) | Google Scholar reference checks, with a planted fake reference in the sample. |
| Tiger Data | [Nivara](https://dev.to/priyanshu_jha_eee132b17e5/my-friend-runs-her-supplements-shop-from-whatsapp-voice-notes-so-i-built-her-a-shop-helper-5785) | Hypertables, continuous aggregates, hybrid search. Claimed 7 categories, won 1. |
| ElevenLabs | [Padh Ke Batao](https://dev.to/rahullkumr/padh-ke-batao-an-ai-that-reads-my-grandfathers-documents-to-him-on-a-laptop-with-no-gpu-3818) | Not read (503). |
| Temporal | [PaidYet](https://dev.to/prateek11rai/paidyet-for-the-friend-who-says-kal-bhej-dunga-p5l) | Not read (503). The listing says it is a Telegram bot with local Gemma and Temporal reminders. |

Traits shared by the winners, ranked by how often they appear:

1. A named person and their problem in their own words, near the top.
2. A frank "what went wrong" section with concrete bugs.
3. Measured numbers, usually in a table.
4. An open-model argument tied to that person (privacy, cost, offline), not a generic one.
5. One specific line per claimed partner category.
6. Code-enforced guardrails: the model picks the words, code owns the facts.
7. A baseline comparison, including cases where their own model lost.
8. A live demo or video plus screenshots (all but one).

What didn't decide it: length (Viva won at about 900 words), reaction counts, numbers in the title (3 of 12), leftover template comments (2 winners had them), or how many categories were claimed (each entry won at most one).

Category bars:

- **Render:** the model or agent has to run on Render, not just the front end.
- **Gemma:** being there isn't enough, since 31% of the field names the category. The winner compared model sizes on a test set and let code check the output.
- **MongoDB Atlas:** Atlas has to do something only Atlas does well for the product (GridFS byte-range streaming, hybrid vector plus text search). One more database among seven claimed categories did not win.

## Checks on the founder brief (FLARE-SPEC v2, section 10)

| Founder claim | Finding |
| --- | --- |
| Gemma on Ollama is ordinary | Confirmed. 51% mention Gemma, 50% use Ollama. |
| On-device in the browser marks the top entries (Side Quest, TrailSnack) | Partly. 15% of all entries use an in-browser runtime, so it is common. Side Quest runs the model in a desktop browser that the phone pairs with; its iPhone 12 attempt crashed. TrailSnack keeps the 3.3 GB E2B tier opt-in and gated. Drift is the one entry that ran E2B in iPhone Safari (MediaPipe, 2.5 GB). Only 7 of 813 say they tested on an iPhone. The rare part is proof that it runs on real friends' iPhones. |
| Nobody combined quorum, provable deletion, accessibility, Telegram plus iMessage links | Confirmed, and each piece is rare on its own: quorum 0, deletion audit 0, disability-focused about 2, Telegram product 1, real-time group play about 3 to 5. |
| No notable entry advertised open-source storage (Postgres) | Not supported. 26 Week 1 entries (3%) mention Postgres or pgvector, and 3 Weekend winners used Postgres (Tala, Prep Buddy, Nivara). Separately, MongoDB's own FAQ says the SSPL "has not been approved by the OSI" (https://www.mongodb.com/legal/licensing/server-side-public-license/faq), and Atlas is a managed service. Postgres helps a "fully open" story; it doesn't set us apart. |
| Render is crowded, Gemma very crowded, aim for Overall | Agreed. Gemma 31%, Render 17%. |
| About 540 Touch Grass entries | 813 by Sat 16:46 UTC. |

Sunday timing: sunset in Dearborn on Oct 11 is about 6:57 PM EDT (NOAA algorithm at 42.31 N, 83.22 W). Sunrise is about 7:40 AM EDT.
