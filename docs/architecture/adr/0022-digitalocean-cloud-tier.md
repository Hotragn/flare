# ADR-0022: DigitalOcean Serverless Inference as a cloud tier

Status: Accepted (founder decision, Sun 2026-10-11 02:45 ET). Amends ADR-0007's tier table. Off until a scoped model access key is configured.

## Context
When the laptop hub is off or unreachable, every AI job falls to the template. The founder asked for DigitalOcean Serverless Inference (OpenAI-compatible, `inference.do-ai.run`) with an open Gemma model as a cloud tier, without weakening the privacy model.

## Decision
- **Model:** `gemma-4-31B-it`, an open Gemma 4 model DigitalOcean serves; it accepts images. Probe on 2026-10-11 with our own illustration fixture and the Plan ask "Fairlane walk at 11?": ladder 20.9 s, 309 tokens; photo 27.2 s, 541 tokens; both answers passed `enforceLadder()` and `enforce()`.
- **What may go there, and when:**

| Job | Goes to DigitalOcean when | Sends |
| --- | --- | --- |
| Plan ladder | the hub is absent | the ask line (≤ 80 characters, no place) and the step-1 minutes |
| Photo to six words | the hub is absent **and** the host tapped "Ask DigitalOcean" for that Flare (`?cloud=1`) | the 768 px JPEG and the fixed prompt |
| Conditions, rest-loop requests, needs, places | never | nothing (SRS-PRIV-1: they stay on the phone) |

- **Never while the hub is up.** A slow hub answer still falls to the template; the cloud is not a second try that doubles the wait.
- **Guards:** the same `enforce()` and `enforceLadder()` as the hub. Server budget 35 s; phones wait up to 40 s only when `/config` says the tier is on.
- **No spend cap exists per key** at DigitalOcean (prepaid balance only, docs checked 2026-10-11). The server caps calls per UTC day (`DO_DAILY_MAX_CALLS`, default 60) and 200 output tokens per call.
- **Key type:** only a scoped model access key. An account-wide token (`dop_v1_…`) in `DO_MODEL_ACCESS_KEY` leaves the tier off, fails `npm run check-env`, and makes `npm run deploy:render` refuse to send it (packages/shared/src/token-guard.ts).
- **Disclosed:** `/config.cloud_ai`, the "AI on this phone" screen (`/ai/`, "When DigitalOcean is used"), the privacy page limit `site.privacy.l.cloud`, the H2 note under the button, and the tier label "Made by DigitalOcean".
- **Traced:** the call is a `chat gemma-4-31B-it` span with provider `digitalocean` (ADR-0021), outcome only.

## Consequences
- With a scoped key, a Plan still gets a drafted ladder with the Mac off; photos stay typed unless the host chooses otherwise.
- Field test: off unless the founder adds a scoped key; the hub is the path.
- Proof: apps/server/test/cloud.test.ts (7 tests: off for a missing key or an account token, ladder when the hub is absent, no photo without opt-in, opted-in photo sends only the prompt and the image, nothing while the hub is up, daily cap, `/config`).
