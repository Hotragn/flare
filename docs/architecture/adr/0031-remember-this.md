# ADR-0031: Remember this, a conversation note made only with everyone's consent

Status: Accepted (Sun 2026-10-11, founder decision). Replaces ADR-0027's "never record a conversation" with the rule below.

## The rule
- **Per Flare or Plan, off by default.** The host turns it on (`PUT /remember {on}`), and it is never on for a crew all the time. Turning it off clears every consent and any recording.
- **Each person agrees on their own phone,** separately from I'm in (`PUT /remember/consent {ok}`).
  - If anyone who said yes doesn't agree, it's off for everyone.
  - If someone joins later without agreeing, it's off for everyone.
  - The screen says "Recording is off for this Flare." and never who. That's the same rule as the yes count.
  - The rule is one pure function, `rememberState()` in `apps/server/src/core/remember.ts`. It returns flags only: `on`, `ready`, `recording`, `recording_until`.
- **Recording.** When it's lit and everyone agreed, anyone can tap Record. It records up to 60 s on that phone, after the line "Only your group. Stop if others are close." Every phone in the group shows a recording sign, live (SSE event `remember`). Anyone can stop it for everyone, and a no stops it at once.
- **The words.** ElevenLabs Scribe v2, `diarize=true`, turns the audio into lines labelled Speaker 1, Speaker 2 and so on, with no names. The audio is zero-filled right after the call and none is kept. ElevenLabs may keep it under its own terms, and the privacy page says so.
- **The note.** The lines go back to the recording phone, which seals them with the Flare key (aad `r:{gathering}`). The server stores only that sealed blob, so it never holds the words in plain text.
- **The summary.** Gemma on the hub writes one line: summary prompt v1, `enforceSummary()` on the hub and on the server (3 to 16 words, no speaker labels, no long numbers or links). With the hub off there's no summary, and the words never go to a cloud model.
- **Where it shows.** The note shows in the Remember this sheet while the gathering is live. It is deleted at Gone with everything else: both tables cascade with the gathering, and the deletion audit checks them as DS12.
- **Never** listens in the background, and never records without the host turning it on and everyone agreeing.

## Measured (this Mac, 2026-10-11)
- **Scribe on a 10 s, two-voice `say` clip:** 787 ms direct and 720 ms through the app. Two speakers, labels only.
- **End to end:** stop tap → transcription → hub summary → sealed note shown on the other phone: 5.3 s. Gemma's line: "Friends enjoyed the beautiful view of the pond and geese together."

## Tests
- `apps/server/test/remember.test.ts`, properties with fast-check:
  - ready exactly when on, lit and every yes agreed;
  - any no makes it off for everyone;
  - a late joiner without consent makes it off;
  - the result never holds a member id, and doesn't depend on order;
  - recording only while ready and inside its 60 s.
  - Also covered: the transcript lines and the summary guard.
- `apps/server/test/contract.test.ts`: host-only on; consent; a no stops a recording; stop for everyone; the sealed note; 503 without ElevenLabs; no hub means no summary; 409 when not everyone agreed. No member id appears in any answer.
- `apps/web/test/e2e/remember.ts`, on the real stack with two phones:
  - the host turns it on and the friend agrees on their own phone;
  - the sign shows live on the other phone, and the friend stops it for everyone;
  - a real Scribe call and the real hub summary;
  - the note reaches the other phone with speaker labels and no names.
