# 09 Virtual Fairlane (a simulation)

Branch `sim`. New code only: `tools/sim/`, `apps/web/src/lib/sim/`, `apps/web/src/routes/sim/`,
`apps/web/static/sim/`. Changed files: root `package.json` (two scripts), `apps/web/package.json`
(`maplibre-gl` 6.11.2, exact, released 2026-09-24) and `package-lock.json`. No server, engine or
existing screen changed.

## What it does

Virtual Fairlane plays 30 to 60 made-up friends (default 48, in groups of 12, the server's group
limit) on the real Fairlane OSM data. It is labelled "Simulation" everywhere it shows up.

- **Map.** Homes, spots and benches come from `static/maps/fairlane.json`. Walking uses
  `static/maps/fairlane-paths.json` through `graph()` and `nearestNode` from `lib/map/paths.ts`,
  with Dijkstra on the main connected network. Walking speed is 1.0 to 1.4 m/s per friend.
- **Real server.** `tools/sim/run.ts` starts `node apps/server/src/main.ts` on a free port with
  `DATABASE_URL=pglite:memory FLARE_E2E_CLOCK=1 FLARE_ENV_FILE=<missing path> HUB_SECRET=<random>
  LOG_LEVEL=warn` and a clean environment, so no shell secrets and no `.env` reach it. Time moves
  15 s per tick through `POST /__e2e/clock`. Every simulated minute the script waits 1.2 s so the
  server's scheduler can run. Groups, members, gatherings, `PUT /me` (with `with` and `max_step`
  rules and `ember_only`), checks, arrivals, Done and Sparks use the same calls as
  `scripts/e2e-field.ts`. Sealed fields are random ciphertext strings.
- **The engine decides.** Lighting, the chosen set (`GET /me` `in_set`), Embers, the Ember bench,
  the Plan step, Gone and deletion all come from the server. The script reads them back and only
  moves people.
- **Personalities** (each group has 1 planner, 2 lazy, 2 conditional, 2 needs-a-bench, 1 low
  vision, the rest keen):
  - keen: says yes now and then (less often the farther the walk). Some never answer.
  - lazy: says yes only once 3 people are in (host plus 2). Looks again every 4 min for 25 min.
  - conditional: yes with the rule "only if <friend> goes" (`{type: "with"}`).
  - needs-a-bench: uses `checkNeeds` from `lib/map/places.ts` with `rest_gap_m: 200`. If there is
    no bench near the spot they send "count me in for a closer one" (`ember_only`). For Plans they
    add `max_step` for the smallest steps that pass. On the way they sit for 60 s on benches about
    every 200 m.
  - low vision: walks by following the real compass guide (`createGuide` from
    `lib/compass/guide.ts`). Each second they get a 4 m fix, walk the guide's bearing and move to
    the next corner when the guide says "near".
  - planner: sends a Plan (4 steps, 60/30/15/10 min, big and far to small and near, deadline in
    30 min, start in 60).
- **Scenario per group:** a Flare (quorum 3) near minute 2, a Plan near minute 12, an ambitious
  Flare (quorum 4) near minute 75 and a quick one (quorum 2) near minute 120. Groups start 7 min
  apart. The host walks to a bench near home first, then sends the Flare from there. Ember
  candidates are `emberCandidates()` within 400 m. Before Lit nobody can say "can't make it"
  (SRS-RES-6), so people who can't come just let it pass.
- **After the 200 min window** the script moves the clock 10 min at a time until the server
  returns 404 for every gathering, then calls `GET /api/v1/audit`.
- **Replay.** It writes `apps/web/static/sim/replay-<seed>.json`: friend positions per tick
  (lat/lon × 1e5 on the public OSM map) plus one status digit each, gathering states with times,
  a plain-words log and the stats. Format: `apps/web/src/lib/sim/replay.ts`. The run is
  repeatable: the same seed gives the same file (ids come from the seed; tokens and ciphertext
  are random but never written to the replay).
- **The /sim/ page** shows a MapLibre map on OpenStreetMap raster tiles, friends as dots by
  personality, gatherings as rings by state, Ember benches, a big red "Simulation" label (twice),
  a clock, play/pause, a scrubber, speed, a stats panel, "right now" and a legend. The
  "© OpenStreetMap contributors" credit is always visible, plus MapLibre's own credit (not
  collapsed). `?seed=N` picks a replay and `?export=1` shows only the map.
- **Frames.** `tools/sim/frames.ts` starts Vite dev on a free port, opens `/sim/?export=1` in
  Chrome (Playwright, `channel: "chrome"`), seeks each frame and waits for the tiles. It writes
  `docs/post/media/sim/seed-<seed>/frame-000.png` and so on. One set of 60 frames at 600 × 600 is
  about 32 MB, so `docs/post/media/sim/.gitignore` keeps them out of git. They are on disk in the
  main worktree only after you run the command.

## How to run

```sh
npm run sim -- --seed 42              # about 5 min; --friends 30..60, --minutes N; SIM_VERBOSE=1 prints the log
npm run sim:frames                    # 60 frames, 600 px; --seed, --frames, --width, --height
npm run dev:web                       # then open http://localhost:5180/sim/
```

GIF (ffmpeg is not installed here):
`ffmpeg -framerate 10 -i docs/post/media/sim/seed-42/frame-%03d.png -vf "split[a][b];[a]palettegen[p];[b][p]paletteuse" sim.gif`

`npm run sim` exits 1 if the audit fails, rows are left, or any gathering isn't deleted.

## Measured, seed 42 (one real run, 2026-10-11)

| | |
|---|---|
| Friends | 48 in 4 groups |
| Gatherings | 12 (8 Flares, 4 Plans) |
| Light rate | 91.7% (11 of 12) |
| Embers | 2; 1 lit, so Ember save rate 50% |
| Median time to Lit | 28.5 min overall (Plans light at the 30 min deadline); 14.75 min for Flares |
| Headcount | 48 in the chosen sets, 40 arrivals counted ("I'm here") |
| Sparks | 26 saved with tickets after Done |
| Deletion | 12 of 12 gatherings return 404; `GET /api/v1/audit` pass: true, 0 expired rows |
| Server calls | about 200 writes, 1,000 reads; about 280 s on this laptop |

## CSP hosts needed (app.ts not edited)

Tested on the real server serving the build: the only thing blocked on `/sim/` is the map tiles.

- `connect-src https://tile.openstreetmap.org` (MapLibre fetches the tile PNGs; it draws them from
  `blob:`, which `img-src` already allows)

The worker is bundled same-origin (`?worker&url` plus `setWorkerUrl`), so `worker-src 'self'` is
enough. No glyphs or sprites are used, so no other host is needed. If changing the CSP only for
`/sim/` is easier, that path is enough.

## Budget

`/sim` is its own route: 49.5 KB gzipped before interactive. MapLibre loads through a dynamic
import only on that page. `/app` (140 KB) and `/g/[id]` (139.7 KB) didn't change.

## Known limits

- It is a simulation. Personalities are simple rules with seeded chance. The answer odds are
  tuned so some Flares fade and some become Embers; they are not measured from real people.
- Places live only in the simulation. The server sees ciphertext, like in production. Ember
  check results are made up (85% pass, `backrest=no` fails).
- The server clock moves 15 s per tick and the scheduler runs once per simulated minute, so timer
  events (Ember, Plan deadline, Gone) show up within about a minute of their exact time.
- Fairlane has few benches (61 seats), so group homes sit around bench clusters. A host with no
  bench within 900 m sends from a path corner, and that Flare has no Ember benches.
- Low-vision walking uses the guide's bearing with perfect 4 m fixes and ±6° of noise. No
  heading or tilt samples are simulated.
- OSM's tile servers ask for light use. Fine for a demo page; for heavy traffic, use a
  self-hosted or paid tile source and update the CSP host.
- Frames need network for tiles and the installed Google Chrome.
- The replay JSON (about 730 KB) is committed so the page works without running the sim. A nested
  `apps/web/static/sim/biome.json` (`root: false`) keeps Biome from formatting it, because the root
  `biome.json` was off limits. That file is also served as `/sim/biome.json`, which does no harm.
