# Flare: Personas and key journeys

Personas are composites, not our four testers. Names are invented so no real friend is labelled. Screen seconds are targets the journey must meet.

## Personas

### P1. Jo, the host (24)
- Walks to the park most weekends. Tired of "anyone around?" getting two thumbs-up and nobody showing.
- Wants: company without a public ask. Hates: chasing people.
- Phone: recent iPhone, good battery.

### P2. Sam, the lazy friend (25)
- Likes the group, rarely says yes first. Will come if it's clearly happening and close.
- Wants: to decide in one tap, without committing in front of everyone. Hates: long threads, being the only one who replies.
- Phone: iPhone 13, often on low battery.

### P3. Priya, low vision (29)
- Uses VoiceOver and large text. Can't see invite photos in chats, so she skips them.
- Wants: to know what the place looks like and to find her friends on arrival. Hates: maps she can't read, "it's by the thing".

### P4. Linda, older parent with a bad knee (63)
- Walks fine for 10 minutes, then needs to sit. Avoids steps. Says "you go ahead" rather than explain.
- Wants: to join without making it about her knee. Hates: being the reason a plan changes.

### P5. The group heading to no signal
- Four friends going to woods with patchy coverage. They lose each other at the trailhead.
- Wants: the plan to hold after the bars go. Hates: "where are you?" texts that never send.

## Journeys

### J1. Jo lights a Flare (host, happy path)
1. Jo is at the pond in Ford Woods Park. Opens Flare. Camera is already on. Taps once. (2 s)
2. Draft appears: "Golden pond, come sit" and the spot "Ford Woods Park, by the pond". Jo taps Send. (4 s)
3. Phone goes back in the pocket. Screen total: about 6 s.
4. 7 minutes later: buzz. "It's lit. Sam is coming."
5. Sam arrives. Jo taps "I'm here" for Sam (or Sam does). Headcount 2.
6. 70 minutes later Jo taps Done. Gone. Data deleted within 5 minutes.

Done when: Jo spent 15 s or less on screen; headcount recorded; audit shows 0 records for this Flare.

### J2. Sam says yes without saying it out loud (lazy friend)
1. Telegram shows the bot post: photo, "Golden pond, come sit", "Need 1 more".
2. Sam taps the post's "I'm in" button. Private. (3 s)
3. Bot replies privately: "You're in. We'll buzz you when it's lit."
4. Lit message arrives. Sam opens the link once to see walking time: 9 min. Locks phone. Walks.
5. If Sam had ignored it, the Flare would have ended with "Not this time" for everyone, and nobody would know Sam saw it.

Done when: Sam's screen time to "I'm in" is 10 s or less; no one else can tell whether Sam answered.

### J3. Priya hears the invite and finds the group (low vision)
1. iMessage link arrives. VoiceOver reads the preview: "Flare: Golden pond, come sit. Need 1 more."
2. Opens the link. VoiceOver reads the photo: "A pond with yellow trees and an empty bench." Then the access line: "Bench 40 meters. Restroom 180 meters. No steps mapped."
3. Double-taps "I'm in". Adds a condition by dictation: "after two". Hears: "Got it: after 2 PM. Right?" Double-taps Yes.
4. Lit. On arrival near the park, taps "Find them". Phone in hand at her side, she hears "Jo, 120 meters, slightly left", then a tick when facing the spot.
5. Taps "I'm here".

Done when: every step works with VoiceOver and the largest text size; she never needed to see the photo or a map.

### J4. Linda joins without explaining her knee
1. Earlier, Linda set her needs once: avoid steps, rest every 200 m, restroom within 300 m. They live only on her phone.
2. Jo's Flare is at a lookout with stairs. Linda's phone checks the spot against her needs and fails it.
3. Linda sees: "This spot may not suit you. Count me in for a closer one?" She taps Yes.
4. Nobody else sees anything different. Her yes counts only for an Ember.
5. 30 minutes pass without Lit. The Flare becomes an Ember: "Smaller plan: 15 min at the bench by the lot." That bench fits Linda's needs. Her yes now counts. Quorum is 2. It lights.
6. Jo walks down to the bench. Headcount 2. It counts as an Ember save.

Done when: no screen, message or log available to others reveals why Linda's yes moved; the Ember spot met all her needs.

### J5. The group walks out of coverage (no signal)
1. Flare lights at the trailhead lot with full signal. Every phone saves spot, compass target, access line and host line at Lit.
2. They walk in. Bars drop to zero. A latecomer opens the Lit screen in airplane mode: it shows "Offline. Saved at 2:14 PM." and the compass still points to the saved spot.
3. Latecomer taps "I'm here" offline. It waits in the outbox.
4. On the way back, signal returns. The outbox sends; the server ignores the duplicate tap from the host who also counted them.
5. A friend without data sent `IN K7Q2` by SMS to the host before the walk; the host's link page relayed it.

Done when: the Lit screen and compass work in airplane mode; outbox delivers exactly once; headcount is correct after sync.

### J6. Nothing comes together
1. Jo sends a Flare with quorum 3. One yes in 30 minutes.
2. Ember: "Smaller plan: 15 min at the bench by the pond." Quorum 2. Nobody else answers by t0 + 60.
3. Everyone who could see it gets "Not this time." Same words for all.
4. Gone. Deleted. No record of who saw it or answered.

Done when: the final message is identical for all; audit shows 0 records.
