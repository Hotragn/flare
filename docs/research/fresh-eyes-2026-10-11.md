# Fresh-eyes test, Sun 2026-10-11

A subagent with no project context used the live site (https://flare-outside.onrender.com) as a phone (390×844, touch) and once at 1280×800. It read no source or docs. It typed only the name "Test" and sent nothing. Score: **5/10** for "I'd understand and use this in under a minute". The idea was clear in about 10 s; the trust to send one took much longer.

Its first-5-seconds guess: "A free web app to get a few friends outside. Take a photo of where you are, send a link, it only happens if enough people say yes, then it deletes itself." That is right.

## Issues, worst first (status in the backlog, #13)

| # | Where | What it saw | Fix |
| --- | --- | --- | --- |
| 1 | App, Send it | Onboarding text, dots and "Skip" show through the compose sheet; "Skip" sits under the X | Unmount onboarding when done; solid stage behind compose |
| 2 | Demo | Toast "Amor said yes." right under "Nobody sees who." | Demo toasts say "Someone said yes" |
| 3 | Demo | Unclear who I am: I send, then "Fuego is waiting", "Find them" points at me; chips F A B | One clear role: "You sent it" and the friends as friends |
| 4 | Demo | Never shows the friend's side (I'm in, Add a condition) | A "What your friends get" step |
| 5 | App, start | "Try a demo" brown on near-black; "Got a link?" dark orange on black | Light outline and text, 4.5:1 |
| 6 | App, start | "Got a link?" only adds a line of text | Paste-link field, or plain text |
| 7 | Site, How it works step 1 | The photo print renders as a 25 px grey strip | Give the print a width; check the image |
| 8 | Demo | "0 more to light it" without "It's lit"; Ember place changes a second later; "outside 34 min" for a 15 min plan | Say "It's lit"; one place; minutes match the plan |
| 9 | Demo | No meetup moment; "Close" loops to the start; X goes to about:blank from a direct link | End with "Light a real one"; X goes to / with no history |
| 10 | App, draft | "Made on our laptop" reads as a privacy surprise; "no trackers" vs Sentry on the privacy page | Plain line about Gemma and not storing; "no ad trackers" |
| 11 | Everywhere | Jargon: Gemma (a person?), Kindling/Lit/Ember, Spark, crew, Hot spots, "2 in, 3 to go ahead" | Plainer copy; "2 of 3 needed" |
| 12 | Compose | Lone pencil for the place; empty box; hint looks pre-filled | Labelled "Where you'll meet" row |
| 13 | Camera | "Settings, then Safari" shown on Chrome | Browser-neutral line |
| 14 | Several | Faint text: "Only your crew sees it.", Skip pill on sky, disabled Save, text on drawings | 4.5:1 everywhere |
| 15 | Site, mobile | No nav links in the header | A row of links |
| 16 | Site | "Run it yourself" makes the hosted app sound optional; repo "goes live" line | "No install needed"; fix the code block wrap |
| 17 | Privacy, Accessibility | Dated placeholders ("after the field test on Sun Oct 11"); unlinked DEV post mention | Update or remove |
| 18 | /how/ | Repeats the landing | Real step-by-step with screens, or drop |
| 19 | App, desktop | Full-width Next button, text hugs the left | Phone-width column on desktop |
| 20 | Small | 5-word invite called six words; "Stop talking"; compass has no arrow; same icon for crew and Hot spots | Copy and icon fixes |

Tooling note: Playwright's normal `.click()` timed out on app and demo buttons (something keeps moving under them); touch taps worked.

## What worked
The headline and subtitle, the "Demo · nothing is sent" badge, the "Can't make it?" sheet, "it shrinks instead of dying", the privacy page's "Limits we're honest about", and asking for a first name only.

Screenshots: kept in the session scratchpad, not committed.

## Round 2 (6/10, after the round-1 fixes went live at 86d5b65)
Worst: two place fields on Send that disagreed; the demo dropped the typed place; unexplained names (Amor, Fuego, Benny); a condition saved silently; counts that didn't add up; the phone home headline below the fold; a box in a box on fields over photos. All fixed in 0842d28.

## Round 3 (5/10, on 0842d28)
Worst two were one bug: site.css was global, and SvelteKit keeps it after a client-side jump from the website into /app/, so the site's `.hero` (navy fill) and `.art` (230 px tall) rules hit the app's own `.hero` and `.art` (the Send photo hidden under a navy block; the onboarding photo squashed). Fixed by scoping site.css under `.site` (8260be8). Also fixed: the menu had no way out (close button, room to tap outside), the demo condition skipped the parser, Benny's yes was never shown, no "back to you" after the friend's view, Plan date fields overflowing on phones, and the privacy page said the weather lookup happens only for Plans (it also happens when Home opens).

Rounds were capped at 3 by the manager (time). Next round after the feature work.

## Left from round 3 (by severity)
1. Demo coach bar covers the sender's Share / Text reply / Cancel buttons on Kindling.
2. The phone's Back button leaves the app instead of closing a sheet.
3. Closing Send drops the photo and words without asking.
4. One plain sentence for where the AI runs, used everywhere ("Made on our laptop", "AI on this phone", "an open model").
5. "Use these" for one line; Edit in the demo empties the place field; "Pocket it", "Put it away" and "Phone away. Flare will wait." puzzle newcomers.
6. The menu shows 10 items on a first visit; "Forget this group" before joining one.
7. Phone home: "Open Flare" twice above the fold; the tagline says little; the sticky header lets text show through.
8. Duplicate headings in the DOM on Home and after an outing (screen readers may read them twice).

## Round 4 (6/10, on 1d318fb, after the feature work)
Fixed in the next commit:
- The demo's counts didn't add up: 2 in, then a smaller plan, then "3 of you are here" with an unseen Benny. The bench was 40 m on one screen and the compass said 150 m.
- The condition read-back asked "Right?" with no way to answer, and the banner doubled to "You're in if: Got it: ...".
- Placeholders named the demo characters.
- The demo's X went to about:blank from a fresh tab.
- Edit emptied the place field.
- Finishing the demo led into three more intro slides.
- The greyed Send had no hint.
- Two buttons were both named "Close".
- The site header let text show through.

Left:
- The compass has no rotating arrow.
- "Mute sounds" and "Mute voice" sit on one screen.
- The menu has 10 items and two share an icon.
- "Use my words" is disabled while the draft develops.
- Pre-filling the place from location, which only happens on H2's location step today.
- A "best on your phone" note on desktop.

## Round 5 (6/10, on 376115a, the last round)
Fixed after it:
- **Who you are.** The demo now shows who you are on every step ("You: Fuego, the host" or "You: Amor, a friend").
- **What to tap.** There are coach lines for the shrink and the compass.
- **Clearer buttons.** "Back to you" and "Next" replace "Pocket it" in the demo.
- **Copy.** "Use this"; "No bench or restroom info here"; "Host your own"; the home example now names a third friend.

Left:
- the host line on your own screen is in the third person ("Test is waiting at West Road");
- the suggested park vs the street name at the spot;
- the X on the demo's last screens;
- buttons kept in the DOM behind the demo coach card;
- "Sent a moment ago" never updates;
- a gap above "What it does".

## Round 6 (6/10, on 68afd9b, live, 10:45 PM ET)
The same method as before: a new subagent with no context, on the live site at 390×844 (with checks at 375×667 and 1280×800). It used a dim photo (the darkened real photo fixture) as "its own photo". Its traffic carried `x-flare-test: 1`, so it isn't in Since launch.

First 5 seconds: "A free web app for inviting friends outside. Friends say yes privately, and the plan only happens if enough people say yes."

The photo: it stayed visible on the invite and Send screens. The dark photo was "dim but readable", and Gemma read it as "A dirt path winding through dense, dark foliage and trees."

**"Would you use this over a WhatsApp poll? Why or why not?"** (verbatim)
> For a quick "anyone free for a walk now?", maybe. The private yes and the "only happens if enough come" rule are real wins over a poll, where everyone sees who said no. For a normal meetup I'd still use the WhatsApp poll. It sits inside the chat where everyone already is, it's never lost, and nobody needs to keep a tab open with the sound on. Here, losing my own invite on reload would put me off for good.

Fixed after it (before the 1 AM freeze):
- **The live invite was lost on reload.** Home now shows "Your Flare", which reopens the live Flare and its link (flow test).
- **"Sent." before anything was shared.** The heading is now "Ready. Share the link." until the host shares, or the Telegram group got it.
- **"10min only with you" lost "only with you" in the demo.** The demo passes the host's name the way a friend's phone does.
- **"after 10" at 10:40 PM became 10 AM tomorrow.** A bare hour that already holds (up to 6 h back) now stays tonight: 10 PM. blind_40 is still 30/40.

Then fixed, the founder's leftover list (23:10 ET):
- **At 375×667 the sheet hid the 2/3/4 size buttons** (a real bug). Send now puts the size first, uses a smaller print on short screens, and on a first send hides the tip there. A new gate, "every control is on screen and uncovered at first paint", runs on invite, develop, send and the demo's Send at 390×664, 375×667 and 390×844. It failed before the fix (2, 3, 4, Edit) and passes now.
- **The demo coach card covered the photo.** The coach line now sits inside the sheet; the gate measures 0% of the photo covered.
- **The location was asked twice.** Develop no longer opens its own sheet. The one ask is on Send, a "Use my location" button next to the place it fills.
- **"Need N more"** is now the wording everywhere, including the count ring.
- **"Judging? 60-second tour"** moved to the footer as "Take the 60-second tour".
- **"Made on our laptop · Photo not kept"**: "Made on our laptop" is a fixed requirement string (SRS-AI-4), so it stays. The hint beside it now reads "Gemma 4 wrote it and kept no copy. Edit anything." on the laptop tier only, because the cloud tier can't promise that.

Earlier left list: the location is asked twice (the "Name your spot?" sheet, then Send asks for "where you are"); the bottom sheet hides the 2/3/4 buttons at 375×667; the demo coach card over the photo; "N more to light it" vs "Need N more"; "Judging? 60-second tour" reads odd to normal users; "Made on our laptop · Photo not kept" sounds hobby-grade.

## Round 6b (7/10, on 72ade11, live, 11:15 PM ET)
Same method, a new no-context AI tester, the dark photo, traffic marked x-flare-test. Every button was on screen and tappable at 375×667 on every screen it tried, and the photo stayed visible.

**"Would you use this over a WhatsApp poll? Why or why not?"** (verbatim)
> For a spur-of-the-moment walk, maybe. Saying yes privately and the "it only happens if enough come" rule are really nicer than a public poll where nobody wants to vote first. The photo also makes it feel real. But my friends are already in the group chat, and I'd still have to paste a link there. As a host I couldn't see who was coming, or that someone had a condition, so I'd end up asking in WhatsApp anyway. Not until the host side gives me more.

Fixed after it (before the freeze):
- **"Use my location" outside the map left the field empty with no word why.** It now says "Got your location. Type a place name to send."
- **The shared text after "Your Flare" was "\nNeed 1 more."** The invite words now come back with the live Flare, and the text is trimmed.
- **"10min only with you" lost "only with you"** when the host's name wasn't on the friend's phone yet. It's now said back ("I didn't catch: only with Sam"), never dropped. blind_40 is still 30/40.
- **A skipped view transition threw a page error on slow devices** (sparks e2e). It's now caught.

Left:
- The host's waiting and lit screens don't show the photo or the invite words.
- The host can't see that a friend added a condition.
- The name is asked again for some returning users.
- "Your Flare" is one of five look-alike links.
- "Here: 1" when nobody tapped I'm here.
- On desktop, the QR code carries the full invite link.
- "Whose laptop?"
