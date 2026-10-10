# ADR-0012: Plain-text forms cut with "..." to stay GSM-7

Status: Accepted. Date: 2026-10-10. Accepts the change request in handoff 06 (decision 8) and amends BR-CH-2.

## Context
BR-CH-2 cut long spot names with "…" (U+2026). That character is not in the GSM-7 alphabet, so one "…" switches the whole SMS to UCS-2, where a segment holds 70 characters instead of 160, and a 200-byte message splits into 3 segments.

## Decision
Cut with "..." (three ASCII full stops). Cut whole code points so the text stays valid UTF-8. Spec: [contracts/plain-text.md](../contracts/plain-text.md). Code: `packages/shared/src/plaintext.ts`, 9 tests.

## Consequences
- No Fairlane spot needs a cut today (longest 89 of 200 bytes), so this matters only elsewhere.
- BR-CH-2's text is updated to "..." with a pointer here (BUG-026).
