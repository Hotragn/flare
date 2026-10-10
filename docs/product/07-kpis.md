# Flare: KPI definitions

Principle: we measure the group outcome, never the person. No KPI stores a name, phone number, location, photo, free text or a per-person history. Everything below is a counter or a bucketed number keyed by an opaque Flare id (deleted at Gone) and rolled up into an opaque group counter (kept).

## Stored counters (the only data that survives Gone)

Per group (opaque id, random, not derived from any personal data):

| Counter | Incremented when |
| --- | --- |
| `flares_created` | A Flare is created |
| `flares_lit` | A Flare enters Lit from Kindling |
| `embers` | A Flare enters Ember |
| `embers_lit` | An Ember enters Lit |
| `headcount_sum` | At Gone, by the Flare's final headcount (Lit Flares only) |
| `headcount_max` | Max of final headcounts |
| `screen_host_bucket[b]` | One per Flare: host's screen-seconds bucket |
| `screen_invitee_bucket[b]` | One per yes: invitee's screen-seconds bucket |
| `tier_ran[job][tier]` | Each AI job run, by tier (phone, hub, rules) |
| `lit_minutes_sum` | At Gone, minutes from Lit to Done (or timeout) |

Buckets for screen seconds: 0 to 5, 6 to 10, 11 to 20, 21 to 40, 41 to 90, over 90.

## KPI 1. Headcount (north star)

- **Definition:** for a Lit Flare, host (1) + arrivals tapped via "I'm here" or host "+1", capped at yes-count + 3 (yes-count includes the host).
- **Report:** sum and median per period; max.
- **Measured from:** `headcount_sum`, count of Lit Flares, `headcount_max`.
- **Not stored:** who arrived.
- **Known bias:** relies on taps. Undercounts if nobody taps; the host "+1" reduces this.

## KPI 2. Light rate

- **Definition:** Flares that reach Lit (directly or via Ember) ÷ Flares created.
- **Formula:** (`flares_lit` + `embers_lit`) ÷ `flares_created`.
- **Also report:** direct light rate = `flares_lit` ÷ `flares_created`.

## KPI 3. Ember save rate

- **Definition:** Embers that light ÷ Embers.
- **Formula:** `embers_lit` ÷ `embers`.
- **Report with n.** With 1 to 3 Embers on Sunday, report counts, not a percentage alone.

## KPI 4. Screen seconds

- **Definition:** seconds the Flare UI is visible and the screen is on, per person per Flare, from first open to the moment they're done:
  - Host: from app open to Send, plus any later foreground time on that Flare, excluding time the compass is in use.
  - Invitee: from first open of the link to "I'm in" (decision time), and total foreground time on that Flare excluding compass time.
- **How:** measured on the phone with the Page Visibility API and foreground timestamps. The phone sends only the bucket index at Gone (or with its last tap). No raw timestamps leave the phone.
- **Targets:** host decision 15 s or less; invitee decision 10 s or less (median).
- **Why compass time is excluded:** it's used to find people outside and is designed to work with the screen down. It is reported separately as its own bucket.

## KPI 5. Time together (supporting)

- **Definition:** minutes from Lit to Done for Lit Flares.
- **Formula:** `lit_minutes_sum` ÷ (`flares_lit` + `embers_lit`).

## KPI 6. Tier coverage (supporting)

- **Definition:** share of AI job runs per tier.
- **From:** `tier_ran`.

## What we never measure

Who said yes, who didn't answer, who arrived, where anyone was, how long a specific person looked at the screen, conditions text, needs, photos.

## Field test reporting

`E13-S2` exports a table for Sunday 11 AM to 3 PM ET: Flares created, lit, embers, embers lit, headcount per Lit Flare, screen-second bucket counts for hosts and invitees, tier counts per job, lit minutes. This table goes into the post as-is.
