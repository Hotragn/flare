# ADR-0017: Link previews show the brand card and the count

Status: Accepted. Date: 2026-10-10. Settles question 6 of handoff 06; amends BR-CH-4.

## Context
BR-CH-4 asked for a blurred photo and the invite line in link previews. The server can't read the invite line (sealed, ADR-0008), and previews are fetched and cached by iMessage, WhatsApp and Telegram on their own servers, where our 5-minute deletion can't reach.

## Decision
`GET /g/{gatheringId}` returns the app HTML with Open Graph tags built from what the server can read: title "A Flare from a friend", description "Need {n} more. Open it to say yes in private.", image the brand OG card (`brand/export/social/og-image-1200x630.png`). No photo, no blur, no place, no words. This is the copy deck's `og.link` variant `safe`, already in force.

## Consequences
- Nothing about the gathering is left in other companies' preview caches after Gone, except a count.
- `photos.blur_preview` is dropped from the schema.
- BR-CH-4 is amended to point here (BUG-026).
