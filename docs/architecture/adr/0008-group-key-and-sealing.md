# ADR-0008: Group key in the link fragment; sealing on the phone

Status: Accepted. Date: 2026-10-10. Implements SRS-ID-1, SRS-ID-2, SRS-ID-4, SRS-CRE-6, SRS-SEC-3.

## Decision
- The creator's phone makes a 256-bit group key with `crypto.getRandomValues` and imports it as a non-extractable AES-GCM `CryptoKey` after writing the raw bytes once into the link.
- Links look like `https://{host}/g/{gatheringId}#k={key base64url}`. Browsers never send the `#fragment` to servers, and our server never logs URLs with fragments (it cannot see them). Link previews are built server-side without the key (ADR-0017).
- Every readable thing is sealed with AES-256-GCM (WebCrypto), a fresh random 96-bit nonce per seal, nonce prepended, base64url. The additional authenticated data binds the ciphertext to its place, so a sealed field cannot be moved:

| Sealed field | AAD |
| --- | --- |
| Gathering blob `sealed` | `g:{gatheringId}` |
| Photo | `p:{gatheringId}` |
| Notice `notice_ct` | `n:{gatheringId}` |
| Member name `name_ct` | `m:{groupId}:{memberId}` |
| Spark `text_ct` | `s:{groupId}:{sparkId}` |
| Hot spots `blob_ct` | `h:{groupId}` |
| Live location `location_ct` | `l:{gatheringId}` |

- Place keys for Sparks are hashed, not sealed: `HMAC-SHA-256(HKDF(groupKey, info="flare place v1"), placeKey)`, so equal places match without the server learning which place.
- The phone keeps keys, member ids and write tokens in IndexedDB (per origin; the service worker reads it for push).

## Consequences
- Anyone who gets the link can read the gathering. That is the sharing model; the link is the invitation. The privacy page says so.
- Losing the link means losing access; there is no recovery by design (no accounts).
- A key rotation is not offered in this release. "Forget this group" (ADR-0015) is the exit.
- Telegram groups post the link in Telegram, so Telegram can read that group (ADR-0013).

## Options weighed
| Option | Why not |
| --- | --- |
| Server-held keys | The server could read everything; breaks FR-PRIV-1 |
| Per-member keys (MLS, Signal-style) | Correct, but weeks of work and no browser library we trust at this size |
| Key in a query string | Sent to the server and kept in logs and browser history on the server side |
