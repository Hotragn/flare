# ADR-0030: Automations, what runs by itself and what doesn't

Status: Accepted (Sun 2026-10-11).

The backlog (#7) asked for automation with guardrails: opt-in, rate-limited, an off switch and no tracking. Here is what runs by itself, what was added today, and what we left out and why.

| Automation | Status | How |
| --- | --- | --- |
| Plan auto-solve at the deadline | Already there | The engine's `plan_deadline` job; the server sweeps every 60 s and at boot (ADR-0005) |
| Fade check, "still coming?" | Already there | `still_coming` push when a Plan gets smaller (BR-P-6) |
| Locked Plan saved for offline use | Already there | PWA outbox and saved view (`savedAt`) |
| **Reminder 30 min before a Plan starts** | **New** | When a Plan lights more than 30 min before its start, the engine schedules `plan_reminder` at start − 30 min. The timer pushes `plan_soon` to the people going: "{step} starts at {time}. Time to head out." The text is built on the phone from the sealed notice, so the server sees only the event name. The job is unscheduled when the Plan ends. Migration 0005 allows the new job kind |
| **Weather-aware Ember** | **New** | When Home's 2-hour forecast says rain is likely, the host's phone puts covered seats first in the Ember list. A seat counts as covered if it is tagged `covered=yes` or `shelter=yes`, or is within 25 m of a mapped shelter. The engine picks the first seat everyone passed, and that seat's name reads "the bench by the willow, under cover", so friends see why. All on the phone; the server never learns the weather or the spot |
| **Tell the chat** | **New** | On the host's Lit screen, one tap opens the share sheet (or copies) with "It is lit. Meet us at {spot}." and the same link as the invite. A place only, never who |
| Golden-hour nudge (a push) | Not built | Home already shows "Golden hour in 47 min" with one tap to Light a Flare. A push at golden hour would need the server to know where each crew is, which it never does (ADR-0001). A local notification at a set time isn't available to web apps without push |
| Weekly recap (a push or Telegram post) | Not built | The Crew space already shows this week's minutes outside from the counters (ADR-0024). A pushed recap needs a weekly job per crew at a sensible local hour, and the server doesn't know a crew's time zone. Left for after the challenge |

## Guardrails
- **Nothing tracks anyone.**
  - The reminder goes only to the people in the Plan's set.
  - The covered-seat ordering happens on the host's phone.
  - Tell the chat sends nothing until the host shares it.
- **Rate.**
  - One reminder per Plan.
  - Tell the chat is a tap.
  - The Ember ordering changes nothing when the forecast is dry.

## Tests
- `packages/engine/test/plan.test.ts`:
  - lighting at the deadline schedules `plan_reminder` at start − 30 min, and the timer pushes `plan_soon` to the set;
  - no reminder when the Plan lights less than 30 min before it starts;
  - a stale reminder after the Plan is gone does nothing.
- `apps/web/test/flow/covered.test.ts`: a `covered=yes` tag or a shelter within 25 m counts as covered; an open bench doesn't.
- `apps/server/test/db.test.ts`: migration 0005 applies once and is idempotent.
- `e2e:plan` and `e2e:field` still pass.
