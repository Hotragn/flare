# Sunday backlog (after the deploy)

Every founder and manager ask from Sun 2026-10-11 after the deploy, in the order set by the manager. Status is kept here; RESUME.md points here. Live: https://flare-outside.onrender.com (main). Redesign work: branch `redesign`.

| # | Item | Status |
| --- | --- | --- |
| 1 | Deploy to Render free tier, smoke x2, setWebhook | Done (smoke all required pass; photo draft hit 6 s while Ollama was shared: recheck). Live tap needs a human |
| 2 | Redesign fixes from the manager review: Home time format, Home filled with the outside, weather icons, access chips, invite count ring, Lit "outside together" | Done on `redesign` except the Crew strip on Home (with #5). Open: invite backdrop black in capture; Home season line filter |
| 3 | After an outing: "You were outside N min together", Spark prompt, Phone away | Done on `redesign` |
| 4 | Onboarding (3 swipe cards over scenic photos, name once, make or join a crew), Try-it demo mode (3 demo friends on a test clock: light, find, Ember, Spark; marked demo; no real data), first-time tips (one line, once), empty states everywhere | To do |
| 5 | Crew dashboard as home of the crew: flame avatars glowing when out now, week-outside ring, Hot spots and Sparks as postcards on scenic photos, Crew Atlas mini-map, smooth transitions; one "Manage crew" sheet (invite link + QR, rename, default quorum, Telegram + photo opt-in, remove member with key rotation, leave, Forget). Never show who said no or answers. Outside-minutes counter + ADR-0024 | To do |
| 6 | Scenic open-licensed photos (CC0 / Public Domain / Unsplash / Pexels only; Michigan and Fairlane area plus iconic places), Ken Burns crossfade on home hero, onboarding, empty states, website; credits file + NOTICE/SBOM; AVIF/WebP sizes, lazy, off the critical path; reduced motion = still; contrast through the scrim | To do. Downloads need care: licensed sources only, record source/author/license |
| 7 | Automation with guardrails (opt-in, rate-limited, off-switch in Manage crew, no tracking): Plan auto-solve at deadline, T-3h "still coming?" private fade, reminder 30 min before start, auto-save locked plan offline; weather-aware Ember (covered spot or earlier time, one-line why); golden-hour nudge (opt-in per crew, once a day, quiet hours, one tap pre-filled Flare); weekly recap from counters; "Tell the chat" share-back on Lit for iMessage. Tests for each | To do |
| 8 | Sentry: Mastra agent runs as Agent Tracing (agent run, tool calls, model calls: tier, model, latency, outcome only), server error monitoring and route performance; same allow-list and scrub test; no Sentry on phones | To do (after S2 merges) |
| 9 | Voice Flares (hold to speak, Gemma 4 audio on the hub writes invite and scene, transcript never stored, accessibility-first) and Crew Atlas (Gemma turns outings, Sparks, Hot spots into a private map of your places, facts only from data, encrypted) | To do |
| 10 | Merge S1 (sim, branch `sim`) and S2 (Mastra Plan agent, branch `mastra-plan`) at green | Subagents running |
| 11 | Page audit: home, light a Flare, invite, lit / find them, Ember, after-outing, Plan create / answer / result, crew dashboard + manage, Crew Atlas, rest loop, fix the map, needs / settings, AI on this phone, privacy, accessibility, website pages, /sim/. No dead ends; every flow ends pointing outside. Lighthouse 100, axe 0, JS budget | To do |
| 12 | Recapture docs/post/media from the new UI; post rework: no outdoor group-test claim unless one happens; built on real-stack runs, iPhone device checks (16 Pro Max, 13), live Telegram checks, deletion audit; signature-moments checklist (docs/post/signature-moments.md) driving the prize section | To do |

Signature moments to finish each tool around (proof for each): Gemma (photo spoken to a low-vision friend, then the talking compass; Voice Flares), DigitalOcean (a crew with no laptop; hub drop mid-Flare with no failed invite; trace plus cost math), Sentry (debug the agent without seeing anyone's words; trace next to the scrub test), Mastra (an agent that never lets a plan die; eval vs old ladder plus a trace), Entire (which AI teammate wrote each line; checkpoint links after the scrub), the simulation ("A Saturday in Fairlane, played by 50 friends", labelled Simulation).

## Added ~12:40 ET (manager, founder)

| # | Item | Status |
| --- | --- | --- |
| 13 | 5-second clarity: website hero one line + one picture + big "Try the demo"; app first run onboarding → demo → make a crew; a fresh-eyes subagent (no context) uses the live site and reports every confusion; fix them | To do (after Crew) |
| 14 | Website feature section in the go-outside theme: a card per feature (private yes + quorum, Ember, Plan + fade, Find them, accessibility, offline, Telegram + iMessage, Sparks + Atlas, Crew space, Voice Flares, auditable deletion, automations), 3-6 word title, one sentence, small real screenshot or loop, "Try it" deep link into the demo; "Built with" strip linking each tool to its signature moment; keep Lighthouse 100 | To do (after #13) |
| 15 | Gemini API cloud tier (GEMINI_API_KEY, Gemma 4 via Google AI Studio): check model IDs and free limits; text jobs when no hub, photo only on explicit tap, daily cap, privacy page, ADR; DigitalOcean first if it comes back, else Google; demo stays offline | Done (ADR-0026; live ladder 1.4 s, photo 1.6 s with thinking minimal; redeploy + hub-off smoke pending) |
| 16 | ElevenLabs: warm voice for low-vision guidance (reads invite, scene, compass lines; generated text only, never people's audio; optional, on-device fallback, cached per Flare, deleted at Gone); Voice Spark (opt-in 10 s own memory → Scribe → text, audio discarded at once); privacy page, ADR, honest "the one closed API" note. NOT recording group conversations (consent, leaves nothing behind) | To do |
| 17 | Tinker fine-tune (S3 subagent, branch `tinker`): LoRA on a small open model for a measured failure (conditions hard set 15/20), before/after evals, model card | Running |
| 18 | Env aliases: ELEVENLABS → ELEVENLABS_API_KEY, TINKER → TINKER_API_KEY, GEMINI_API_KEY (+ GEMINI_PROJECTNO, GEMINI_PROJECTNAME) in env.ts and check-env; never printed | In progress |

Order after Crew: 13, 14 (website), 15, 16, 9 (Voice Flares, Atlas), 10 + 17 (merge S1, S2, Tinker), 11, 12.
