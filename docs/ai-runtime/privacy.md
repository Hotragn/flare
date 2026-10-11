# What never leaves the phone

Each line is a guarantee with the test that proves it. If a test here fails, the guarantee is broken.

| Guarantee | Rule | Proof |
| --- | --- | --- |
| The words you type or dictate in a condition never leave the phone. Only the structured rule is sent, after you say Yes. | BR-C-9, BR-C-10, SRS-COND-6, CR-E1 | `apps/web/test/ai/privacy.test.ts`: fetch, XMLHttpRequest, WebSocket, EventSource and sendBeacon are trapped while all 60 fixture phrases and their Plan answers are parsed: 0 calls. The rules that would be sent contain no typed word and no name (60 phrases checked). |
| The same holds in a real browser. | SRS-COND-6 | `node apps/web/test/e2e/privacy.ts` on the built /ai/ page in Chrome 154: 4 conditions typed with marker words ("ZEBRA", "dentist", "Mabel", "porch"): 0 requests while typing, 0 marker hits in requests, 0 in localStorage or sessionStorage. Run 2026-10-10 21:11 ET. |
| Names in conditions are turned into member ids on the phone. | BR-C-3 | `conditions.test.ts` "BR-C-3: with() resolves to the member id on the phone". |
| Conditions are never sent to the hub, even when it is up. There is no hub tier for conditions. | founder decision, CR-E1 | `tier.ts` has no conditions request; the privacy test traps every network API. |
| The AI status store keeps no content: only feature, tier, time, ms and reason. | SRS-PRIV | `tier.test.ts` "SRS-AI-4: the last tier per feature is kept, with no content" (checks that the draft words are absent). |
| The photo goes to our laptop only, is not stored, and is cleared after the job. | ADR-0011 | `apps/hub/test/hub.test.ts`: the hub imports no fs or child_process module and writes no temp files during a job; `client.ts` zero-fills the buffer in `finally`. |
| A hub draft that describes a person is never shown. | SRS-AI-2, SRS-AI-3 | `tier.test.ts` "a hub answer describing a person never shows" (the phone runs `enforce()` again). |
| The ladder ask line is the only Plan text that goes to the hub, at most 80 characters, with no place. | openapi draftLadder | `tier.test.ts` "the ask line is clipped to 80 characters and carries nothing else" (body keys are exactly `ask`, `total_minutes`). |
| Capability checks never read the device model or user agent. | SRS-COMP-2 | `capabilities.test.ts` "never reads the user agent or device model (lint grep)". |
| Walking-time checks run on the phone; only pass or fail per spot leaves it. | BR-C-7 | Owned by the frontend and map work packages; stated on /ai/ ("Only pass or fail for walk time is sent"). |

What does leave the phone, by design: the 768 px photo (to our laptop through the server, in memory), the Plan's ask line and step 1 minutes, structured rules (`with` member id, `after` and `back_by` as UTC times, `max_walk` minutes, `max_step`/`min_step` step numbers), and sealed invite data as the contracts allow.
