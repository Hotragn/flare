# Draft v2 outline (for review)

Target about 4,000 words, first person, plain words, no em dashes. Live post (DEV 4836244) untouched; full draft in docs/post/draft-v2.md by 4:15 AM ET.

0. **Opening artefact:** the field test 2 log as a 5-row table (sent 12:38:32, yes 12:39:52, I'm here 12:40:43, We're done 12:43:34, gone from the public audit within 2 minutes), with a link to /api/v1/audit so anyone can check it.
1. **Hook and who it's for:** the 4 PM opener, the problem in plain words, and the five people it's for (friends who stay in, the one who never asks first, the lonely one, the friend with low vision, a group hiking where the signal ends). What Flare is, in one paragraph. "The screen is the shortest part": a photo and one tap, one tap back, then the talking compass so you look up. The founder's why and the friend's quote, both verbatim. A TL;DR with honest numbers.
2. **For judges** (bold labels): the live demo, the app, the code and the Telegram bot. A cold-start warning (Render's free plan sleeps, up to a minute of "Waking up"). Three commands to run it locally.
3. **Try it in 60 seconds:** the exact demo taps.
4. **How a Flare works:** Kindling, Lit, Ember, Gone, with the storyboard and GIFs. Each rule and why it exists: the private count, the quorum, the 30-minute shrink, the deletion. Terms are defined once: quorum, hub, Ember.
5. **Why it matters:** the sourced chart, and one paragraph tying it to my crew.
6. **Taking it outside:** field tests 1 and 2 with real times. A failure table: each break, the fix, and the commit link. The friend's words. The gap: no outdoor walk yet.
7. **Losses and baselines up front:** a table of the measurements that changed the design (photo 73% to 0%, rules 20 to 30 of 40, E2B 29/40 kept it off the phone, Sounds 8/12 so it was cut, testers 5 to 7).
8. **How I built it:**
   - Day 1 was waterfall: research, personas, spec, the SRS with 159 requirements, ADRs, and the ICD frozen before the specialists.
   - Then agile sprints, with a table from git log (sprint, goal, shipped, review result).
   - The roles: per-role sessions, the manager/CTO session, subagents, and the Lab.
   - The gates on every push.
   - Entire's token accounting: why I moved from 9 parallel specialists to one session plus narrow subagents.
9. **Architecture:** the diagram, one paragraph per box, and a "who sees what" table (phone, server, hub, Google, ElevenLabs, Telegram, Sentry).
10. **"Gemma decides" vs "code guarantees":** a table, plus enforce() in 20 lines or fewer, quoted from the real file.
11. **Each technology,** in the same pattern (the job, why this over the alternative, the file or flag, one measured number, what went wrong or what it caught, where to see it):
    - Gemma 4 (the deepest: vision, audio, the ladder, the size comparison, the browser models that failed)
    - Ollama
    - Google AI Studio
    - Mastra
    - Tinker
    - ElevenLabs
    - Sentry Agent Tracing
    - Telegram
    - Render
    - Entire (provenance, cost accounting, the privacy gate for sessions)
    - DevRelay
    - "Not claimed": DigitalOcean (wired, billing paused) and MongoDB (not used).
12. **Read these 6 files:** a table linking each file to its job.
13. **Why open matters:** $0 a photo; the privacy promise checkable at /api/v1/audit; the 1.17 GB buffer I could see. Where closed would win: speed on my busy laptop.
14. **What I got wrong:** my own words first, then the field-test bugs.
15. **What it can't do yet (honest limits):** Simulation labels, untested on a trail, voice input tested only on desktop, the compass lost when an iPhone locks. Then next steps.
16. **My agent sessions:** both DevRelay embeds. Entire: what a checkpoint is, and a real commit with its Entire-Checkpoint trailer.
17. **Prize Categories,** with the exact official titles:
    - Best Use of Gemma
    - Best Use of Tinker
    - Best Use of ElevenLabs
    - Best Use of Mastra
    - Best Use of Sentry Agent Tracing
    - Best Use of Render
    - Best Use of Entire (pending your confirmation)
18. **"Updated after the deadline (Oct 12, 3 AM ET)":** what changed.
