# Post media

These are real screenshots from the real app on the real stack: the server, the hub running Gemma 4 E4B on this Mac, the engine and PGlite. They were taken in Chrome at iPhone size (390x844 @2x), JPEG quality 78, on Sun 2026-10-11 at about 15:45 ET, by `scripts/capture-media.ts`. Re-run it with `npm run build && node scripts/capture-media.ts`.

The host picks a real photo through the app's own "Pick a photo": Eagle Lake, Acadia National Park, public domain (NPS, see [docs/credits/photos.md](../../credits/photos.md)). The fake camera's test pattern isn't used. The Ember shot jumps 31 minutes with the e2e test clock, which only exists with an in-memory database. Nothing else is staged.

| File | Moment | From |
| --- | --- | --- |
| 00-home.jpg | Home: golden hour, the weather, the nearest green spot, Light a Flare | capture-media.ts |
| 01-host-words.jpg | The photo developed, with the invite Gemma 4 wrote from it ("Meet by the quiet water's edge") | capture-media.ts |
| 01-host-send.jpg | Send it: how many it needs, where you'll be | capture-media.ts |
| 01-host-sent.jpg | Sent | capture-media.ts |
| 02-friend-invite.jpg | The friend's invite: photo, words, walk time, the count, I'm in | capture-media.ts |
| 03-friend-lit.jpg, 03-host-lit.jpg | It's lit, on both phones, with Tell the chat on the host's | capture-media.ts |
| 04-friend-compass.jpg | Find them: 400 m. A headless browser has no compass, so it asks to hold the phone flat | capture-media.ts |
| 04b-demo-compass-ahead.jpg | Find them with a heading: "The bench by the willow is straight ahead" | e2e demo |
| 05-friend-spark.jpg | Leaving a Spark, with Say it (Voice Spark) | capture-media.ts |
| 06-friend-ember.jpg | Needs 3, one yes, 31 minutes later: the smaller plan at West Road | capture-media.ts |
| 07-telegram-card-kindling.png, 07-telegram-card-lit.png | The Telegram card, Kindling and Lit, from the server's own renderer | earlier capture; the renderer is unchanged |
| 08-voice-flare-send.png | A Voice Flare: "Meet at the pond bench", written by Gemma 4 from what was said, with no photo | e2e voice-flare (real hub) |
| 09-crew-atlas.png | The Crew Atlas, drawn on the phone from the sealed Hot spots | e2e sparks (real stack) |
| 10-plan-lit.png | A Plan solved at the deadline: step 3, the biggest step all three can do | e2e plan (real stack) |
| 11-demo-friend-view.jpg | The demo's friend view | e2e demo |
| 12-site-home-phone.png, 13-site-feature-cards.png | The website on a phone, and the feature cards on desktop | local build |
| 14-desktop-qr-note.png | The app on a desktop: the phone column and "Made for your phone" with a QR code | local build |
| 20-architecture.png | The architecture: phone, server on Render, the laptop hub with Gemma 4 on Ollama, cloud fallback, deletion sweep, ElevenLabs Scribe, Sentry | src/20-architecture.svg, rendered by src/build.mjs |
| 21-storyboard.png | One evening in four frames: Kindling, Lit, Ember, Gone (02-friend-invite, 03-friend-lit, 06-friend-ember, and the demo's outside screen) | src/build.mjs |
| sim/fairlane-sim-42.gif | "A Saturday in Fairlane, played by 48 friends": the simulation (labelled Simulation) | tools/sim |

Re-render the two made images with `node docs/post/media/src/build.mjs` from the repo root.

Still to add: the founder's iPhone screen recording from [shot-list.md](../shot-list.md), and a Sentry trace screenshot from the live project (it needs the founder's Sentry login).
