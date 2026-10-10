# Flare: Copy deck (moved)

The 85 strings first extracted here by product design are superseded by the full copy deck from the copy role (Oct 10):

- Source of truth: [design/prototype/src/lib/copy/deck.json](../../design/prototype/src/lib/copy/deck.json), read by every screen through `t()` in `src/lib/copy/index.ts`.
- Every string, with words, grade and source: [docs/content/02-copy-deck.md](../content/02-copy-deck.md).
- Checks (lengths, no-slop, inclusive language, readability, SMS bytes): [docs/content/03-checks.md](../content/03-checks.md).
- Voice and tone: [docs/content/01-voice-and-tone.md](../content/01-voice-and-tone.md).

`scripts/copy-lint.mjs` now writes docs/content/ instead of this file.
