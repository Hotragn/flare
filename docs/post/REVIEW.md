# Founder review: what's left before you publish

**Deadline:** Mon Oct 12, 06:59 UTC (Sun 11:59 PM PDT, Mon 2:59 AM ET).
**The post:** [draft.md](draft.md)
**Live:** https://flare-outside.onrender.com (main, all checks green)
**State at hand-off (Sun Oct 11, about 5:30 PM ET):**
- CI passes: secret scan, lint, types, 775 unit and contract tests, contracts, build, budget, 38 diagrams.
- Every e2e suite passes: hello, pwa, field 27/27, sparks, loop, telegram, kit a11y, demo, plan, voice, flow on the real stack.
- axe finds 0 issues on 88 page views.
- Smoke passes on live.
- check-env: every setting is set, and no secret value is in the repo or the web build (12 values checked in 1,335 tracked files and 374 build files).
- Fresh-eyes testers scored 5, 6, 5, 6 and [round 5]. The post states the final score.

## 1. Decisions only you can make

| Decision | Why it matters | Where |
| --- | --- | --- |
| **Make the repo public** | The post embeds it (`{% github Hotragn/flare %}`) and the site links to it. Judges expect to read the code | GitHub → Settings → Change visibility |
| **The agent sessions: scrub, then share** | The `--public` dry run of `npm run scan-sessions -- --public` found **1,539 email addresses and 22 phone-number matches in 101 of 166 checkpoints**, and 0 secrets. Most are likely your account email in session metadata, and some phone matches are probably long numbers. Scrub them before any session goes public | Decide: scrub and share one session, or skip the Entire and DevRelay session parts |
| **DigitalOcean** | The account answers 402 (blocked for billing). The post marks it **[PENDING DO BILLING]** (lines 98 and 178). If billing is fixed, re-run `npm run smoke -- https://flare-outside.onrender.com --hub-off` and look for `cloud tier: digitalocean`, then remove the markers. If not, delete the DigitalOcean prize line and leave the paragraph as "wired in, paused" | DigitalOcean billing |
| **Google AI Studio billing** | On the free tier, Google may use what it receives to improve its products, and people there may review it. Plan asks always go there when the laptop is off; photos only when the host taps. Paid terms stop that use. Today it's disclosed in the app and on the privacy page | Google Cloud console, project billing |
| **Stale image folders** | `apps/web/static/scenic/` and the `-640` and `-1280` files in `apps/web/static/scenery/` are untracked leftovers. Delete them | `rm -r` them yourself |

## 2. Fill in the post

Every `[FIELD]` in [draft.md](draft.md), top to bottom:

1. **Line 22, your quote.** A suggested version is there; accept or rewrite it in your own words.
2. **Line 40, the video.** 60 to 90 s, following [shot-list.md](shot-list.md). Upload it to YouTube or DEV, then paste the link or embed.
3. **Line 42, the images.** Upload the four images below it in DEV's editor ("Upload image"), and replace each `docs/post/media/...` path with the URL DEV gives you. Optional extras are in [media/README.md](media/README.md), e.g. 03-friend-lit, 09-crew-atlas, 04b-demo-compass-ahead, and sim/fairlane-sim-42.gif.
4. **Line 51, the meetup line.** If you go outside with friends before posting, replace it with what happened, using real numbers. If not, delete only the `[FIELD: ...]` part.
5. **Line 65, the repo.** Delete the `[FIELD: make the repo public.]` text once it is public.
6. **Line 127, a Sentry trace.** In Sentry, open the project's traces view and pick an `invoke_agent flare-ladder` trace whose chat span has `gen_ai.provider.name: google`. Screenshot the waterfall and upload it.
   - To make one: stop the hub on the Mac and send a Plan draft from the live app.
7. **Lines 170 and 172, the agent session.** See section 4. If you skip sessions, delete both lines and the Entire prize line (182).
8. **Line 184, thanks.** Name anyone who tried it, with their OK, or delete the line.
9. **Line 7 to 11, the HTML comment.** Delete it.

Also check:
- the title;
- the tags (`devchallenge, hf26challenge` are required; `gemma, opensource` are ours);
- the cover image: `brand/export/social/dev-cover-1000x420.png`.

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
