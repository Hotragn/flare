# ADR-0028: Voice Flares, the invite from what the host says, on our laptop

Status: Accepted (Sun 2026-10-11).

## Context
A Flare starts with a photo, and Gemma 4 on the hub writes the invite and the place line from it. Some people can't take a useful photo: people who are blind or have low vision, or who are in the dark or have their hands full. The backlog asked for Voice Flares (#9): say it, and Gemma 4 writes the invite.

## What we checked
- **Ollama reports audio.** For `gemma4:e4b-it-q4_K_M`, Ollama 0.40.2 lists the capabilities `completion, vision, audio, tools, thinking` (`/api/show`).
- **Audio goes in `images`.** The model hears audio passed base64 in a message's `images` field. A field named `audio` is ignored.
- **Transcription works.** One of our own warm-voice clips came back as "You're close. Look around." in 2 s.
- **The voice prompt works.** Voice prompt v1, given a `say` recording of "I'm at the pond in Ford Woods Park. Come sit on the bench with me, the light is really nice.", answered `{"invite": "Meet at the pond bench.", "alt": "The pond in Fordwoods Park has nice light to sit on the bench."}` in 3.7 s. A second sentence ("Walk to the cider mill after work? I'm by the big oak at Fairlane Green.") took 3.5 s.

## Decision
- **Phone.** The camera screen has "Say it instead".
  - One tap starts recording and a second tap stops it. It stops by itself at 10 s.
  - The phone converts the clip to 16 kHz mono 16-bit WAV (`lib/voice/flare.ts`) and sends it once to `POST /api/v1/drafts/voice`.
  - Nothing is kept on the phone, and the microphone is released at once.
  - The control loads only when the camera screen shows (JS budget).
- **Server.** WAV only (RIFF....WAVE), at most 400 KB.
  - It relays the audio to the hub as a `voice-draft` job (asyncapi `voiceJob`: a header, then one binary frame) with an 8 s budget, like the ladder.
  - It runs `enforce()` again on the answer.
  - The buffer is zero-filled on every path, and nothing is stored or logged.
  - The words heard never come back, only `{invite, alt, tier}`.
  - It counts `tier_ran.voice.{tier}`.
- **No cloud tier.** A voice is more personal than a photo, so it stays on the open model on our own laptop. If the hub is absent, slow or hears no place, the response is `tier: rules`. The phone then says "Didn't catch a place. Take a photo or try again."
- **Hub.** The frame must start with RIFF, or the result is `bad_audio` and the model is never called. The hub uses voice prompt v1 (`packages/shared/src/prompts/voice.ts`): only places and things the person said, no names, faces or bodies, and an empty answer when no place is heard. It runs `enforce()` and makes no retry: at temperature 0 a retry gives the same answer. The audio is zero-filled after the job.
- **Send.** With no photo, Send shows the invite over the outdoor scenery and asks for the place if the map didn't name one.

## Tests
- `apps/hub/test/voice.test.ts`:
  - audio in, a guarded draft out, with the voice prompt and the audio passed as media;
  - an empty answer is `unusable_answer`;
  - a frame that isn't WAV is `bad_audio` and never reaches the model.
- `apps/server/test/contract.test.ts` (`draftFromVoice`): the template when no hub is connected, 400 for a file that isn't WAV, 413, and 415.
- `apps/web/test/e2e/voice-flare.ts` runs on the real stack on this Mac: real server, real hub, real Gemma 4.
  - The `say` fixture plays in as the microphone. A real MediaRecorder records it and the phone converts it to WAV (167 KB).
  - "Meet at the pond bench" comes back in 3.3 s, and Send shows it over the scenery with no photo.

## Consequences
- A person who can't take a photo can still send a Flare by speaking for 10 seconds, and their voice goes only to our own laptop.
- Asyncapi gains `voiceJob` and `voiceBytes`, and the result error enum gains `bad_audio`. A hub on the old code ignores the job, and the server falls back to the template after 8 s.
