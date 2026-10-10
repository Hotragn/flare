# Contract: plain-text forms (SMS and satellite)

Version 1.0, Sat 2026-10-10. Code: [packages/shared/src/plaintext.ts](../../../packages/shared/src/plaintext.ts). Tests: [packages/shared/test/plaintext.test.ts](../../../packages/shared/test/plaintext.test.ts). Requirements: FR-CH-4, BR-CH-2, BR-CH-3, BR-ID-6, SRS-CH-5, SRS-CH-6. Decision: [ADR-0012](../adr/0012-plain-text-ascii-cut-mark.md).

The host's phone builds these lines and hands them to the share sheet ("Copy as text"). The server never sees them. A friend with no data or on satellite texting reads the line and replies `IN {code}` to the host, who taps it in (SRS-CH-6).

## Forms

| Form | Template | Example (bytes) |
| --- | --- | --- |
| Flare | `FLARE {code} {spot}. Need {n} more. Reply IN {code}. Ends {time}` | `FLARE K7Q2M Ford Woods Park pond. Need 1 more. Reply IN K7Q2M. Ends 3:40PM` (74) |
| Plan | `PLAN {code} {ask} Need {n} more. Reply IN {code} by {time}` | `PLAN K7Q2M Fairlane walk at 11? Need 2 more. Reply IN K7Q2M by 10:40AM` (70) |
| Lit | `LIT {code} {host} is at {spot}.` | `LIT K7Q2M Fuego is at Ford Woods Park pond.` (43) |
| Reply | `IN {code}` | `IN K7Q2M` (8) |

## Rules

1. **Length.** Every form is at most 200 bytes of UTF-8 (BR-CH-2). One free field takes the cut: `{spot}` for Flare and Lit, `{ask}` for Plan. The host name is capped at 40 bytes by the create form.
2. **Cut mark.** A cut field ends in `...` (three ASCII full stops), not `…`. `…` is not in the GSM-7 alphabet, so one would switch the whole text to UCS-2 and split it into 3 segments. Cutting removes whole code points, so the result is always valid UTF-8.
3. **Code.** 5 characters from `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (31 symbols, no 0, 1, I, L, O), made with rejection sampling from `crypto.getRandomValues`. Unique among live gatherings (database partial unique index `gatherings_live_code`). 31^5 = 28,629,151 codes.
4. **Time.** `{time}` is the server's next-change time in the group time zone, formatted `h:mmAM` with no space (saves a byte, stays readable).
5. **Spaces.** Runs of whitespace in a field become one space.
6. **Reply parsing.** `parseReply` accepts `IN` and a code in any case with any spacing around them (`in k7q2m`, ` IN   K7Q2M `). Anything else returns `null` and the host sees "That's not a Flare code."
7. **Counting.** A reply the host taps in is an anonymous yes: no member id, no rules. At most 3 per gathering (BR-ID-6). The host's phone sends `POST /api/v1/gatherings/{id}/text-yes` with the code; the server checks it matches the gathering (`422 code_mismatch`) and the cap (`409 text_yes_cap`).

## Proof

- Every named spot in the pinned Fairlane result fits with no cut: the longest is 89 bytes (Henry Ford Academy & Windmill Park), from docs/content/03-checks.md.
- Tests cover: the PRD example exactly, 150 two-byte characters cut to at most 200 bytes, an ASCII spot staying GSM-7 after a cut, 80 four-byte emoji with no broken character, the Plan and Lit forms, a bad code refused, reply parsing, and 200 random codes matching the alphabet.
