# ADR-0007: Where each AI job runs, and what happens when it can't

Status: Accepted. Date: 2026-10-10. From lab reports 01, 02, 07, 09.

## Decision

| Job | Runs on | Model or method | Budget | Fallback | Output check |
| --- | --- | --- | --- | --- | --- |
| Photo to six words and scene (SRS-AI-1) | Hub | `gemma4:e4b-it-q4_K_M`, `think:false`, prompt v2, temperature 0, seed 42, `num_predict` 128 | 6 s | Typed: host writes ≤ 6 words, map-pack chips suggest place words; scene built from map facts | `enforce()` on hub and again on server: ≤ 6 and ≤ 20 words, no emoji, no face or identity words |
| Conditions (SRS-COND-1) | Phone | Rules parser, no model | < 1 ms | Rephrase hint "Try 'after 2' or 'only with Amor'." | Always read back; saved only after "Yes" (BR-C-10) |
| Plan ladder (SRS-PLAN-2) | Hub | Same model, text only | 8 s | Template ladder: minutes = total × 1, 0.5, 0.25, 0.125, rounded to 5 (60 gives 60, 30, 15, 10; the smallest total, 40, gives 40, 20, 10, 5); labels from the copy deck | Exactly 4 steps, minutes strictly decreasing, labels ≤ 4 words |
| Needs checks (SRS-ACC-6) | Phone | Deterministic rules on the map pack | < 5 ms | None needed | Unit tests per BR-A-2 |
| Nature line (SRS-NAT-1) | Phone | NOAA sunset, named OSM feature, season | < 1 ms | Season line | Never model output |
| Rest loop request (P1) | Phone | Rules parser, same approach as conditions | < 1 ms | Manual pickers | Read back |
| Fix the map tags (P1) | Hub | Same model with the tag allow-list | 8 s | Manual tag picker | Allow-list only (BR-AI-4) |

## Weather for Plan ladders (FR-AI-9)
FR-AI-9 drafts the ladder from the ask, weather, sunset and nearby places. Weather is the one input we can't compute on the phone. The host's phone, and only when it creates a Plan, asks the US National Weather Service directly (`https://api.weather.gov/points/{lat},{lon}`, then the hourly forecast) with coordinates rounded to 1 decimal place (about 11 km). The answer is reduced on the phone to `{rain_likely, temp_f}` and sent to the hub with the ask. Our server never sees the coordinates; NWS sees an 11 km cell and the phone's IP, and the privacy page says so. CSP `connect-src` allows exactly this host. If NWS fails (it often answers 500 under load), the ladder is drafted without weather.

The tier that ran is shown ("Made on our laptop", "Made from a template") and counted in `global_counters` as `tier_ran.{job}.{tier}` (BR-AI-3).

## Why no phone tier for photos or conditions
- Gemma 4 E2B needs one 1.12 GiB GPU buffer; iOS WebKit caps buffers at 1 GiB, and the tab used 11 to 13 GB against a limit near 2 GB (lab 01). MediaPipe's web build is text-only.
- SmolVLM-500M got 2 of 20 photos right, with 6 misleading answers ("an infinity pool", "a cowboy") (lab 09).
- For conditions, the rules parser scores 40/40 core and 15/20 hard; the best small model (Qwen3-0.6B, 570 MB) scored 26/40 alone, added 1/20 behind the rules, and hung Safari twice (lab 07).

So SRS-AI-6 and SRS-COND-4 (phone tier, P1) are answered with "measured, not shipped", and the capability page (`/check`) still reports what each phone could run.

## Quality numbers (lab 02)
20 Fairlane-style photos: 20/20 parsed, 18/20 valid before `enforce()`, 20/20 after, quality 39/40, 0 person descriptions (SRS-AI-3). `think` left unset gave 0/20 answers; `format` (JSON schema) doubled latency, so it stays off.
