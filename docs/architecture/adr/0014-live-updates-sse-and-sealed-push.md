# ADR-0014: Server-Sent Events for live views; Web Push with a sealed notice

Status: Accepted. Date: 2026-10-10. Implements SRS-SOL-3 (5 s), SRS-LIT-1 (10 s), SRS-IF-3. Contract: `gatheringEvents` and `push` in [asyncapi.yaml](../contracts/asyncapi.yaml).

## Decision
- **Open pages** subscribe to `GET /api/v1/gatherings/{id}/events` (SSE, via Hono's `streamSSE`). Each change sends the whole view (under 25 KB, mostly the sealed blob; the photo is separate). Keepalive comment every 15 s, under common 30 to 60 s proxy idle limits. Pages also poll every 30 s while visible, and reload on `visibilitychange` to visible.
- **Closed apps** get Web Push (RFC 8291 encryption, VAPID RFC 8292, `web-push` 3.6.7). Push needs the app on the Home Screen on iOS 16.4 and later; capability detection decides (SRS-COMP-2).
- **The payload carries `notice_ct`,** sealed by the host's phone at creation with the host name, spot, Ember bench names and step names. The service worker reads the group key from IndexedDB, opens it and writes "It's lit. Fuego is at Ford Woods Park pond." If it can't, it shows "It's lit. Open Flare to see where." The server never writes a readable notice for a link group.
- Who gets a Lit notice: members of the chosen set (SRS-LIT-1). The solver's set is used for addressing only and never leaves the server (SRS-PRIV-8).

## Options weighed
| Option | Why not |
| --- | --- |
| WebSockets for phones | Needs a socket library on the phone and sticky handling through proxies; SSE is plain HTTP, reconnects by itself with `Last-Event-ID` |
| Polling only | 5 s updates would mean a request every 5 s per open page |
| Readable push text from the server | The server would need names and places (ADR-0009) |
