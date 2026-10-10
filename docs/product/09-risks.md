# Flare: Risk register

Scale: likelihood and impact are Low, Medium, High. Owner is the role that holds the mitigation.

| ID | Risk | L | I | Mitigation | Trigger to act | Owner |
| --- | --- | --- | --- | --- | --- | --- |
| R1 | Gemma 4 E2B ONNX won't load in iPhone Safari; the lab reports it looks blocked by Safari memory limits (Side Quest's iPhone 12 tab also died) | High | Medium | Phone tier targets whichever lab candidate passes: MediaPipe E2B (Drift ran it in iPhone Safari at 2.5 GB) or a vision model under 600 MB; hub and rules tiers always work; report the tier honestly | `/check` fails on a phone Sunday 9 AM | AI |
| R2 | iPhone 13 has 4 GB RAM; large model kills the tab | High | Low | Never auto-download; size shown first; hub tier for that phone | Memory warning or tab reload during warm-up | AI |
| R3 | The laptop hub is unreachable from phones in the field (no shared network) | Medium | Medium | Hub reachable through the deployed server as a relay, or the rules tier; drafts are optional, never blocking | Hub ping fails at 10 AM | Engineering |
| R4 | Web push on iOS needs the app on the Home Screen and permission | High | Medium | Telegram for two testers; open link page polls; host line tells people where to go regardless | Push test fails at RC | PWA |
| R5 | Compass is inaccurate (magnetic interference, iOS orientation permission) | Medium | Medium | Ask permission on a tap; show "Hold flat" hint; speak distance even when bearing is unsure; test in the open | Bearing error over 30° in test | Maps |
| R6 | Small groups can guess who said yes or didn't | High | Low | State it plainly on the privacy page; identical "Not this time"; no timestamps shown per yes | Always true; disclose | Product |
| R7 | Deletion misses a store (logs, backups, bot messages, CDN cache) | Medium | High | Inventory every store in architecture; storage-level expiry plus delete job; no request bodies in logs; audit covers all stores; bot deletes its posts | Audit shows any nonzero | Security |
| R8 | Founder approvals arrive late, blocking the RC | Medium | High | Prepare each approval as one step with what, where and why; ask at 9:30 AM for the 10 AM deploy | No reply by 9:45 AM | Ops |
| R9 | Weather on Sunday (rain, cold) | Medium | Medium | Ember to a covered bench if mapped; the test still measures the flow; report conditions | Forecast check Sunday 8 AM | Product |
| R10 | Scope is large for the time left, larger after CR-1 (Plan mode, Hot spots P0; rest loop, Fix the map P1) | High | High | P0 list is the gate; build Plan engine on the Flare engine (one solver, one state machine); P1 after the test if needed; honest "what didn't ship" in the post | M5 slips past 8 AM | Product |
| R11 | Overpass API mirrors fail (seen Oct 10) | Medium | Medium | Ship the Fairlane pack; cache 7 days; send a User-Agent; fall back between mirrors | Fetch errors | Maps |
| R12 | Telegram bot posts somewhere it shouldn't | Low | High | Hard allow-list of the "Flare test" chat id in code; test that other chats are refused | Any post outside the group | Engineering |
| R13 | AI describes a person's face or body | Medium | High | Prompt rule, output filter, 20-photo test with people in frame | Any test output fails | AI |
| R14 | Secrets leak via logs, client or the agent session embed | Low | High | Server-only secrets; scrub the session before making it public; secret scan before every push | Scanner hit | Security |
| R15 | Our post reads like the 22% "AI that wants you to stop using it" entries | Medium | High | Lead with the four friends and the quorum; numbers from the field test; avoid the cliché phrasing | Draft review | Docs |
| R16 | MongoDB Atlas weakens the "open" story (SSPL not OSI-approved) | Medium | Low | Architect weighs Postgres vs Atlas on the merits and records the decision and the license fact | Decision record | Engineering lead |
| R17 | A tester declines name, face or voice in the post | Medium | Low | First names only by default; consent checklist Sunday morning | Any "no" | Product |
| R18 | Real Plan on Sunday morning fails (deploy late, deadline passes) | Medium | High | Deploy approval asked at 9:30 AM; Plan deadline set 20 min before 11; if it fails, record it and send a Flare at the meeting point | RC not live by 10:05 AM | Ops |
| R19 | "I'm fading" reveals who faded in a group of 2 or 3 | High | Low | Disclose on the privacy page like R6; no counts shown | Always true; disclose | Product |
| R20 | Rest loop routes over private paths or missing sidewalks | Medium | Medium | Only allowed `highway` values; exclude `access=private|no`; card says "Check the path. Map data can be wrong." | Tester reports a bad segment | Maps |
| R21 | AI drafts wrong OSM tags | Medium | Low | Allow-list keys, every tag human-reviewed, export only; report keep rate | Keep rate under 70% | AI |
| R22 | Hot spots blob reveals places if the group key leaks | Low | Medium | Key only in the link fragment; never logged; the privacy page says anyone with the link can read the group's history | Key found in any log | Security |
