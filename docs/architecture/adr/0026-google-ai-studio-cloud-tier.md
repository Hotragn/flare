# ADR-0026: Google AI Studio as the second cloud provider

Status: Accepted (Sun 2026-10-11). Extends ADR-0022; every rule there still holds.

## Context
ADR-0022 added one cloud provider, DigitalOcean Serverless Inference, for when our laptop (the hub) is off. On 2026-10-11 DigitalOcean began answering `402 "This account has been blocked"` (billing; on the founder's list). With no hub and no cloud, Plan drafts fall back to templates and photos to typing. The founder added a Gemini API key (`GEMINI_API_KEY`) and asked for Gemma 4 through Google AI Studio.

## Decision
- **Order:** DigitalOcean first when its scoped key is set, then Google AI Studio. Either one alone works. `apps/server/src/cloud.ts` holds both backends behind one `chat()`.
- **Model:** `gemma-4-26b-a4b-it` (open Gemma 4, mixture of experts, about 4B active, accepts images), listed by `GET /v1beta/models` on 2026-10-11. `GOOGLE_MODEL` overrides it.
- **Thinking off:** Gemma 4 on this API thinks by default. With the default, the ladder took 21.7 s and used all 1,021 thought tokens with no answer. `thinkingConfig.thinkingLevel: "minimal"` answered in 1.4 s. `thinkingBudget` and the `"low"` level are refused with 400 for this model. Thought parts are dropped if any arrive.
- **Key handling:** the key goes in the `x-goog-api-key` header, never the URL, so it can't land in access logs. The system prompt leads the user turn (Gemma takes no separate system instruction here).
- **Refusals:** a provider that answers 401, 402 or 403 is skipped for 1 hour, so a blocked DigitalOcean costs one call, not one timeout per draft. A 5xx or timeout tries the next provider without marking it down. Google gets one retry after a 5xx: with `minimal` thinking it now and then answers 500 in under a second (seen twice in about 20 calls on 2026-10-11).
- **One cap:** `CLOUD_DAILY_MAX_CALLS` (falls back to `DO_DAILY_MAX_CALLS`, default 60) counts calls across both providers per UTC day.
- **What goes:** unchanged from ADR-0022. A ladder sends the ask line (at most 80 characters, no place) and the minutes. A photo goes only when the hub is absent and the host tapped "Ask cloud Gemma" for that Flare. Same `enforce()` / `enforceLadder()` guards. Nothing stored or logged.
- **Tracing:** `cloudChat()` sets `gen_ai.provider.name` and `gen_ai.response.model` to whoever answered (ADR-0021 allow-list).
- **`/config`:** `cloud_ai.provider` is the first provider; `cloud_ai.providers` lists both.

## Data use on the free tier
Google's Gemini API terms (Unpaid Services, "How Google Uses Your Data", read 2026-10-11) say Google uses what it receives to improve its products, and human reviewers may read it after it is cut off from the account. That is fine for a ladder ask line and not obviously fine for a photo. So:
- the photo stays a per-Flare tap, never automatic;
- the note under the button says "Google may review it";
- the privacy page (`site.privacy.l.cloud`) and /ai/ (`ai.cloud.photo`) say so in plain words;
- turning on billing for the Google project moves it to Paid Services terms, where prompts are not used to improve products. That is the founder's call.

## Measured (live, 2026-10-11, this Mac to Google)
| Job | Before (default thinking) | After (`minimal`) |
| --- | --- | --- |
| Ladder, "Fairlane walk at 11?", 60 min | 21.7 s, no answer | 1.4 s, 4 valid steps |
| Photo (a lake and red tree) | no answer at 200 tokens | 1.6 s, "Autumn views by the lake" |

Free-tier limits are shown per project in AI Studio, not on the public rate-limits page. Our cap of 60 calls a day is far below any published Gemma free limit.

## Tests
`apps/server/test/cloud.test.ts`: Google alone; DigitalOcean 402 → Google answers and DigitalOcean is skipped on the next call; a 5xx does not mark down; the photo goes as `inline_data`; thought parts dropped; the key is in a header, not the URL; one cap across providers.

## Consequences
- The cloud tier works today, without waiting on DigitalOcean billing.
- One more closed service sees ladder ask lines, and photos when the host taps. The privacy page names it.
- The DigitalOcean signature moment in the post stays [PENDING DO BILLING].
