# ADR-0018: Ids, short codes and tokens

Status: Accepted. Date: 2026-10-10.

## Decision
| Thing | Format | Made by | Stored as | Why |
| --- | --- | --- | --- | --- |
| Group, member, gathering, Spark id | UUID v4 (122 random bits) | Phone, `crypto.randomUUID()` | Postgres `uuid` | Native type and index; 2^122 is far past guessing. SRS-ID-1's "128-bit" is met in spirit; the dictionary now says "UUID v4" (BUG-026) |
| Write token | 128 random bits, base64url (22 chars) | Phone | SHA-256 hash | SRS-SEC-4. A database leak gives no tokens |
| Short code | 5 of `23456789ABCDEFGHJKMNPQRSTUVWXYZ` | Server, rejection sampling | Text, unique among live gatherings | BR-CH-3; 28,629,151 codes. FR-CH-4's 4-character example is a typo (handoff 06, decision 9) |
| Idempotency key | 16 to 64 of `A-Za-z0-9_-` | Phone, per action | `idempotency.key`, 24 h | SRS-IF-1 |
| Telegram link and bind tokens | 128 random bits | Server | SHA-256 hash, 15 and 10 min | ADR-0013 |
| Hub secret | 32+ random bytes, base64url | Operator | Environment only | ADR-0006 |

Client-made ids let the phone seal with the id as AAD before the first request, and make creation idempotent.

## Consequences
The short code is the only thing a guesser could try, and it only allows an anonymous yes entered by the host, capped at 3 (BR-ID-6). It never opens the gathering.
