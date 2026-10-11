# Flare 2026: the direction

Sun 2026-10-11. Written after the device check, when the founder saw the real screens on an iPhone and said they "look like a 2015 app". The manager session agreed. This replaces the paper-and-serif look of [05-design-system.md](05-design-system.md) for the app; tokens, accessibility rules and motion timings carry over.

Before screenshots (real app, today): [redesign/before/](redesign/before/). After screenshots go in `redesign/after/` once each screen is built.

## The roundtable

A design review run as a structured exercise. The product designer and the motion designer are this project's own roles (handoffs 04 and 05). The other voices are *personas*: how each of those people is known to think, applied to our screens. They are not quotes and not endorsements.

| Voice | Looked at | Said, in short |
| --- | --- | --- |
| Product designer (handoff 04) | Send, invite | We built forms. A first-name field on every send, three lines of small text under the photo. Cut to one decision per screen. |
| Motion designer (handoff 05) | Lit, Ember | The flame is our best asset and it sits in a box. Let the state change take the whole screen for half a second. |
| Steve Jobs (persona) | Everything | "The photo is the product." Make it the screen, edge to edge. Then remove until it breaks. |
| Brian Chesky (persona) | Home, after an outing | Design the trip, not the booking. The app should feel like the start of an afternoon, and end with "you were outside 52 minutes together". |
| Evan Spiegel (persona) | Invite, Spark | Open to the camera, talk in pictures. A friend should understand the invite in one second without reading. |
| Senior iOS 26 designer (persona) | Components | Use the system's language: SF via `system-ui`, Liquid Glass sheets over content, big rounded actions in the thumb zone, sheets you can drag. Glass only where there's something behind it, and check contrast on the worst photo. |

Where they disagreed and what we chose:

- **Fraunces.** Jobs and the iOS designer wanted it gone; the product designer wanted to keep the six words special. **Decision:** keep Fraunces for the six words only (the invite line on the photo), SF everywhere else.
- **Glass everywhere vs legibility.** The iOS designer's rule wins: a translucent sheet only over the photo, with a scrim behind the text so contrast is at least 4.5:1 on any photo (checked on the brightest and the busiest test photos).

## Rules anyone can check

1. **The photo is the screen.** Invite, send, lit and Ember show the photo full-bleed behind everything. No framed thumbnail.
2. **One big action per screen**, 56 px tall, in the thumb zone. A second action is a text button at most.
3. **Text: an icon plus 3 to 5 words.** Any line longer than 8 words moves behind a "More" tap, or goes.
4. **Ask the name once,** at first run. Never on send.
5. **System font.** `system-ui` (SF Pro on iPhone), with Dynamic Type-like sizes: 34 / 28 / 22 / 17 / 15. Fraunces only for the six words.
6. **Glass sheet** for content over the photo: blur 24 px, a 40% dark scrim under the text, 28 px top corners, a grab handle; drag down to collapse.
7. **The flame is alive.** Kindling grows with each yes; Lit fills the screen with warm light for 600 ms, then settles; Ember shrinks with a soft note. Reduced motion: the colour change only.
8. **Every flow ends pointing outside.** The last screen of every flow says where to go or tells you to put the phone away.
9. **Keep what works:** axe 0, 44 px targets, the JS budget, Lighthouse 100 on the website, the copy deck as the only source of strings.

## Screen by screen

| Screen | Before | After |
| --- | --- | --- |
| **Home (new, B)** | The camera, straight away | "Golden hour in 47 min" and today's weather window at the top; the nearest green spot from the map pack with its one-thing-worth-noticing line; "3 h 10 min outside together this week"; one big **Light a Flare**; **Plan for later** as text |
| **Send** | Photo in a frame, a first-name field, quorum, host line, info lines | The photo full-bleed; the six words over it in Fraunces; a glass sheet with "Goes when [2] [3] [4] are in" as three big chips and **Send it**. Name asked once at first run |
| **Invite** | Small photo, host line, four lines of info | The photo full-bleed; the six words big; "Fuego · 9 min walk" and the count as dots on a glass sheet; **I'm in**; "Add a condition" as text |
| **Lit** | Flame in a box, "It's lit." | The whole screen warms to the lit colour for 600 ms, the flame grows and settles over the photo; the spot and walk time; **Find them** |
| **Find them** | Dial on paper | Dark, full screen, the flame pointer large, distance in 64 pt SF, one line of direction; "It points once you're at least 30 m apart" only when close |
| **Ember** | "Smaller plan" title and info lines | The flame shrinks to the ember dome; "Smaller plan: 15 min at West Road" in two lines; **I'm in** |
| **After an outing (new, B)** | "Thanks for coming." | "You were outside 52 min together" over the photo; the Spark prompt; then a calm **Phone away** screen (dark, the flame breathing slowly, nothing to tap but Done) |
| **Crew (new, A)** | Hot spots and Forget as separate menu pages | One space, below |

## Crew (A)

One home for your people. **Never shows who said no, or anyone's answers.**

- **People:** each member's first name and initial in a circle, no profiles. A small "out now" dot only for people who are Lit or have arrived in an active Flare. No tracking, no location outside a Flare.
- **The crew's story:** Hot spots (from the sealed blob), recent Sparks, and stats from the existing counters: "4 outings · 3 h 10 min outside together · 2 Embers saved".
- **Outside minutes:** a new per-group counter, the minutes from each person's arrival to Gone, summed. It stores a number per group, never who or where, and it is deleted with the group. ADR-0024 records it.
- **Manage:**
  - invite with a link and a QR code
  - rename the crew (the name is sealed, like every name)
  - set the default quorum
  - Telegram connection and the photo opt-in (moves here from "Post in Telegram")
  - remove a member: only the crew's creator can, and it rotates the group key, so the removed member's phone can't open anything new (ADR-0024)
  - leave the crew
  - **Forget this crew** (deletes everything, as today)

## Order of work

1. Design system: system font, the type scale, the glass sheet, the full-bleed photo layout, the big action. Website follows the same type.
2. Send, invite, lit, Find them, Ember, Spark on the new system.
3. Home (B) and After an outing (B).
4. Crew (A), with its server pieces: the outside-minutes counter, member removal with key rotation, ADR-0024.
5. Re-check axe, the JS budget and Lighthouse; recapture `docs/post/media` from the new UI.
