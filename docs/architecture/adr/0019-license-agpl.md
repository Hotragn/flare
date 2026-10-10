# ADR-0019: AGPL-3.0-or-later

Status: Accepted. Date: 2026-10-10. Confirms SRS-MNT-1.

## Decision
The code is released under GNU AGPL 3.0 or later. Full text in `LICENSE` (from the SPDX license list 6.12.0, `AGPL-3.0-or-later`, OSI approved).

## Why
Flare's promise is privacy. AGPL section 13 means anyone who runs a modified Flare server for others must offer their source, so users of a fork can check its privacy too. MIT or Apache 2.0 would let a hosted fork close its changes.

## Third parties
Runtime dependencies today: 28 MIT and 2 ISC packages (`npm ls --omit=dev`, 2026-10-10), all compatible with AGPL. Assets: Fraunces and Atkinson Hyperlegible Next (SIL Open Font License 1.1), OpenStreetMap data (ODbL 1.0, attribution shown in the app), Gemma 4 (Gemma terms of use; weights are not in the repo). `npm run licenses` (engineering, P1) writes THIRD_PARTY_NOTICES.md from the lockfile.
