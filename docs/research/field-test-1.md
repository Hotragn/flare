# Field test 1: the live app with real friends (Sun Oct 11, 2026, evening, Dearborn)

Only what was observed. The founder's screenshots are in the manager chat. Open questions are marked ASK.

## Setup
- The host (founder, as Fuego) on an iPhone, using Brave. Two real friends (Amor and one more) on their own phones. Live build b6fd014 or aee8348.
- The link went over WhatsApp Business, and the friends opened it in their browsers.

## Timeline
- 8:20 PM: the host sends a Flare: a photo of a dim indoor light, quorum 3 ("2 more to light it"). Gemma's invite: "Meet under the warm light". The invite shows "Fuego is at Near Heather Drive."
- Before sending: both the WhatsApp button and the Share button did nothing in Brave. ASK: how the link was finally sent (copy and paste?).
- 8:22 PM: a friend types "After 10min, a quick visit works". The readback says "Got it: after 10 AM. Right?" The friend caught it on the readback.
- 8:24 PM: a friend types "10min only with you". The app answers "I didn't catch that. Try 'after 2' or 'only with Amor'."
- The friend types "in 10 minutes", which is accepted, and taps I'm in.
- The friends said yes. The host got no buzz. The audit shows 0 push subscriptions, so this device had no push.
- 8:36 PM, live audit (/api/v1/audit): pass. 1 gathering, 3 responses, 1 photo, 1 job, 1 Spark; 0 rows past their end.
- The deletion watch is running, to log when the gathering's rows reach 0.

## Bugs found (5), all sent to the build as top priority
1. On the invite and the send screens, the headline and sheet cover the photo, so you can't see the place. A dark photo makes it worse.
2. The "Near {street}" spot name flows into "{host} is at {spot}", giving "is at Near Heather Drive".
3. The condition parser: "10min" (no space) read as a clock time; a bare hour took AM at 8 PM; "a quick visit" silently dropped.
4. The parser: "only with you" not understood. The hint examples didn't fit the moment ("after 2" at 8 PM, and possibly the reader's own name).
5. Sharing: neither the WhatsApp nor the Share button opened anything in Brave. Suspected cause: the tap's user activation is lost after an await.
6. The alert: "We'll buzz you when it's lit" is promised with no push subscription. An iPhone browser tab can't buzz.

## What worked
- WhatsApp to the invite page.
- The private count ("2 more to light it. Nobody sees who.").
- The readback caught the misread before it counted.
- "in 10 minutes" parsed.
- It lit. ASK: the time it lit.
- A Spark was left.
- The audit passes live.

## ASK the founder
- Did it light, and at what time? Did anyone meet in person? Was the compass or "I'm here" used?
- Did the host end it ("We're done"), and when? The deletion watch will measure from then.
- Each friend's one honest line, their OK to be quoted, and how they want to be named.
