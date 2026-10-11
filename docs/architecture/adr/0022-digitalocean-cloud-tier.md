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
- **Key type:** only a scoped model access key, proven by behavior, not by prefix. DigitalOcean model access keys and OAuth tokens share the `doo_v1_` prefix (the founder's scoped key "flare-server", 1 model, starts with it), and the docs don't state a key format. So:
  - a `dop_v1_` personal access token is always refused (check-env fails, the tier stays off, the deploy leaves it out);
  - any other value is sent to Render only if `GET https://api.digitalocean.com/v2/account` with it answers 401 or 403 (`doKeyIsScoped`, packages/shared/src/token-guard.ts). A 200 means an account token: not sent.
  - Result on 2026-10-11 05:10 ET: the account API answered **403** for "flare-server", and one ladder call for "Fairlane walk at 11?" through the cloud tier code returned a valid 4-step ladder in **3.8 s**.
- **Disclosed:** `/config.cloud_ai`, the "AI on this phone" screen (`/ai/`, "When DigitalOcean is used"), the privacy page limit `site.privacy.l.cloud`, the H2 note under the button, and the tier label "Made by DigitalOcean".
- **Traced:** the call is a `chat gemma-4-31B-it` span with provider `digitalocean` (ADR-0021), outcome only.

## Consequences
- With a scoped key, a Plan still gets a drafted ladder with the Mac off; photos stay typed unless the host chooses otherwise.
- Field test: off unless the founder adds a scoped key; the hub is the path.
- Proof: apps/server/test/cloud.test.ts (7 tests: off for a missing key or an account token, ladder when the hub is absent, no photo without opt-in, opted-in photo sends only the prompt and the image, nothing while the hub is up, daily cap, `/config`).
