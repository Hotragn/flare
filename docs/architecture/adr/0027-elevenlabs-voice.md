# ADR-0027: ElevenLabs for a warm compass voice and Voice Spark

Status: Accepted (Sun 2026-10-11).

## Context
Flare's compass talks so a friend who can't look at the screen (low vision, bright sun, hands busy) can still find the group (SRS-CMP-1). It used the phone's built-in voice, which on many phones sounds flat or robotic. The founder asked for ElevenLabs as the signature voice, with two limits: use it only to voice text Flare itself generates, plus an opt-in way for a person to say their own Spark. Never record group conversations: the people around you didn't agree to it, and Flare's promise is that it leaves nothing behind.

The ElevenLabs account is on the free tier: 10,000 characters a month (0 used when this was written), 3 custom voices, premade voices available.

## Decision

### 1. Warm voice for the compass: recorded once, shipped as files
- **What it says.** A fixed set of 54 short lines from the copy deck, recorded once by `scripts/gen-voice.ts` into `apps/web/static/voice/` with a manifest:
  - distances: 5 to 95 m in steps of 5, 100 to 950 m in steps of 50, and 1 to 5 km;
  - directions: slightly left/right, to your left/right, behind you;
  - other lines: "Straight ahead.", "You're close. Look around.", hold flat, no GPS, and figure 8.
- **No names.** The lines never include the friend's or the spot's name. A spoken compass line that includes a place name would have to send that name to ElevenLabs at run time. These clips leave that out, and the name stays on screen.
- **Cost and size.** 698 characters, once: 7% of a month's free allowance. 54 MP3 files at 64 kbps, 684 KB in all. A re-run keeps existing clips and spends nothing.
- **Opt-in on this phone.** My needs now has a Warm voice choice and a "Hear it" sample. Turning it on stores `flare.voice=warm` and saves every clip in the Cache API (`flare-voice-1`), so it works with no signal. Turning it off deletes that cache. The clips stay off the service-worker precache.
- **Playback.** `lib/compass/voice.ts`:
  - `clipsFor()` maps the compass state to one or two clips, for example `["m-150", "dir-slightLeft"]`.
  - `playWarm()` plays them in order from the cache.
  - The phone's own voice is the fallback when a clip is missing or audio can't play.
  - The player loads only on phones that turned the warm voice on, which keeps it inside the 150 KB JS budget.
  - The repeat rules stay the same (SRS-CMP-2).
- **Server.** `.mp3` is now served as `audio/mpeg`. The CSP is `media-src 'self' blob:`, because cached clips play as blob URLs.

### 2. Voice Spark: your own words, said instead of typed
- **When it's offered.** "Say it" appears on the Spark screen only when `/config` reports `voice.spark: true`, which needs `ELEVENLABS_API_KEY` on the server, and only when the browser can record.
- **Recording.** One tap starts it and a second tap stops it. It stops by itself at 10 s and shows a countdown. Tapping suits more people than hold-to-talk. The microphone is released the moment recording stops.
- **What the server does.** `POST /api/v1/voice/spark` accepts audio types only, up to 400 KB. It sends the clip once to ElevenLabs Scribe (`scribe_v2`, English, no audio-event tags) and returns `{text}`, at most 140 characters. The buffer is zero-filled in a `finally` block. Nothing is stored or logged.
- **Failures and limits.** A 503 means the server has no key. `text: null` means Scribe failed, and the person types instead. The server caps transcriptions at `VOICE_SPARK_DAILY_MAX` a day (default 40).
- **After the words come back.** They land in the text field for the person to edit. The Spark is then sealed on the phone as before. The "no AI help" rule (BR-K-1 to K-3) still holds, because this only writes down the person's own words.

### 3. What we will not do
- Record anyone other than the person who tapped.
- Listen in the background, or record a gathering or a conversation.
- Send ElevenLabs a name, a place, an invite or anything sealed.

## Privacy
- The privacy page gains `site.privacy.l.voice`:
  - the compass voice ships with the app and sends nothing;
  - Say it sends up to 10 s of your own voice once, after you tap;
  - Flare keeps no audio;
  - ElevenLabs may keep it under its own terms.
- ElevenLabs is the one closed API in Flare's voice path. Its zero-retention mode is an enterprise feature, so we don't claim it.

## Measured (2026-10-11)
- **Clips.** Generating all 54 used 698 characters. Each clip is 1 to 2 s long; "You're close. Look around." is 1.5 s.
- **Scribe on our own clips.** It returned "You're close. Look around" in 492 ms and "150 meters" in 420 ms, both word for word (scribe_v2; scribe_v1 matched).

## Tests
- `apps/web/test/flow/voice.test.ts`: distance rounding, directions, facing, near, no heading and no GPS map to the right clips. Every clip the compass can ask for exists and matches the generator's buckets. No clip text holds anything but fixed words.
- `apps/server/test/voice.test.ts`: off without a key (503, and `/config` says false); Scribe gets the person's audio with the key in a header; non-audio is refused (415); over 400 KB is refused (413); a Scribe failure returns `text: null`; the daily cap holds.
- `apps/web/test/e2e/sparks.ts`: in Chrome, "Say it" records a real MediaRecorder clip from a synthetic microphone, sends `audio/webm` once, and the words land in the field to edit. Headless Chrome hangs on audio-only `getUserMedia`, so the test gives that page a tone as its microphone.

## Consequences
- The compass has a warm voice that works offline and costs nothing per use.
- A person can say their Spark. That sends their own voice to one closed service, only when they tap, and the privacy page says so.
- Adding a new compass line now means adding a deck key, adding a clip id in `gen-voice.ts` and `voice.ts`, and running `node scripts/gen-voice.ts`. The unit test catches a clip that is missing.
