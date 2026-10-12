# Founder review: what's left before you publish

**Deadline:** Mon Oct 12, 06:59 UTC (Sun 11:59 PM PDT, Mon 2:59 AM ET).
**The post:** [draft.md](draft.md) (about 1,770 words; about 130 left for your holes under the 1,900 cap)
**Live:** https://flare-outside.onrender.com, build 0e7a81825764 (the footer shows the build; smoke passes)

**State at hand-off (Sun Oct 11, 11:55 PM ET, main frozen for the 1:00 AM freeze):**
- **Field test 1 live bugs:** all six are fixed and live (photo covered, 10min read as 10 AM, "is at Near", share in Brave, the buzz promise, the stale service worker).
- **Fresh-eyes (AI testers with no context):** rounds scored 5, 6, 5, 6, 6, 6, then 7/10 on the recheck. Every fix from rounds 6 and 6b, and from your leftover list, is live.
- **Gates:** Lighthouse 100 on all 5 pages, mobile and desktop. JS: /app 149.1 KB, /g 148.2 KB, both under the 150 budget. npm test passes 830/830. e2e passes: photo-fit (including a new "every control visible" gate), share (Chrome and WebKit), demo, loop, telegram, sparks, flow, pwa and sw-update.
- **Shipped and live tonight:** Again; Telegram direct send; auto I'm here; rule chips; Since launch totals; the app motion; Why it matters on BLS ATUS 2025 and WHO 2025.
- **Cut or off:** Sounds of the spot (it failed the 100% voice-drop bar); Remember this (off).

## 1. Decisions only you can make

| Decision | Why it matters | Where |
| --- | --- | --- |
| **Make the repo public** | The post embeds it (`{% github Hotragn/flare %}`) and the site links to it. Judges expect to read the code | GitHub → Settings → Change visibility |
| **The agent sessions: scrub, then share** | The `--public` dry run of `npm run scan-sessions -- --public` found **1,539 email addresses and 22 phone-number matches in 101 of 166 checkpoints**, and 0 secrets. Most are likely your account email in session metadata, and some phone matches are probably long numbers. Scrub them before any session goes public | Decide: scrub and share one session, or skip the Entire and DevRelay session parts |
| **DigitalOcean** | The account answers 402 (blocked for billing). The post marks it **[PENDING DO BILLING]** (lines 98 and 178). If billing is fixed, re-run `npm run smoke -- https://flare-outside.onrender.com --hub-off` and look for `cloud tier: digitalocean`, then remove the markers. If not, delete the DigitalOcean prize line and leave the paragraph as "wired in, paused" | DigitalOcean billing |
| **Google AI Studio billing** | On the free tier, Google may use what it receives to improve its products, and people there may review it. Plan asks always go there when the laptop is off; photos only when the host taps. Paid terms stop that use. Today it's disclosed in the app and on the privacy page | Google Cloud console, project billing |
| **Stale image folders** | `apps/web/static/scenic/` and the `-640` and `-1280` files in `apps/web/static/scenery/` are untracked leftovers. Delete them | `rm -r` them yourself |

| **Mastra** | Done: `LADDER_AGENT=1` is on live since 12:03 AM Oct 12 (c5d9da0). Checks: smoke passes; live Plan drafts through the agent with the hub on returned 4 steps on the hub tier (10.6 s cold, then 2.2 to 4.0 s warm); with the hub off, it fell back to cloud Gemma in 1.7 s (and to the template in 7.7 s while the server still thought the hub was there). The prize line stays | Nothing to do |
| **ATUS microdata (next step)** | Our own 2003–2025 series (time with friends, time outdoors) needs 118.6 MB of bls.gov files. Skipped tonight; the chart uses the published 2003–2020 series | Later |

## 2. Fill in the post

Every hole in [draft.md](draft.md), top to bottom. You have about 135 words left in total.

| Line | Hole | What goes there |
| --- | --- | --- |
| 20 | FOUNDER WHY | Why you built it, in your own words. Nobody else writes this |
| 22 | FRIEND QUOTE | A friend's real words and a screenshot, with their OK; or delete it |
| 30 | HERO GIF | Kindling, Lit, Ember, Gone. The motion GIFs are in `media/app-motion/after/` |
| 36 | WHY IT MATTERS | One chart from the site's Why it matters (screenshot `media/site/why-after-375.png`), with its source line |
| 54 | VIDEO | 60 to 90 s, following [shot-list.md](shot-list.md) |
| 62 | met in person? / outdoor test | What really happened at field test 1 and tonight's outdoor test, with numbers; never more than you saw |
| 87 | REPO | Delete the line once the repo is public |
| 130, 187, 196 | ENTIRE | The checkpoint links, after the session scrub (section 4); or delete all three |
| 132 | SENTRY TRACE | A screenshot of an `invoke_agent flare-ladder` trace with `gen_ai.provider.name: google`. To make one, stop the hub and send a Plan draft |
| 185 | AGENT SESSION | The DevRelay embed (section 4); or delete it |
| 198 | THANKS | Names, with each person's OK; or delete it |

Also delete the HTML comment at the top. Check the title, the tags (`devchallenge, hf26challenge` are required) and the cover image (`brand/export/social/dev-cover-1000x420.png`).

## 3. Publish on DEV (your yes)

1. On dev.to, click Create Post, switch to the Markdown editor, and paste all of [draft.md](draft.md), front matter included. Keep `published: false` for now.
2. Upload the cover (`brand/export/social/dev-cover-1000x420.png`) and the images, and replace the paths (section 2).
3. Click Preview. Check that:
   - the first line links the Week 1 challenge;
   - the GitHub embed renders, which only works once the repo is public;
   - the "Details" anchor links jump to their sections.
4. Set `published: true` and Publish. Do this by Mon 06:59 UTC.

A Claude session can do steps 1 and 2 for you through DevRelay (`create_article` with `published: false`). It would only stage a draft in your account, and it needs your yes first. Publishing stays your tap.

## 4. Agent session through DevRelay (optional; it helps the Entire category)

1. Pick the session. Suggested: the Voice Flare build, where Gemma first heard audio, or the round-3 fresh-eyes fix, which found the CSS leak.
2. Scrub it. Run `npm run scan-sessions -- --public` and remove or redact every email and phone match it lists for that session's checkpoint, then re-run until it reports 0.
3. Save it with DevRelay. In a Claude session, ask: "Save this session with DevRelay." It uploads unlisted by default.
4. Make it public in DevRelay, then paste its embed (or link) at line 170 of the post.
5. Add the Entire checkpoint links for the same session at line 172, and one line at 182.

## 5. After publishing

- Open the live post and click every link and anchor.
- Optional: enter the post in the challenge through DevRelay (`enter_challenge`), if the challenge page asks for it. The template line and the `hf26challenge` tag are what the challenge requires.
- Keep the hub running on the Mac (`FLARE_SERVER_URL=wss://flare-outside.onrender.com npm run hub`), so judges trying the live app get Gemma on the laptop and not only the cloud fallback.
