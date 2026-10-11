# ADR-0024: Crew space: stats from counters only; member removal without key rotation (for now)

Status: Accepted, Sun 2026-10-11. Amends ADR-0008 (group key) for what the Crew space shows.

## Context
The founder asked for one home for the crew: people, who is out now, the week outside, places, Sparks, and management, including removing a member with a group-key rotation so they lose access.

## Decision
- **People:** first names opened on the phone with the group key (as today). No profiles, no photos.
- **Out now:** a count of live Flares and Plans that are lit, from `GET /groups/{id}` (states only). No names: who arrived never leaves the server (SRS-PRIV-8), so the dashboard cannot and does not say who is out.
- **The crew's story:** `GET /groups/{id}/stats`, member-only, from the counters the engine already writes per group: outings (`flares_lit` + `plans_lit_step`), minutes outside together (`lit_minutes_sum`, Lit to Gone), Embers saved (`embers_lit`), and one new bucket, `lit_minutes_week` by ISO week. Numbers only, never who, where or when; the `counters` rows cascade with the group, so Forget deletes them.
- **Crew name and usual quorum:** stored on the phone only for now (no server field), and labelled "on this phone".
- **Remove a member: not built yet, and no key rotation.** A real rotation needs a way to give the new key to everyone except the removed person. Flare's only key channel is the link fragment, so rotating would mean every remaining member opening a new link, and old sealed data (names, Hot spots, Sparks) would need re-sealing by someone holding both keys. Doing this right needs per-member keys (each phone holding a key pair, the group key wrapped per member). Until then, "remove" would only stop the server from accepting that member's writes, which is weaker than the founder asked, so we don't claim it. Leaving and Forget this crew work today (ADR-0015).

## Amendment: "Start fresh without someone" (Sun 2026-10-11, manager decision)
The secure way to drop someone with today's keys: Manage crew → Start fresh. This phone leaves the crew through Forget's own path (its membership and local copy are deleted, ADR-0015), so the next Flare creates a new crew with a new random key, and the host sends that link only to the people they choose. The old key is never used again by this phone. The screen says plainly: "They keep anything they already saw." The crew name and usual size come along (on this phone); Sparks and counts start over, because they live on the server under the old crew and moving them would need their tickets. The old crew stays for anyone still in it until it expires.

## Consequences
- The dashboard is honest about what it can know: counts, not people's movements.
- Member removal with rotation is backlog work with its own ADR when per-member keys exist.
