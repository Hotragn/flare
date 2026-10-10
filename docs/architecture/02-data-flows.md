# Flare: Physical data flow diagrams

Version 1.0, Sat 2026-10-10. Owner: Architect. Maps the analyst's logical DFD ([04-data-flow-and-dictionary.md](../requirements/04-data-flow-and-dictionary.md)) onto real processes, stores and wires. Level 0 is the whole system, level 1 the containers, level 2 one diagram for each sensitive flow: photo, conditions, needs profile, location, deletion.

## Trust zones

| Zone | What runs there | Who controls it | Trust |
| --- | --- | --- | --- |
| **P** Phone | Web app, service worker, IndexedDB | The person | Trusted with their own data and the group key |
| **S** Server | Render web service, Postgres, cron | Us, on Render's hardware | Trusted to run code honestly; **not** trusted with readable content. Designed so a full database dump reveals no names, places, photos or conditions of a link group |
| **H** Hub | Team Mac: hub process, Ollama | Us | Sees one photo at a time in memory; keeps nothing |
| **X** Third parties | Telegram, Apple and browser push services, the friend's SMS carrier, Overpass at build time | Them | Untrusted. Push services get ciphertext; Telegram gets what Telegram groups chose to post |

Boundaries are drawn as `=== TB` labels. Every arrow that crosses one is TLS 1.2+ (HTTPS or WSS), except SMS, which the host sends from their own phone.

Notation: `[process]`, `[(store)]`, `([external])`. `ct` = sealed with the group key (AES-256-GCM).

## Level 0

```mermaid
flowchart LR
  subgraph P [Zone P: phones]
    hostP[Host phone]
    friendP[Friend phone]
  end
  subgraph S [Zone S: Render]
    server[Flare server]
    pg[(Postgres)]
  end
  subgraph H [Zone H: team Mac]
    hub[Hub + Ollama]
  end
  subgraph X [Zone X: third parties]
    tg([Telegram])
    ps([Push services])
    sms([SMS carrier])
  end
  hostP -- "TB-PS: ct blob, ct photo, labels, quorum" --> server
  hostP -- "TB-PS: 768 px JPEG, readable, draft only" --> server
  friendP -- "TB-PS: yes, rules, pass/fail per label" --> server
  server -- "TB-PS: counts, state, ct blobs (SSE)" --> friendP
  server -- "TB-SH: JPEG over WSS, memory only" --> hub
  hub -- "TB-SH: six words, scene" --> server
  server --- pg
  server -- "TB-SX: ct notice" --> ps --> friendP
  server <-- "TB-SX: Telegram groups only, readable post" --> tg
  hostP -- "plain-text form, host's own SMS" --> sms
```

## Level 1

```mermaid
flowchart TB
  subgraph P [Zone P: phone]
    cam[1.1 Camera and resize]
    seal[1.2 Seal]
    parse[1.3 Rules parser]
    needs[1.4 Needs check]
    comp[1.5 Compass]
    outbox[1.6 Outbox]
    sw[1.7 Service worker]
    kdb[(PH1 keys, tokens,<br/>names, free text)]
    ndb[(PH2 needs profile)]
    ldb[(PH3 saved Lit data)]
    odb[(PH4 outbox)]
    pack[(PH5 map pack)]
  end
  subgraph S [Zone S: server]
    api[2.1 API + auth + idempotency]
    eng[2.2 Engine + solver]
    sch[2.3 Scheduler]
    fan[2.4 SSE + push + bot]
    swp[2.5 Sweeper + cron]
    rel[2.6 Hub relay]
    gdb[(DS1 gatherings)]
    rdb[(DS2 responses)]
    phdb[(DS3 photos ct)]
    jdb[(DS4 jobs)]
    mdb[(DS5 groups, members)]
    pdb[(DS6 push subs)]
    tdb[(DS7 bot refs, tg maps)]
    kdb2[(DS8/9 sparks ct, hotspots ct)]
    cdb[(DS10 counters)]
    lldb[(DS11 live location ct)]
    log[(DS12 logs, 7 days)]
  end
  subgraph H [Zone H: hub]
    hubp[3.1 Hub job]
    oll[3.2 Ollama]
  end
  cam -- JPEG --> rel
  cam -- photo --> seal
  kdb --> seal
  pack --> needs
  ndb --> needs
  seal -- ct --> outbox
  parse -- rules --> outbox
  needs -- pass/fail per label --> outbox
  outbox --> odb
  outbox -- HTTPS --> api
  api --> eng
  eng --> gdb & rdb & mdb
  api --> phdb
  eng --> jdb
  sch --> eng
  eng --> fan
  fan -- SSE --> ldb
  fan --> pdb
  fan --> tdb
  rel -- WSS --> hubp --> oll
  swp --> gdb & rdb & phdb & jdb & tdb & lldb
  api -. "method, route template, status, ms" .-> log
  ldb --> comp
  sw --> odb
  eng --> cdb
```

## Level 2: photo

```mermaid
flowchart LR
  subgraph P [Zone P: host phone]
    shoot[Shutter] --> bmp[createImageBitmap]
    bmp --> small[OffscreenCanvas<br/>768 px, JPEG q0.7]
    bmp --> big[OffscreenCanvas<br/>1600 px, JPEG q0.8]
    big --> enc[AES-256-GCM<br/>AAD p:gatheringId]
    key[(group key)] --> enc
  end
  subgraph S [Zone S: server]
    drafts[POST /api/v1/drafts<br/>≤ 1.5 MB, FF D8 FF]
    buf[[Uint8Array<br/>zero-filled in finally]]
    putp[PUT /gatherings/id/photo]
    photos[(photos.ct<br/>expires_at, cascade)]
  end
  subgraph H [Zone H: hub]
    frame[[binary frame<br/>zero-filled after call]]
    ol[Ollama /api/chat<br/>think:false]
  end
  subgraph X [Zone X]
    tgp([Telegram sendPhoto<br/>Telegram groups only])
  end
  small -- "TB-PS: readable JPEG" --> drafts --> buf -- "TB-SH: WSS" --> frame --> ol
  ol -- "6 words, scene" --> frame -- result --> buf
  enc -- "TB-PS: ct" --> putp --> photos
  small -. "TB-PS: readable, Telegram groups only" .-> tgp
  photos -- "GET photo: ct" --> friend[Friend phone opens with key]
```

| Flow | Crosses | Data | Stored | Deleted |
| --- | --- | --- | --- | --- |
| Draft photo | P→S→H | Readable 768 px JPEG | Nowhere (memory, zero-filled) | End of request (ADR-0011) |
| Shared photo | P→S | Ciphertext | `photos.ct` | Cascade at Gone, expiry backstop |
| Telegram photo | P→S→X | Readable 768 px JPEG | Telegram's servers | We delete the message at Gone; Telegram's own retention applies |
| Six words, scene | H→S→P | Readable text | Not on the server; sealed into the blob by the phone | With the blob |

## Level 2: conditions

```mermaid
flowchart LR
  subgraph P [Zone P: friend phone]
    say[Typed or dictated text]
    dict([Apple speech service<br/>if Safari dictation is used]):::x
    rp[Rules parser<br/>with, after, back_by,<br/>max_walk, max_step, min_step]
    names[(PH1 names, plain)]
    rb[Read-back ≤ 12 words<br/>Yes saves]
    ft[(PH1 free text<br/>kept on phone)]
  end
  subgraph S [Zone S]
    me[PUT /gatherings/id/me<br/>rules only]
    resp[(responses.rules jsonb)]
    solver[Solver]
  end
  subgraph X [Zone X]
    tgdm([Telegram private chat])
  end
  say -.-> dict -.-> say
  say --> rp
  names -- resolve 'Amor' to member id --> rp
  rp --> rb --> me
  say --> ft
  me --> resp --> solver
  tgdm -- "free text: dropped unread,<br/>bot replies with the link" --> bot[Bot handler] -. nothing stored .- resp
  classDef x stroke-dasharray: 4 4
```

Free text never crosses TB-PS (SRS-COND-6). Proof to build: a Playwright test that types a condition and asserts no request body contains the typed words (12-testing-strategy.md, T-PRIV-2). Dictation in Safari may use Apple's servers; the mic prompt says so (handoff 06, decision 11).

## Level 2: needs profile

```mermaid
flowchart LR
  subgraph P [Zone P: friend phone]
    prof[(PH2 needs profile<br/>avoid steps, rest gap,<br/>restroom within 300 m)]
    pack[(PH5 map pack)]
    blob[Opened sealed blob<br/>spot, c1..c12, step:1..4]
    chk[BR-A-2 checks]
    em[Count me in for a closer one?]
  end
  subgraph S [Zone S]
    put[PUT /gatherings/id/me/checks]
    sc[(responses.spot_checks<br/>label → bool)]
    pick[Ember pick:<br/>first label passed by all]
  end
  prof --> chk
  pack --> chk
  blob --> chk
  chk -- "TB-PS: {spot: false, c1: true, c2: true}" --> put --> sc --> pick
  chk -- fails at spot --> em -- "TB-PS: ember_only: true, no reason" --> put
```

The server learns, per label, whether some member's checks passed. It never learns which need failed or why (SRS-ACC-4). Small groups may guess; P6 says so (R19).

## Level 2: location

```mermaid
flowchart LR
  subgraph P1 [Zone P: host phone]
    gps[Geolocation]
    near[Nearest named feature<br/>within 150 m, map pack]
    cand[Ember search ≤ 400 m,<br/>≤ 12 benches]
    sealb[Seal blob and notice]
    live[Opt-in live location<br/>Lit only]
  end
  subgraph S [Zone S]
    g[(gatherings.sealed ct,<br/>ember_candidates labels)]
    ll[(live_locations.ct<br/>overwritten, no history)]
  end
  subgraph P2 [Zone P: friend phone]
    open[Open blob with key]
    saved[(PH3 saved target)]
    compass[Compass: bearing,<br/>distance, speech]
    fgps[Own geolocation<br/>never sent]
  end
  gps --> near --> sealb
  gps --> cand --> sealb
  sealb -- "TB-PS: ct + labels c1..cN" --> g
  gps --> live -- "TB-PS: ct" --> ll
  g -- "TB-SP: ct" --> open --> saved --> compass
  ll -- "TB-SP: ct, chosen set only" --> open
  fgps --> compass
```

The friend's own position never leaves their phone: walking time and `max_walk` are checked locally and reported as pass or fail (BR-C-7). No arrow carries a coordinate in readable form across TB-PS (ADR-0009).

## Level 2: deletion

```mermaid
flowchart TB
  done[Done, cancel, or timer:<br/>Ember end, Plan end, 4 h cap] --> gone[Engine: state = gone,<br/>ended set, version + 1]
  gone --> ev[SSE gone event, push 'Not this time.'<br/>or nothing after Done]
  gone --> botc[Bot: edit to final line,<br/>deleteMessages within 5 min]
  gone --> job[jobs: delete at now + 60 s]
  job --> del["DELETE FROM gatherings WHERE id = $1<br/>cascade: photos, responses, jobs,<br/>bot_messages, live_locations, telegram_binds"]
  sweep[Sweeper every 30 s:<br/>state = gone or expires_at < now] --> del
  cron[Render cron every 5 min:<br/>npm run sweep] --> del
  del --> cnt[counters: final tallies,<br/>day buckets only]
  del --> aud[Audit: expired rows per table = 0]
  ev --> ph[Phone: delete PH3 saved Lit data]
```

| Store | Removed by | Worst case |
| --- | --- | --- |
| DS1 to DS4, DS7 refs, DS11 | Cascade from `gatherings` | 60 s after Gone; 5 min if the web service is down (cron) |
| Telegram messages | `deleteMessages` | 5 min, 3 retries |
| Phone PH3 | Phone on learning Gone | 24 h after Lit if the phone never comes online |
| Logs DS12 | Render | 7 days; contain no ids or content |
| Preview caches (iMessage, WhatsApp, Telegram) | Out of our reach | Hold only the brand card and a count (ADR-0017) |
