# Security policy

## Reporting a problem

Please report security or privacy problems privately through GitHub's **private vulnerability reporting** on this repository (Security tab, "Report a vulnerability"). Do not open a public issue.

Include what you found, how to reproduce it, and what an attacker could do. We reply within 3 days and aim to fix serious problems within 14 days. We credit reporters who want it.

## What counts

Anything that breaks one of Flare's promises, for example:

- The server, its logs or the hub seeing a readable name, place, coordinate, photo or condition from a link group.
- One member learning who else said yes, or when (BR-Q-5).
- Data surviving past the 5-minute deletion window after a gathering ends (BR-D-1).
- A secret (bot token, hub secret, database credentials) leaking to a client, the repository or logs.
- Writing to a gathering without that member's token.

## Supported versions

Only the latest commit on `main` and the running deployment.

## How Flare is built to be safe

See the [security and privacy design](docs/architecture/08-security-privacy.md): threat model, trust boundaries, key handling, deletion guarantees and what we log.
