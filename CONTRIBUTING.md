# Contributing to Flare

Thanks for helping. Flare is small on purpose; these rules keep it that way.

## Before you start

- Open an issue first for anything bigger than a typo, so we can agree on the shape.
- Read the [architecture overview](docs/architecture/README.md) and the [coding standards](docs/architecture/11-coding-standards.md).
- Every endpoint and live message is in the [contracts](docs/architecture/contracts/). Change the contract in the same pull request as the code; `npm run contracts` fails if they drift.

## Set up

```bash
npm ci
npm run hooks   # pre-push secret scan
npm run ci      # must pass before you open a pull request
```

## Pull requests

- One change per pull request, with a test that fails without it.
- Name the requirement it serves (for example `SRS-RES-3`) in the description.
- UI text goes in the copy deck (`design/prototype/src/lib/copy/deck.json`), never in a component. Buttons 3 words at most, messages 12 words at most.
- Never add analytics, trackers, third-party scripts or fonts (SRS-PRIV-7).
- Never log request bodies, names, places, coordinates, conditions or link fragments (BR-D-6).

## Privacy and security

Report security problems privately, as described in [SECURITY.md](SECURITY.md), not in an issue.

## License

By contributing you agree your work is released under [AGPL-3.0-or-later](LICENSE).
