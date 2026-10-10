# Flare: Channel copy (Telegram, push, SMS, share sheet, link previews)

Owner: Copy. Version 1.0, Sat 2026-10-10. Every line below is a key in [deck.json](../../design/prototype/src/lib/copy/deck.json) (key in `code`), so engineering reads the text from the deck, not from this page. This page shows how the lines combine into whole messages and when each is sent. Samples use Fuego, Ford Woods Park, the bench by the lot.

## 1. Telegram bot

Rules that shape every message:

- The bot posts only in allow-listed chats; at release that is "Flare test" (BR-CH-1, SRS-CH-1).
- The group sees the count and nothing else (BR-Q-5). Who said yes, conditions and take-backs happen in a private chat or a private button reply.
- The bot speaks as "I". Every message line is 12 words or fewer.
- Telegram's 48 h delete limit: Flares end within 4 h and Plans start within 36 h (BR-P-1), so every post can be deleted.

### 1.1 Group post (Flare)

Photo with this caption. Lines 3 and 4 are edited in place within 5 s of any change (SRS-CH-2).

```
Golden pond, come sit with me                 ← the six words (host's invite)
Fuego is waiting at Ford Woods Park, by the pond.   send.hostLine
Need 1 more. Nobody sees who.                 bot.post.need
Open until 2:44 PM.                           bot.post.until  (t0 + 30 min)
[ I'm in ]  [ Add a condition ]  [ Open in Flare ]
  invite.yes    invite.condition     bot.post.open (the link with its key)
```

Live edits of line 3:

| Moment | Line 3 becomes | Key |
| --- | --- | --- |
| A yes or a take-back | "Need 2 more. Nobody sees who." (new N) | `bot.post.need` |
| Quorum reached | "It's lit." | `need.lit` |
| Ember starts (t0 + 30 min) | "Smaller plan: 15 min at the bench by the lot." then "Need 1 more." | `ember.headline`, `bot.post.ember` |
| Gone, never lit | "Not this time." | `gone.title` |
| Gone after Lit (host taps Done) | "Thanks for coming." | `outside.thanks` |

New group messages (so people get a notification): at Lit, "It's lit. Fuego is at Ford Woods Park, by the pond." (`lit.notice`); at Ember, "Smaller plan: 15 min at the bench by the lot." (`ember.headline`). Nothing is posted for a take-back.

### 1.2 Group post (Plan)

```
Fairlane walk at 11?                          ← the host's ask
Answer by 10:40 AM. Four sizes, biggest first.     planInvite.meta
1. Ford Woods loop, 60 min                    bot.plan.step (×4)
2. Park loop, 30 min
3. Short walk, 15 min
4. 10 min on the bench, 10 min
Need 1 more for step 1: Ford Woods loop.      planInvite.needAt (edited live)
[ I'm in ]  [ Short one only ]  [ Add a condition ]
```

At the deadline the last line becomes one of: "It's on: Ford Woods loop at 11:00 AM." (`planLit.on`), "Smaller plan: 10 min on the bench at 11:00 AM." (`planLit.ember`), "Not this time." (`gone.title`). After a fade: new message "Smaller plan: Short walk." (`planLit.smaller`), never who or how many.

### 1.3 Button taps (private replies)

Telegram shows a button-tap reply only to the person who tapped, so this is where a yes is confirmed.

| Tap | Reply (private toast) | Key |
| --- | --- | --- |
| I'm in, private chat already started | "You're in. Only you see this." | `bot.cb.yes` |
| I'm in, no private chat yet | "You're in. Start a chat with me for the lit message." (the reply opens the bot's chat; Start runs /start) | `bot.cb.yesNoChat` |
| I'm in again | "You're already in." | `bot.cb.already` |
| Any button after Gone | "This Flare is over." | `err.over` |
| Group already has 12 people | "Groups max out at 12." | `join.full` |

### 1.4 Private chat

| When | Message | Buttons | Keys |
| --- | --- | --- | --- |
| /start | "Hi, this is Flare." / "I post Flares in your group and keep yeses private." / "Nothing to do now. I'll message you when one's lit." | none | `bot.start.hello`, `bot.start.what`, `bot.start.next` |
| /help | "Tap I'm in on a Flare. Only the count is shown." | none | `bot.help` |
| After a yes | "You're in for Fuego's Flare." / "I'll message you when it's lit. Nobody sees who said yes." | Take it back · Add a condition | `bot.dm.yes`, `bot.dm.yes2`, `in.takeBack`, `invite.condition` |
| Take it back (before Lit) | "Taken back. Nobody was told." | none | `in.takenBack` |
| After Lit, the button reads Can't make it | "Got it. Nobody was told." State stays Lit (SRS-RES-6). | none | `lit.cant`, `lit.cantDone` |
| Add a condition | "Type your condition in your own words." / "Like 'after 2' or 'only with Amor'." / first time only: "Telegram and our server see this text. We keep only the rule." | none | `bot.dm.condAsk`, `bot.dm.condExample`, `bot.dm.condPrivacy` |
| Condition read back | "Got it: only with Amor, back by 5 PM. Right?" | Yes · Fix it | `readback.line`, `bot.dm.yesBtn`, `readback.fix` |
| Yes to the read-back | "Saved. You're in with that condition." | none | `bot.dm.saved` |
| Couldn't parse | "I didn't catch that. Try 'after 2' or 'only with Amor'." | none | `cond.didntCatch` |
| Names someone outside the group | "Kai isn't in this group." | none | `cond.notInGroup` |
| Lit (to each person in the chosen set) | "It's lit. Fuego is at Ford Woods Park, by the pond." | Find them (opens the Lit page) | `lit.notice`, `lit.find` |
| Plan changed after a fade, own condition no longer holds (OQ-2, pending) | "Plan changed to Short walk. Still coming?" | none, no action needed | `fade.stillComing` |
| Any other text, nothing open | "No Flare is open. They show up in your group." | none | `bot.dm.nothingOpen` |

### 1.5 Cleanup at Gone

- The bot deletes every message it posted for that gathering, in the group and in private chats (BR-D-3, SRS-CH-4). It posts nothing new about the deletion.
- Copy proposal for engineering to confirm with the architect: edit line 3 to the final words ("Not this time." or "Thanks for coming."), then delete within the same 5-minute window as the server data (BR-D-1). BR-D-3 says "at Gone"; if that means at once, skip the edit and delete straight away. Listed in handoff 06.
- A failed delete is retried 3 times and logged without content (UC F2).

### 1.6 Outside the allow-listed group

- In any chat that isn't allow-listed, the bot sends nothing in that chat and leaves it (fail closed, SRS-CH-1).
- If the person who added it has a private chat with the bot, it tells them there: "Flare is test-group only for now. I left that group." (`bot.refuse.dm`).
- Server log line, no chat content: `refused chat: not allow-listed` (`bot.refuse.log`).
- Commands and mentions in the group are ignored; the bot never replies in the group except the posts above.

## 2. Push notifications (Web Push)

Title, then body. Bodies are fixed strings where the SRS sets them. Payloads should carry text sealed with the group key and be opened by the service worker, because the server never holds names or spot names in plain text (see handoff 06). If the phone can't open the payload, it shows the fallback.

| Event | Who gets it | Title | Body | Keys |
| --- | --- | --- | --- | --- |
| Lit | The chosen set | Fuego's Flare | It's lit. Fuego is at Ford Woods Park, by the pond. | `push.flareTitle`, `push.lit` (SRS-LIT-1) |
| Ember starts | Everyone in the group | Fuego's Flare | Smaller plan: 15 min at the bench by the lot. | `push.ember` (SRS-EMB-2) |
| Plan lights at the deadline | The chosen set | Fuego's Plan | It's on: Ford Woods loop at 11:00 AM. | `push.planTitle`, `push.planOn` |
| Plan lights at step 4 (Ember save) | The chosen set | Fuego's Plan | Smaller plan: 10 min on the bench at 11:00 AM. | `push.planEmber` |
| Plan result: nothing fits | Everyone who said yes | Fuego's Plan | Not this time. | `push.gone` |
| Fade | The chosen set | Fuego's Plan | Smaller plan: Short walk. | `push.planSmaller` (BR-P-7) |
| Fade breaks my own condition (OQ-2, pending) | That person only | Fuego's Plan | Plan changed to Short walk. Still coming? | `push.stillComing` |
| Unlit Flare ends | Everyone who said yes | Fuego's Flare | Not this time. | `push.gone` |
| Fallback (can't open the payload) | as above | Flare | It's lit. Open Flare to see where. / Your Flare changed. Open it to see how. | `push.fallbackTitle`, `push.fallbackLit`, `push.fallbackChange` |

No other pushes: no reminders, no "someone said yes", no Spark prompt (BR-K-3).

## 3. Plain text for SMS and satellite (BR-CH-2, BR-CH-3, FR-CH-4)

| Form | Template | Example | Bytes |
| --- | --- | --- | --- |
| Flare | `FLARE {code} {spot}. Need {n} more. Reply IN {code}. Ends {time}` | FLARE K7Q2M Ford Woods Park pond. Need 1 more. Reply IN K7Q2M. Ends 3:40PM | 74 |
| Plan | `PLAN {code} {ask} Need {n} more. Reply IN {code} by {time}` | PLAN K7Q2M Fairlane walk at 11? Need 2 more. Reply IN K7Q2M by 10:40AM | 70 |
| Lit, for the host to forward | `LIT {code} {host} is at {spot}.` | LIT K7Q2M Fuego is at Ford Woods Park pond. | 43 |
| Reply from a text-only friend | `IN {code}` | IN K7Q2M | 8 |

- Codes: 5 characters from `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (BR-CH-3). FR-CH-4's example shows 4 (K7Q2); the deck follows BR-CH-3.
- "Ends" is the end of Kindling (t0 + 30 min) for a Flare. For a Plan, "by" is the answer deadline.
- Every named spot in the pinned Fairlane result (23 names) is checked at its worst case by `copy-lint.mjs`: largest 89 bytes, 1 SMS segment, GSM-7 only, never truncated. Full table in [03-checks.md](03-checks.md).
- The host enters relayed replies on H5: "Add text yes", field "Reply code", hint "From a text like IN K7Q2M.", button "Count it", then "Counted. 1 of 3 text yeses used." or "Text yeses max out at 3." (BR-ID-6) or "That code isn't for this Flare." (`host.textYes.*`).

## 4. Share sheet (Web Share API)

| Shared thing | title | text | url or file |
| --- | --- | --- | --- |
| Flare | Fuego's Flare (`share.flare.title`) | "Golden pond, come sit with me" ⏎ "Need 1 more." (`share.flare.text`) | the link with its key |
| Plan | Fuego's Plan (`share.plan.title`) | "Fairlane walk at 11?" ⏎ "Answer by 10:40 AM." (`share.plan.text`) | the link with its key |
| Plain text | none | the SMS form above | none |
| Bench to Bench card | Bench to Bench card (`share.card.title`) | "39 min loop from the bench by the pond." (`share.card.text`) | the PDF |
| Map note | OpenStreetMap note (`share.note.title`) | `map.noteText`, for example: "Missing bench here, seen Oct 11, 2026. Suggested tags: amenity=bench, backrest=yes, material=wood, seats=3. Drafted with Flare and checked by a person on site." | none (nothing is sent to OpenStreetMap from the app, SRS-MAP-3) |

## 5. Link previews (Open Graph)

The server renders previews without the key (the part after # never reaches it), so it can only use what it can read.

| Page | Variant | og:title | og:description | Image |
| --- | --- | --- | --- | --- |
| Flare link | **safe (in force)** | A Flare from a friend | Need 1 more. Open it to say yes in private. | A blurred image only if the host's phone uploads one without the key; otherwise the brand OG image |
| Flare link | full (BR-CH-4 as written) | Golden pond, come sit with me | Need 1 more. Say yes in private. | Blurred photo |
| Plan link | safe | A Plan from a friend | Answer by 10:40 AM. Say yes in private. | Brand OG image |
| Group link | n/a | Join your friends on Flare | No account and no password. Only a first name. | Brand OG image |
| Website | n/a | Flare, for getting friends outside | Snap where you are. If enough friends say yes, it's on. Open source, private, and it works with no signal. | og-image-1200x630.png, alt: "A park at golden hour with a bench, maple leaves and a small flame." |

"full" needs the server to hold the six words (and a blurred photo) readable, which the privacy design doesn't do today. Decision for the architect; listed in handoff 06. Never in any preview: the spot name, coordinates, or who said yes (BR-CH-4).
