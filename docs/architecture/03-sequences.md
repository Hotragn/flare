# Flare: Sequence diagrams

Version 1.0, Sat 2026-10-10. Owner: Architect. Endpoints and messages refer to [openapi.yaml](contracts/openapi.yaml) and [asyncapi.yaml](contracts/asyncapi.yaml). Times are budgets from the SRS.

## S1. Send a Flare (SRS-CRE-1 to 9, median ≤ 15 s)

```mermaid
sequenceDiagram
  autonumber
  actor H as Host
  participant A as Host app
  participant S as Server
  participant R as Hub relay
  participant O as Hub + Ollama
  H->>A: Open app (camera live ≤ 1.5 s)
  H->>A: Shutter
  par draft
    A->>S: POST /api/v1/drafts (768 px JPEG)
    S->>R: job header + binary frame
    R->>O: /api/chat think:false
    O-->>R: {invite, alt} ~3.0 s
    R-->>S: result
    S->>S: enforce(), zero-fill buffer
    S-->>A: {invite, alt, tier: hub}
  and place
    A->>A: Nearest named feature ≤ 150 m, Ember candidates ≤ 400 m (map pack)
  end
  Note over A: Six words type in while the print develops (2.4 s)
  H->>A: Edit or keep words, tap quorum (2, 3, 4), Send
  A->>A: Seal blob (AAD g:id) and notice (AAD n:id), seal 1600 px photo (AAD p:id)
  A->>S: POST /groups/{g}/gatherings (Idempotency-Key)
  S->>S: Insert, host = 1 yes, short code, jobs: ember at t0+30 min
  S-->>A: 201 Gathering {short_code, need: 1}
  A->>S: PUT /gatherings/{id}/photo (ct)
  A->>H: Share sheet: link with #k=key, "Copy as text"
```

If the hub is absent or misses 6 s, step 8 returns `tier: rules` with the template and the app shows the typed six-word field with map-pack chips.

## S2. A friend says yes with a condition (SRS-RES-3, SRS-COND-5, ≤ 10 s)

```mermaid
sequenceDiagram
  autonumber
  actor F as Friend
  participant W as Link page
  participant S as Server
  F->>W: Open link (key in #fragment)
  W->>S: GET /gatherings/{id}
  S-->>W: view (need, sealed, server_time)
  W->>S: GET /gatherings/{id}/photo
  W->>W: Open blob and photo with key
  alt first visit
    W->>S: POST /groups/{g}/members {id, name_ct, write_token}
  end
  W->>S: GET /gatherings/{id}/events (SSE)
  F->>W: Add a condition: "after 2, only with Amor"
  W->>W: Rules parser: after(14:00 local → UTC), with(Amor's member id)
  W->>F: "Got it: after 2 PM, only with Amor. Right?"
  F->>W: Yes
  W->>W: Show "You're in." now (optimistic, ≤ 500 ms)
  W->>W: Needs check per label (spot, c1..cN)
  W->>S: PUT /gatherings/{id}/me {answer: yes, rules, checks}
  S->>S: Lock gathering row, save, solve, version + 1
  S-->>W: Me {answer: yes}
  S--)W: SSE gathering {need: 0 or N}
```

The typed words stay in IndexedDB on the friend's phone. Only the two rules cross the network.

## S3. It lights (SRS-LIT-1, ≤ 10 s to every member of the set)

```mermaid
sequenceDiagram
  autonumber
  participant S as Server
  participant DB as Postgres
  participant P as Push services
  participant T as Telegram
  participant W as Friend phones
  S->>DB: Transaction: solver set ≥ quorum → state lit, lit_at, chosen_set, version + 1
  S->>DB: Cancel ember job, add gone job at Done or t0 + 4 h
  S--)W: SSE gathering {state: lit} (open pages)
  loop each member in the chosen set with a subscription
    S->>P: Web Push {g, event: lit, notice_ct} TTL 600, urgency high
    P--)W: Service worker opens notice_ct: "It's lit. Fuego is at Ford Woods Park pond."
  end
  opt Telegram group
    S->>T: editMessageCaption "It's lit..." (buttons removed)
    S->>T: sendMessage (notifies the chat)
  end
  W->>W: Save Lit data (spot, target, lines, time) in IndexedDB
```

## S4. Shrinks to an Ember (BR-F-3, BR-E-1 to 6)

```mermaid
sequenceDiagram
  autonumber
  participant J as Scheduler
  participant S as Engine
  participant W as Phones
  J->>S: ember job due (t0 + 30:00)
  S->>S: Not lit → state ember, quorum 2, version + 1
  S--)W: SSE {state: ember, ember_choice: null}
  W->>S: PUT /me/checks {c1: false, c2: true, ...} (within 60 s)
  Note over S: At Ember start + 60 s, missing reports count as pass (BR-E-4)
  S->>S: Pick first label passed by every yes and every Ember-only yes, else spot
  S--)W: SSE {ember_choice: "c2", need: 1}
  W->>W: "Smaller plan: 15 min at {bench name from sealed blob}."
  Note over S: Ember-only yeses now count (BR-Q-6). Lit before t0 + 60 min increments embers_lit.
```

## S5. A Plan solves at the deadline, then someone fades (BR-P-2 to 7)

```mermaid
sequenceDiagram
  autonumber
  participant J as Scheduler
  participant S as Engine
  participant W as Phones
  J->>S: plan_deadline job due (D)
  S->>S: For each step 1..4: best set (most people, higher step, earlier start)
  alt some step reaches quorum
    S->>S: lit at that step
  else ≥ 2 fit step 4
    S->>S: lit at step 4, Ember save
  else
    S->>S: gone, "Not this time."
  end
  S--)W: SSE + push "It's on: {step} at {time}."
  actor M as Member in the set
  M->>W: I'm fading
  W->>S: POST /gatherings/{id}/fade
  S->>S: Check window (S + 50% of step) and once per member
  S->>S: step + 1 (max 4), re-solve, add new fits, remove nobody
  S->>S: Members whose own rules now fail: still_coming = true
  S--)W: SSE {current_step} "Smaller plan: {step}."
  S--)W: Push to those members only: "Plan changed to {step}. Still coming?"
```

## S6. I'm here with no signal (BR-H-5, SRS-OFF-3)

```mermaid
sequenceDiagram
  autonumber
  actor F as Friend
  participant W as Phone
  participant Q as Outbox (IndexedDB)
  participant S as Server
  F->>W: I'm here (airplane mode)
  W->>Q: {idem_key, POST /arrivals, {for: self, recorded_at}}
  W->>F: "You made it." (local)
  Note over W: Compass and Lit screen run from saved data: "Offline. Saved at 2:41 PM."
  W->>W: online event
  Q->>S: POST /gatherings/{id}/arrivals (Idempotency-Key)
  S->>S: recorded_at inside the Lit window? headcount + 1 (cap yes + 3)
  S-->>Q: 200 {counted, spark_ticket} → keep the ticket, remove the item
  Q->>S: Retry of the same key (lost response)
  S-->>Q: Same 200 from the idempotency table, no second count
```

## S7. Telegram tap, then a condition (contracts/telegram.md)

```mermaid
sequenceDiagram
  autonumber
  actor U as Telegram user
  participant T as Telegram
  participant S as Server
  participant W as Link page
  U->>T: Tap [I'm in] in the group
  T->>S: webhook callback_query y:{id}
  S->>S: Member via telegram, yes, solve
  S->>T: answerCallbackQuery "You're in. Only you see this."
  S->>T: editMessageCaption "Need 1 more."
  U->>T: Tap [Add a condition]
  T->>S: callback_query c:{id}
  S->>S: bind token (10 min, hash stored)
  S->>T: answerCallbackQuery url=t.me/FairlaneFlareBot?start=b_{token}
  T->>U: Private chat opens, user taps Start
  T->>S: /start b_{token}
  S->>T: sendMessage [Add a condition] → link?via=tg&bind={token}#k=...
  U->>W: Open link
  W->>S: POST /groups/{g}/members (phone's own member)
  W->>S: POST /gatherings/{id}/telegram-bind {token}
  S->>S: Move the Telegram yes onto this member, delete the tap-made member
  Note over W: Condition flow as in S2
```

## S8. Gone and deletion (BR-D-1 to 3)

```mermaid
sequenceDiagram
  autonumber
  actor H as Host
  participant S as Server
  participant DB as Postgres
  participant T as Telegram
  participant W as Phones
  H->>S: POST /gatherings/{id}/done
  S->>DB: state gone, ended thanks_for_coming, jobs: delete at +60 s
  S--)W: SSE gone {ended}
  W->>W: Delete saved Lit data, show Spark prompt once if it holds a spark ticket
  opt Telegram group
    S->>T: edit to "Thanks for coming."
    S->>T: deleteMessages [ids]
  end
  S->>DB: +60 s: DELETE FROM gatherings WHERE id (cascade)
  S->>DB: counters + 1 (day bucket)
  Note over DB: Backstops: sweeper every 30 s, cron every 5 min, expires_at on every row
```

## S9. Hub connects, drops, comes back (ADR-0006)

```mermaid
sequenceDiagram
  autonumber
  participant O as Ollama
  participant Hb as Hub
  participant S as Server
  Hb->>O: Warm-up chat (7 to 14 s cold)
  Hb->>S: WSS /hub, Authorization: Bearer HUB_SECRET
  S->>S: timingSafeEqual, wrong → 401
  Hb->>S: hello {protocol flare-hub.v1, model, ready: true}
  loop every 5 s, silent 12.5 s: server drops the hub, silent 15 s: hub redials
    S->>Hb: ping
    Hb->>S: pong
  end
  Note over Hb,S: Wi-Fi drops: socket closes, health shows hub absent, drafts use the template
  Hb->>S: Reconnect after 0.25, 0.5, 1 ... 30 s
  Hb->>S: hello
  loop every 20 min
    Hb->>O: Warm-up chat (keeps the 30 min keep_alive from expiring)
  end
```
