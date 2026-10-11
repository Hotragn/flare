# Plain-text line (SMS and satellite)

The contract is [contracts/plain-text.md](../architecture/contracts/plain-text.md); code in `packages/shared/src/plaintext.ts`, built on the host's phone. The server never sees the line; a text reply comes back through the host, who taps it in (`POST /gatherings/{id}/text-yes`, BE).

## Exports

| Function | Use |
| --- | --- |
| `encodePlain({code, spot, need, ends})` | `FLARE K7Q2M Ford Woods Park pond. Need 1 more. Reply IN K7Q2M. Ends 3:40PM` |
| `encodePlainPlan({code, ask, need, by})` | `PLAN K7Q2M Fairlane walk at 11? Need 2 more. Reply IN K7Q2M by 10:40AM` |
| `encodePlainLit({code, host, spot})` | `LIT K7Q2M Fuego is at Ford Woods Park pond.` |
| `parseReply(text)` | `" in k7q2m "` gives `K7Q2M`; anything else gives null |
| `plainTime(iso, tz)` (new) | rule 4: `3:40PM` in the group time zone, no space |
| `capBytes(s, max)` (new) | cuts to a byte count on a character boundary |

## Added in this package

| Case | Rule | Test |
| --- | --- | --- |
| Host name capped at 40 bytes, not 40 characters, on a character boundary | rule 1 | `Ñ` x 30 becomes 20 characters (40 bytes) |
| Plan ask cut keeps the whole tail | BR-CH-2 | ends with `... Need 4 more. Reply IN K7Q2M by 10:40AM` |
| No `…` ever | rule 2 | |
| Codes with 0, 1, I, L, O, lower case or the wrong length are refused | rule 3 | 7 bad codes |
| Time format | rule 4 | 3:40PM, 10:40AM, 12:05AM, and another time zone |
| Tabs and line breaks collapse to one space, in the host name too | rule 5 | |
| Replies with tabs and line breaks parse; extra words, missing space and bad codes don't | rule 6 | |
| 200 bytes at most for 1,500 random long mixed-script fields, never a broken character | BR-CH-2 | 500 inputs x 3 forms |

16 tests in all (8 before).
